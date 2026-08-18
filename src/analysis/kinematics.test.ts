import { describe, expect, it } from 'vitest'

import { createCalibration, updateCalibrationXAxis } from '../calibration/model'
import {
  createTrack,
  createTrackSample,
  deleteTrackSample,
  updateTrackSamplePosition,
} from '../tracking/model'
import type { Track, TrackSample } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import {
  deriveTrackKinematics,
  kinematicsForSample,
  MIN_TIME_DELTA_SECONDS,
} from './kinematics'

function sample(id: string, time: number, x: number, y: number): TrackSample {
  return createTrackSample(id, createFrameReference(time), { x, y })!
}

function trackFrom(points: ReadonlyArray<readonly [number, number, number]>): Track {
  return {
    ...createTrack('track-1', 'Ball', '#4ecdc4')!,
    samples: points.map(([time, x, y], index) =>
      sample(`sample-${index}`, time, x, y),
    ),
  }
}

describe('derived track kinematics', () => {
  it('derives constant velocity and zero interior acceleration', () => {
    const analysis = deriveTrackKinematics(
      trackFrom([
        [0, 0, 0],
        [1, 2, 0],
        [2, 4, 0],
        [4, 8, 0],
      ]),
      null,
    )

    for (const item of analysis.samples) {
      expect(item.velocity?.x).toBeCloseTo(2)
      expect(item.velocity?.y).toBeCloseTo(0)
      expect(item.velocity?.magnitude).toBeCloseTo(2)
    }
    expect(analysis.samples[0]?.acceleration).toBeNull()
    expect(analysis.samples[1]?.acceleration?.x).toBeCloseTo(0)
    expect(analysis.samples[2]?.acceleration?.x).toBeCloseTo(0)
    expect(analysis.samples[3]?.acceleration).toBeNull()
  })

  it('recovers constant acceleration from irregularly timed quadratic motion', () => {
    const acceleration = 4
    const times = [0, 0.5, 1.5, 3]
    const analysis = deriveTrackKinematics(
      trackFrom(times.map((time) => [time, 0.5 * acceleration * time * time, 0])),
      null,
    )

    analysis.samples.forEach((item, index) => {
      expect(item.velocity?.x).toBeCloseTo(acceleration * times[index]!)
    })
    expect(analysis.samples[1]?.acceleration?.x).toBeCloseTo(acceleration)
    expect(analysis.samples[2]?.acceleration?.x).toBeCloseTo(acceleration)
  })

  it('uses actual irregular timestamp intervals for velocity', () => {
    const analysis = deriveTrackKinematics(
      trackFrom([
        [0, 0, 0],
        [0.25, 0.75, 0],
        [1.75, 5.25, 0],
      ]),
      null,
    )
    expect(analysis.samples.map((item) => item.velocity?.x)).toEqual([
      expect.closeTo(3),
      expect.closeTo(3),
      expect.closeTo(3),
    ])
  })

  it('derives independent 2D components and vector magnitudes', () => {
    const analysis = deriveTrackKinematics(
      trackFrom([
        [0, 0, 0],
        [1, 3, 4],
        [2, 6, 8],
      ]),
      null,
    )
    const middle = analysis.samples[1]
    expect(middle?.velocity).toMatchObject({ x: 3, y: 4, magnitude: 5 })
    expect(middle?.displacementFromPrevious).toMatchObject({
      x: 3,
      y: 4,
      magnitude: 5,
      dt: 1,
    })
  })

  it('accumulates path distance rather than endpoint displacement', () => {
    const analysis = deriveTrackKinematics(
      trackFrom([
        [0, 0, 0],
        [1, 3, 0],
        [2, 3, 4],
      ]),
      null,
    )
    expect(analysis.samples[2]?.cumulativeDistance).toBe(7)
    expect(Math.hypot(3, 4)).toBe(5)
  })

  it('labels uncalibrated analysis in pixel-derived units', () => {
    const analysis = deriveTrackKinematics(trackFrom([[0, 5, 12]]), null)
    expect(analysis).toMatchObject({
      space: 'pixel',
      positionUnit: 'px',
      velocityUnit: 'px/s',
      accelerationUnit: 'px/s²',
    })
    expect(analysis.samples[0]?.positionMagnitude).toBe(13)
  })

  it('propagates calibration scale and unit without mutating native samples', () => {
    const track = trackFrom([
      [0, 0, 0],
      [1, 10, 0],
      [2, 20, 0],
    ])
    const calibration = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 2,
      unit: 'cm',
    })
    if (!calibration.ok) throw new Error('calibration fixture should be valid')

    const nativeBefore = track.samples.map((item) => item.nativePosition)
    const analysis = deriveTrackKinematics(track, calibration.calibration)
    expect(analysis).toMatchObject({
      space: 'world',
      positionUnit: 'cm',
      velocityUnit: 'cm/s',
      accelerationUnit: 'cm/s²',
    })
    expect(analysis.samples[1]?.position.x).toBeCloseTo(2)
    expect(analysis.samples[1]?.velocity?.x).toBeCloseTo(2)
    expect(track.samples.map((item) => item.nativePosition)).toEqual(nativeBefore)
  })

  it('reacts to recalibration while preserving observation geometry', () => {
    const track = trackFrom([
      [0, 0, 0],
      [1, 10, 0],
      [2, 20, 0],
    ])
    const first = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 1,
      unit: 'm',
    })
    const second = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 2,
      unit: 'm',
    })
    if (!first.ok || !second.ok) throw new Error('calibration fixtures should be valid')

    expect(deriveTrackKinematics(track, first.calibration).samples[1]?.velocity?.x).toBeCloseTo(1)
    expect(deriveTrackKinematics(track, second.calibration).samples[1]?.velocity?.x).toBeCloseTo(2)
    expect(track.samples[1]?.nativePosition).toEqual({ x: 10, y: 0 })
  })

  it('uses the rotated world basis and image-up sign correctly', () => {
    const base = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 10,
      unit: 'm',
    })
    if (!base.ok) throw new Error('calibration fixture should be valid')

    const imageUp = deriveTrackKinematics(
      trackFrom([
        [0, 0, 0],
        [1, 0, -10],
        [2, 0, -20],
      ]),
      base.calibration,
    )
    expect(imageUp.samples[1]?.velocity).toMatchObject({ x: 0, y: 10 })

    const rotated = updateCalibrationXAxis(base.calibration, { x: 0, y: 10 })
    if (!rotated.ok) throw new Error('rotated calibration should be valid')
    const imageRight = deriveTrackKinematics(
      trackFrom([
        [0, 0, 0],
        [1, 10, 0],
        [2, 20, 0],
      ]),
      rotated.calibration,
    )
    expect(imageRight.samples[1]?.velocity).toMatchObject({ x: 0, y: 10 })
  })

  it('normalizes non-monotonic input before deriving intervals', () => {
    const track = trackFrom([
      [2, 4, 0],
      [0, 0, 0],
      [1, 2, 0],
    ])
    const analysis = deriveTrackKinematics(track, null)
    expect(analysis.samples.map((item) => item.source.time)).toEqual([0, 1, 2])
    expect(analysis.samples[1]?.velocity?.x).toBeCloseTo(2)
  })

  it('returns unavailable derivatives for duplicate or effectively equal times', () => {
    const duplicate = trackFrom([
      [1, 0, 0],
      [1, 10, 0],
    ])
    const duplicateAnalysis = deriveTrackKinematics(duplicate, null)
    expect(duplicateAnalysis.samples.every((item) => item.velocity === null)).toBe(true)
    expect(duplicateAnalysis.samples[1]?.displacementFromPrevious).toBeNull()
    expect(duplicateAnalysis.samples[1]?.cumulativeDistance).toBe(0)

    const tiny = trackFrom([
      [0, 0, 0],
      [MIN_TIME_DELTA_SECONDS / 2, 1, 0],
    ])
    expect(
      deriveTrackKinematics(tiny, null).samples.every(
        (item) => item.velocity === null,
      ),
    ).toBe(true)
  })

  it('excludes positions whose calibrated transform overflows', () => {
    const calibration = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 1, y: 0 },
      knownDistance: Number.MAX_VALUE,
      unit: 'm',
    })
    if (!calibration.ok) throw new Error('calibration fixture should be valid')
    const analysis = deriveTrackKinematics(
      trackFrom([
        [0, 0, 0],
        [1, 2, 0],
      ]),
      calibration.calibration,
    )
    expect(analysis.samples).toHaveLength(1)
    expect(analysis.samples[0]?.position).toEqual({ x: 0, y: 0 })
  })

  it('handles zero, one, and two samples without fabricated acceleration', () => {
    expect(deriveTrackKinematics(trackFrom([]), null).samples).toEqual([])

    const one = deriveTrackKinematics(trackFrom([[0, 1, 2]]), null)
    expect(one.samples[0]?.velocity).toBeNull()
    expect(one.samples[0]?.acceleration).toBeNull()

    const two = deriveTrackKinematics(
      trackFrom([
        [0, 1, 2],
        [2, 5, 6],
      ]),
      null,
    )
    expect(two.samples[0]?.velocity).not.toBeNull()
    expect(two.samples.every((item) => item.acceleration === null)).toBe(true)
  })

  it('reacts to moved and deleted samples and supports sample lookup', () => {
    const original = trackFrom([
      [0, 0, 0],
      [1, 1, 0],
      [2, 2, 0],
    ])
    const moved = updateTrackSamplePosition(original, 'sample-1', { x: 4, y: 0 })
    const movedAnalysis = deriveTrackKinematics(moved, null)
    expect(movedAnalysis.samples[1]?.cumulativeDistance).toBe(4)
    expect(kinematicsForSample(movedAnalysis, 'sample-1')?.position.x).toBe(4)

    const deleted = deleteTrackSample(moved, 'sample-1')
    const deletedAnalysis = deriveTrackKinematics(deleted, null)
    expect(deletedAnalysis.samples).toHaveLength(2)
    expect(deletedAnalysis.samples[1]?.cumulativeDistance).toBe(2)
  })
})
