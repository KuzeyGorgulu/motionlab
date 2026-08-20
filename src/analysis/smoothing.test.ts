import { describe, expect, it } from 'vitest'

import { createCalibration } from '../calibration/model'
import { createTrack, createTrackSample } from '../tracking/model'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import { deriveSmoothedTrackKinematics } from './smoothing'

function trackFrom(
  points: ReadonlyArray<readonly [number, number, number]>,
): Track {
  return {
    ...createTrack('track-1', 'Test motion', '#4ecdc4')!,
    samples: points.map(([time, x, y], index) =>
      createTrackSample(
        `sample-${index}`,
        createFrameReference(time),
        { x, y },
      )!,
    ),
  }
}

function expectFiniteAnalysis(analysis: ReturnType<typeof deriveSmoothedTrackKinematics>) {
  expect(analysis.ok).toBe(true)
  if (!analysis.ok) return
  for (const sample of analysis.analysis.samples) {
    expect([
      sample.position.x,
      sample.position.y,
      sample.velocity.x,
      sample.velocity.y,
      sample.acceleration.x,
      sample.acceleration.y,
    ].every(Number.isFinite)).toBe(true)
  }
}

describe('timestamp-aware local polynomial smoothing', () => {
  it('preserves an exact constant-position trajectory', () => {
    const result = deriveSmoothedTrackKinematics(
      trackFrom([0, 0.4, 1.1, 1.9, 3, 4.2].map((time) => [time, 12, -7])),
      null,
      5,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const sample of result.analysis.samples) {
      expect(sample.position.x).toBeCloseTo(12, 10)
      expect(sample.position.y).toBeCloseTo(-7, 10)
      expect(sample.velocity.magnitude).toBeCloseTo(0, 10)
      expect(sample.acceleration.magnitude).toBeCloseTo(0, 10)
    }
  })

  it('recovers exact constant velocity at irregular timestamps', () => {
    const times = [2, 2.3, 3.1, 4.8, 5.2, 7.4, 9]
    const result = deriveSmoothedTrackKinematics(
      trackFrom(times.map((time) => [time, 4 + 3 * (time - 2), -2 * (time - 2)])),
      null,
      7,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    result.analysis.samples.forEach((sample, index) => {
      expect(sample.position.x).toBeCloseTo(4 + 3 * (times[index]! - 2), 9)
      expect(sample.velocity).toMatchObject({
        x: expect.closeTo(3, 9),
        y: expect.closeTo(-2, 9),
      })
      expect(sample.acceleration.magnitude).toBeCloseTo(0, 8)
    })
  })

  it('recovers exact constant acceleration from real irregular timestamps', () => {
    const times = [5, 5.2, 5.9, 7.1, 8.8, 10, 13, 15]
    const result = deriveSmoothedTrackKinematics(
      trackFrom(times.map((time) => {
        const tau = time - 5
        return [time, 10 + 2 * tau + 1.5 * tau * tau, -4 + tau - 2 * tau * tau]
      })),
      null,
      7,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    result.analysis.samples.forEach((sample, index) => {
      const tau = times[index]! - 5
      expect(sample.velocity.x).toBeCloseTo(2 + 3 * tau, 8)
      expect(sample.velocity.y).toBeCloseTo(1 - 4 * tau, 8)
      expect(sample.acceleration.x).toBeCloseTo(3, 8)
      expect(sample.acceleration.y).toBeCloseTo(-4, 8)
    })
  })

  it('uses asymmetric windows at the beginning without extrapolating timestamps', () => {
    const times = [0, 0.3, 0.9, 1.8, 3, 4.7, 7]
    const result = deriveSmoothedTrackKinematics(
      trackFrom(times.map((time) => [time, time * time, 2 * time])),
      null,
      5,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.analysis.samples[0]?.source.time).toBe(0)
    expect(result.analysis.samples[0]?.position.x).toBeCloseTo(0, 9)
    expect(result.analysis.samples[0]?.velocity.x).toBeCloseTo(0, 9)
    expect(result.analysis.samples[0]?.acceleration.x).toBeCloseTo(2, 9)
    expect(result.analysis.samples.map((sample) => sample.source.time)).toEqual(times)
  })

  it('uses asymmetric windows at the end', () => {
    const times = [0, 0.3, 0.9, 1.8, 3, 4.7, 7]
    const result = deriveSmoothedTrackKinematics(
      trackFrom(times.map((time) => [time, time * time, 2 * time])),
      null,
      5,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const last = result.analysis.samples.at(-1)!
    expect(last.source.time).toBe(7)
    expect(last.position.x).toBeCloseTo(49, 8)
    expect(last.velocity.x).toBeCloseTo(14, 8)
    expect(last.acceleration.x).toBeCloseTo(2, 8)
  })

  it('supports 5, 7, and 9 point windows deterministically', () => {
    const times = [0, 0.2, 0.8, 1.6, 2.1, 3.4, 5, 6.1, 8, 10]
    const track = trackFrom(times.map((time) => [time, 1 + time + 2 * time * time, -time * time]))
    for (const windowSize of [5, 7, 9] as const) {
      const first = deriveSmoothedTrackKinematics(track, null, windowSize)
      const second = deriveSmoothedTrackKinematics(track, null, windowSize)
      expect(first).toEqual(second)
      expectFiniteAnalysis(first)
      if (first.ok) expect(first.analysis.analysisSource.windowSize).toBe(windowSize)
    }
  })

  it('uses every available observation when a larger selected window exceeds the track length', () => {
    const result = deriveSmoothedTrackKinematics(
      trackFrom([0, 1, 2, 3, 4].map((time) => [time, time * time, time])),
      null,
      9,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.analysis.samples).toHaveLength(5)
  })

  it('reports fewer than five usable observations without a raw fallback', () => {
    expect(deriveSmoothedTrackKinematics(
      trackFrom([0, 1, 2, 3].map((time) => [time, time, 0])),
      null,
      5,
    )).toEqual({
      ok: false,
      message: 'Not enough samples for smoothing. At least 5 valid observations are required.',
    })
  })

  it('rejects degenerate and near-degenerate timestamp windows safely', () => {
    const result = deriveSmoothedTrackKinematics(
      trackFrom([0, 1e-8, 2e-8, 3e-8, 4e-8].map((time) => [time, time, time])),
      null,
      5,
    )
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/)
  })

  it('reduces deterministic position noise while retaining every observation identity', () => {
    const times = [0, 0.35, 0.9, 1.55, 2.4, 3.3, 4.6, 5.1, 6.8, 8]
    const points = times.map((time, index) => {
      const noise = [2, -1.5, 1, -2, 1.7, -1.2, 2.2, -1.8, 1.3, -2.1][index]!
      return [time, 5 + 3 * time + noise, -2 + 0.5 * time - noise * 0.4] as const
    })
    const track = trackFrom(points)
    const result = deriveSmoothedTrackKinematics(track, null, 7)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const rawSquaredError = track.samples.reduce((sum, sample) => {
      const expected = 5 + 3 * sample.time
      return sum + (sample.nativePosition.x - expected) ** 2
    }, 0)
    const smoothedSquaredError = result.analysis.samples.reduce((sum, sample) => {
      const expected = 5 + 3 * sample.source.time
      return sum + (sample.position.x - expected) ** 2
    }, 0)
    expect(smoothedSquaredError).toBeLessThan(rawSquaredError)
    expect(result.analysis.samples.map((sample) => sample.source.id)).toEqual(
      track.samples.map((sample) => sample.id),
    )
  })

  it('operates in calibrated world space and preserves physical units', () => {
    const calibration = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 2,
      unit: 'm',
    })
    if (!calibration.ok) throw new Error('fixture calibration must be valid')
    const result = deriveSmoothedTrackKinematics(
      trackFrom([0, 1, 2, 3, 4, 5].map((time) => [time, 10 * time, 0])),
      calibration.calibration,
      5,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.analysis).toMatchObject({
      space: 'world',
      positionUnit: 'm',
      velocityUnit: 'm/s',
      accelerationUnit: 'm/s²',
    })
    expect(result.analysis.samples[2]?.velocity.x).toBeCloseTo(2)
  })

  it('does not mutate input arrays, TrackSamples, or native positions', () => {
    const track = trackFrom([0, 1, 2, 3, 4, 5].map((time) => [time, time + (time % 2), 0]))
    const before = structuredClone(track)
    for (const sample of track.samples) {
      Object.freeze(sample.nativePosition)
      Object.freeze(sample.frame)
      Object.freeze(sample)
    }
    Object.freeze(track.samples)
    Object.freeze(track)

    const result = deriveSmoothedTrackKinematics(track, null, 5)
    expect(result.ok).toBe(true)
    expect(track).toEqual(before)
    if (result.ok) {
      result.analysis.samples.forEach((sample, index) => {
        expect(sample.source).toBe(track.samples[index])
        expect(sample.rawNativePosition).toEqual(track.samples[index]?.nativePosition)
      })
    }
  })
})
