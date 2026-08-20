import { describe, expect, it } from 'vitest'

import { createCalibration } from '../calibration/model'
import { createTrack, createTrackSample } from '../tracking/model'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import {
  deriveFitDiagnostics,
  MINIMUM_OUTLIER_SAMPLE_COUNT,
  potentialOutlierThreshold,
} from './fitDiagnostics'
import { deriveTrackKinematics } from './kinematics'
import { fitMotionModel } from './modelFit'
import type { ConstantVelocityFit, TrackKinematics } from './types'

function trackFrom(
  times: readonly number[],
  pointAt: (time: number, index: number) => { x: number; y: number },
): Track {
  return {
    ...createTrack('diagnostic-track', 'Diagnostic track', '#4ecdc4')!,
    samples: times.map((time, index) => createTrackSample(
      `diagnostic-${index}`,
      createFrameReference(time),
      pointAt(time, index),
    )!),
  }
}

function diagnosticsFor(
  track: Track,
  type: 'constant-velocity' | 'constant-acceleration' = 'constant-velocity',
) {
  const analysis = deriveTrackKinematics(track, null)
  const fit = fitMotionModel(analysis, type, 'raw')
  expect(fit.ok).toBe(true)
  if (!fit.ok) throw new Error(fit.message)
  const diagnostics = deriveFitDiagnostics(analysis, fit.fit)
  expect(diagnostics).not.toBeNull()
  if (diagnostics === null) throw new Error('diagnostics fixture failed')
  return { analysis, fit: fit.fit, diagnostics }
}

describe('fit residual calculations', () => {
  it('produces zero residuals for exact constant velocity', () => {
    const { diagnostics } = diagnosticsFor(
      trackFrom([0, 0.3, 1.1, 2.8], (time) => ({
        x: 4 + 3 * time,
        y: -2 - 0.5 * time,
      })),
    )
    for (const observation of diagnostics.observations) {
      expect(observation.residualX).toBeCloseTo(0, 10)
      expect(observation.residualY).toBeCloseTo(0, 10)
      expect(observation.residualMagnitude).toBeCloseTo(0, 10)
    }
  })

  it('produces zero residuals for exact constant acceleration', () => {
    const { diagnostics } = diagnosticsFor(
      trackFrom([2, 2.4, 3.3, 5, 7.2], (time) => {
        const tau = time - 2
        return { x: 3 + 2 * tau + tau * tau, y: 8 - 4 * tau }
      }),
      'constant-acceleration',
    )
    expect(diagnostics.summary.maximumResidualMagnitude).toBeCloseTo(0, 9)
  })

  it('uses irregular media timestamps and preserves residual signs and magnitude', () => {
    const analysis = deriveTrackKinematics(
      trackFrom([0, 0.7], (_, index) => [
        { x: 1, y: -2 },
        { x: 1.7, y: 3 },
      ][index]!),
      null,
    )
    const fit: ConstantVelocityFit = {
      type: 'constant-velocity',
      source: 'raw',
      t0: 0,
      x0: 0,
      y0: 0,
      vx: 1,
      vy: 0,
      speed: 1,
      sampleCount: 2,
      timeSpan: 0.7,
      rmse: Math.sqrt((5 + 10) / 2),
      rSquaredX: null,
      rSquaredY: null,
    }
    const diagnostics = deriveFitDiagnostics(analysis, fit)
    expect(diagnostics?.observations).toEqual([
      expect.objectContaining({
        time: 0,
        residualX: 1,
        residualY: -2,
        residualMagnitude: Math.sqrt(5),
      }),
      expect.objectContaining({
        time: 0.7,
        residualX: 1,
        residualY: 3,
        residualMagnitude: Math.sqrt(10),
      }),
    ])
  })

  it('handles a static X axis and deterministic noisy Y values', () => {
    const { diagnostics } = diagnosticsFor(trackFrom(
      [0, 0.5, 1.4, 2.2, 3.8],
      (time, index) => ({
        x: 7,
        y: 2 * time + [0.3, -0.2, 0.1, -0.25, 0.15][index]!,
      }),
    ))
    expect(diagnostics.summary.rSquaredX).toBeNull()
    expect(diagnostics.summary.maximumResidualMagnitude).toBeGreaterThan(0)
    expect(diagnostics.observations.every((item) => Math.abs(item.residualX) < 1e-9)).toBe(true)
  })

  it('uses calibrated world coordinates and returns to explicit pixel fallback', () => {
    const calibration = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 2,
      unit: 'm',
    })
    if (!calibration.ok) throw new Error('calibration fixture failed')
    const track = trackFrom([0, 1, 2, 3, 4], (time, index) => ({
      x: 10 * time + [0, 1, -1, 2, -2][index]!,
      y: 0,
    }))
    const pixel = deriveTrackKinematics(track, null)
    const world = deriveTrackKinematics(track, calibration.calibration)
    const pixelFit = fitMotionModel(pixel, 'constant-velocity', 'raw')
    const worldFit = fitMotionModel(world, 'constant-velocity', 'raw')
    if (!pixelFit.ok || !worldFit.ok) throw new Error('fit fixture failed')
    const pixelDiagnostics = deriveFitDiagnostics(pixel, pixelFit.fit)
    const worldDiagnostics = deriveFitDiagnostics(world, worldFit.fit)
    expect(pixelDiagnostics?.positionUnit).toBe('px')
    expect(worldDiagnostics?.positionUnit).toBe('m')
    expect(worldDiagnostics?.summary.rmse).toBeCloseTo(
      (pixelDiagnostics?.summary.rmse ?? 0) * 0.2,
    )
  })
})

describe('fit diagnostic metrics and ranking', () => {
  it('keeps RMSE identical to Phase 9 and defines MAE as mean residual magnitude', () => {
    const { fit, diagnostics } = diagnosticsFor(trackFrom(
      [0, 0.4, 1.2, 2.5, 4, 6],
      (time, index) => ({
        x: 2 + 3 * time + [0.5, -0.25, 0.1, -0.4, 0.3, -0.15][index]!,
        y: -1 + time,
      }),
    ))
    const magnitudes = diagnostics.observations.map((item) => item.residualMagnitude)
    expect(diagnostics.summary.rmse).toBe(fit.rmse)
    expect(diagnostics.summary.rmse).toBeCloseTo(
      Math.sqrt(magnitudes.reduce((sum, value) => sum + value * value, 0) / magnitudes.length),
    )
    expect(diagnostics.summary.mae).toBeCloseTo(
      magnitudes.reduce((sum, value) => sum + value, 0) / magnitudes.length,
    )
  })

  it('derives max and mean residuals plus the largest sample identity and time', () => {
    const { diagnostics } = diagnosticsFor(trackFrom(
      [0, 1, 2, 3, 4],
      (time, index) => ({ x: time + [0, 1, -2, 1, 0][index]!, y: index % 2 }),
    ))
    const first = diagnostics.rankedObservations[0]!
    expect(diagnostics.summary).toMatchObject({
      maximumResidualMagnitude: first.residualMagnitude,
      largestResidualSampleId: first.sampleId,
      largestResidualTime: first.time,
      sampleCount: 5,
      timeSpan: 4,
    })
    expect(diagnostics.summary.meanResidualX).toBeCloseTo(0, 10)
    expect(diagnostics.summary.meanResidualY).toBeCloseTo(0, 10)
  })

  it('ranks deterministically by magnitude, timestamp, then stable identity', () => {
    const analysis: TrackKinematics = deriveTrackKinematics(
      {
        ...trackFrom([0, 1, 2], () => ({ x: 1, y: 0 })),
        samples: [
          createTrackSample('z', createFrameReference(0), { x: 1, y: 0 })!,
          createTrackSample('b', createFrameReference(1), { x: -1, y: 0 })!,
          createTrackSample('a', createFrameReference(1), { x: 1, y: 0 })!,
        ],
      },
      null,
    )
    const fit: ConstantVelocityFit = {
      type: 'constant-velocity', source: 'raw', t0: 0, x0: 0, y0: 0,
      vx: 0, vy: 0, speed: 0, sampleCount: 3, timeSpan: 1,
      rmse: 1, rSquaredX: null, rSquaredY: null,
    }
    const diagnostics = deriveFitDiagnostics(analysis, fit)
    expect(diagnostics?.rankedObservations.map((item) => item.sampleId)).toEqual(['z', 'a', 'b'])
    expect(analysis.samples.map((sample) => sample.source.id)).toEqual(['z', 'a', 'b'])
  })
})

describe('potential outlier policy', () => {
  it('flags an obvious isolated deviation with non-degenerate robust spread', () => {
    const noise = [-1, 0.5, -0.7, 1.1, -0.3, 0.8, 35, -0.6, 0.4, -1.2, 0.2]
    const { diagnostics } = diagnosticsFor(trackFrom(
      noise.map((_, index) => index),
      (time, index) => ({ x: time * 2, y: noise[index]! }),
    ))
    expect(diagnostics.observations.filter((item) => item.potentialOutlier).map((item) => item.sampleId))
      .toEqual(['diagnostic-6'])
  })

  it('does not flag exact, uniform, zero-spread, or tiny sample sets', () => {
    expect(potentialOutlierThreshold(Array(8).fill(0))?.threshold).toBeNull()
    expect(potentialOutlierThreshold(Array(8).fill(2))?.threshold).toBeNull()
    expect(potentialOutlierThreshold([1, 1.1, 20])?.threshold).toBeNull()
    expect(MINIMUM_OUTLIER_SAMPLE_COUNT).toBe(7)
  })

  it('prefers false negatives for several moderate deviations', () => {
    const scale = potentialOutlierThreshold([1, 2, 1, 2, 1, 2, 4, 4])
    expect(scale?.threshold).not.toBeNull()
    expect([1, 2, 1, 2, 1, 2, 4, 4].some((value) =>
      scale?.threshold !== null && scale?.threshold !== undefined && value > scale.threshold)).toBe(false)
  })

  it('uses a strict deterministic threshold boundary', () => {
    const scale = potentialOutlierThreshold([0.8, 0.9, 1, 1.1, 1.2, 1.3, 2])
    expect(scale?.threshold).not.toBeNull()
    if (scale?.threshold === null || scale === null) return
    expect(scale.threshold > scale.median).toBe(true)
    expect(scale.threshold > scale.threshold).toBe(false)
    expect(scale.threshold + Math.max(1, Math.abs(scale.threshold)) * Number.EPSILON * 2 > scale.threshold).toBe(true)
  })
})

describe('fit diagnostics immutability and safety', () => {
  it('does not mutate analysis samples, track observations, or fit input', () => {
    const track = trackFrom([0, 0.5, 1.5, 3], (time) => ({ x: time * 2, y: time + 0.1 }))
    const analysis = deriveTrackKinematics(track, null)
    const fit = fitMotionModel(analysis, 'constant-velocity', 'raw')
    if (!fit.ok) throw new Error(fit.message)
    const before = JSON.stringify({ track, analysis, fit })
    deriveFitDiagnostics(analysis, fit.fit)
    expect(JSON.stringify({ track, analysis, fit })).toBe(before)
  })

  it('fails closed for incompatible or non-finite fit input', () => {
    const analysis = deriveTrackKinematics(
      trackFrom([0, 1], (time) => ({ x: time, y: 0 })),
      null,
    )
    const fit: ConstantVelocityFit = {
      type: 'constant-velocity', source: 'raw', t0: 0, x0: 0, y0: 0,
      vx: 1, vy: 0, speed: 1, sampleCount: 3, timeSpan: 1,
      rmse: 0, rSquaredX: 1, rSquaredY: null,
    }
    expect(deriveFitDiagnostics(analysis, fit)).toBeNull()
    expect(JSON.stringify(deriveFitDiagnostics(analysis, { ...fit, sampleCount: 2, rmse: Number.NaN })))
      .not.toMatch(/NaN|Infinity/)
  })
})
