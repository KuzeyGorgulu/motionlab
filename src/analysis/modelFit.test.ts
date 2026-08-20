import { describe, expect, it } from 'vitest'

import { createCalibration } from '../calibration/model'
import { createTrack, createTrackSample } from '../tracking/model'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import { deriveTrackKinematics } from './kinematics'
import { evaluateMotionModel, fitMotionModel } from './modelFit'

function trackFrom(
  times: readonly number[],
  pointAt: (time: number, index: number) => { x: number; y: number },
): Track {
  return {
    ...createTrack('track-fit', 'Fit trajectory', '#ffb454')!,
    samples: times.map((time, index) =>
      createTrackSample(
        `fit-${index}`,
        createFrameReference(time),
        pointAt(time, index),
      )!,
    ),
  }
}

function fitted(
  track: Track,
  type: 'constant-velocity' | 'constant-acceleration',
) {
  return fitMotionModel(deriveTrackKinematics(track, null), type, 'raw')
}

describe('constant-velocity model fitting', () => {
  it('fits exact X velocity', () => {
    const result = fitted(
      trackFrom([0, 1, 2, 3], (time) => ({ x: 5 + 4 * time, y: 0 })),
      'constant-velocity',
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.fit.type !== 'constant-velocity') return
    expect(result.fit).toMatchObject({
      t0: 0,
      x0: expect.closeTo(5),
      vx: expect.closeTo(4),
      vy: expect.closeTo(0),
      speed: expect.closeTo(4),
      sampleCount: 4,
      timeSpan: 3,
      rmse: expect.closeTo(0),
    })
    expect(result.fit.rSquaredX).toBeCloseTo(1)
    expect(result.fit.rSquaredY).toBeNull()
  })

  it('fits an exact two-dimensional velocity vector', () => {
    const result = fitted(
      trackFrom([0, 1, 2, 4], (time) => ({ x: 3 * time, y: -4 * time })),
      'constant-velocity',
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.fit.type !== 'constant-velocity') return
    expect(result.fit.vx).toBeCloseTo(3)
    expect(result.fit.vy).toBeCloseTo(-4)
    expect(result.fit.speed).toBeCloseTo(5)
  })

  it('uses irregular real timestamps and a non-zero starting timestamp', () => {
    const times = [12.5, 12.8, 14.1, 17.7, 20]
    const result = fitted(
      trackFrom(times, (time) => ({
        x: -8 + 2.5 * (time - 12.5),
        y: 7 - 0.75 * (time - 12.5),
      })),
      'constant-velocity',
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.fit.type !== 'constant-velocity') return
    expect(result.fit.t0).toBe(12.5)
    expect(result.fit.x0).toBeCloseTo(-8)
    expect(result.fit.y0).toBeCloseTo(7)
    expect(result.fit.vx).toBeCloseTo(2.5)
    expect(result.fit.vy).toBeCloseTo(-0.75)
    expect(result.fit.timeSpan).toBeCloseTo(7.5)
  })

  it('fits a static object without inventing R² values', () => {
    const result = fitted(
      trackFrom([2, 3, 5, 9], () => ({ x: 7, y: -3 })),
      'constant-velocity',
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.fit.type !== 'constant-velocity') return
    expect(result.fit.speed).toBeCloseTo(0, 10)
    expect(result.fit.rmse).toBeCloseTo(0, 10)
    expect(result.fit.rSquaredX).toBeNull()
    expect(result.fit.rSquaredY).toBeNull()
  })

  it('produces deterministic metrics for deterministic noisy data', () => {
    const times = [0, 0.4, 1.2, 2.5, 4, 6]
    const noise = [0.5, -0.25, 0.1, -0.4, 0.3, -0.15]
    const track = trackFrom(times, (time, index) => ({
      x: 2 + 3 * time + noise[index]!,
      y: -1 + time - noise[index]! * 0.5,
    }))
    const first = fitted(track, 'constant-velocity')
    const second = fitted(track, 'constant-velocity')
    expect(first).toEqual(second)
    expect(first.ok).toBe(true)
    if (!first.ok || first.fit.type !== 'constant-velocity') return
    expect(first.fit.rmse).toBeGreaterThan(0)
    expect(first.fit.rSquaredX).toBeGreaterThan(0.99)
    expect(first.fit.rSquaredY).toBeGreaterThan(0.98)
  })

  it('uses calibrated physical values and units from the selected analysis', () => {
    const calibration = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 2,
      unit: 'm',
    })
    if (!calibration.ok) throw new Error('fixture calibration must be valid')
    const analysis = deriveTrackKinematics(
      trackFrom([0, 1, 2, 3], (time) => ({ x: 10 * time, y: 0 })),
      calibration.calibration,
    )
    const result = fitMotionModel(analysis, 'constant-velocity', 'raw')
    expect(analysis.velocityUnit).toBe('m/s')
    expect(result.ok).toBe(true)
    if (result.ok && result.fit.type === 'constant-velocity') {
      expect(result.fit.vx).toBeCloseTo(2)
    }
  })

  it('falls back explicitly to pixel-space analysis when uncalibrated', () => {
    const analysis = deriveTrackKinematics(
      trackFrom([0, 1, 2], (time) => ({ x: 3 * time, y: 0 })),
      null,
    )
    const result = fitMotionModel(analysis, 'constant-velocity', 'raw')
    expect(analysis).toMatchObject({ space: 'pixel', velocityUnit: 'px/s' })
    expect(result.ok).toBe(true)
  })

  it('reports insufficient or degenerate samples safely', () => {
    const insufficient = fitted(
      trackFrom([0], () => ({ x: 0, y: 0 })),
      'constant-velocity',
    )
    expect(insufficient.ok).toBe(false)
    const degenerate = fitted(
      trackFrom([1, 1 + 1e-8], (_, index) => ({ x: index, y: 0 })),
      'constant-velocity',
    )
    expect(degenerate.ok).toBe(false)
    expect(JSON.stringify([insufficient, degenerate])).not.toMatch(/NaN|Infinity/)
  })
})

describe('constant-acceleration model fitting', () => {
  it('fits exact constant acceleration and non-zero initial velocity', () => {
    const result = fitted(
      trackFrom([0, 0.5, 1.5, 3, 5], (time) => ({
        x: 2 + 3 * time + 2 * time * time,
        y: -1 - time,
      })),
      'constant-acceleration',
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.fit.type !== 'constant-acceleration') return
    expect(result.fit).toMatchObject({
      x0: expect.closeTo(2),
      y0: expect.closeTo(-1),
      vx0: expect.closeTo(3),
      vy0: expect.closeTo(-1),
      ax: expect.closeTo(4),
      ay: expect.closeTo(0),
      initialSpeed: expect.closeTo(Math.sqrt(10)),
      accelerationMagnitude: expect.closeTo(4),
      rmse: expect.closeTo(0),
    })
  })

  it('fits an exact projectile-like X/Y trajectory at irregular timestamps', () => {
    const start = 8
    const times = [8, 8.2, 8.9, 10.4, 12.7, 15]
    const result = fitted(
      trackFrom(times, (time) => {
        const tau = time - start
        return { x: 4 + 6 * tau, y: 3 + 9 * tau - 4.9 * tau * tau }
      }),
      'constant-acceleration',
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.fit.type !== 'constant-acceleration') return
    expect(result.fit.t0).toBe(start)
    expect(result.fit.vx0).toBeCloseTo(6, 8)
    expect(result.fit.vy0).toBeCloseTo(9, 8)
    expect(result.fit.ax).toBeCloseTo(0, 8)
    expect(result.fit.ay).toBeCloseTo(-9.8, 8)
    expect(result.fit.rSquaredX).toBeCloseTo(1)
    expect(result.fit.rSquaredY).toBeCloseTo(1)
  })

  it('uses non-zero t0 without treating absolute media time as elapsed time', () => {
    const start = 120.25
    const times = [start, start + 0.3, start + 1, start + 2.7]
    const result = fitted(
      trackFrom(times, (time) => {
        const tau = time - start
        return { x: 50 - 2 * tau + 0.5 * tau * tau, y: 4 + tau }
      }),
      'constant-acceleration',
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.fit.type !== 'constant-acceleration') return
    expect(result.fit.t0).toBe(start)
    expect(result.fit.x0).toBeCloseTo(50)
    expect(result.fit.vx0).toBeCloseTo(-2)
    expect(result.fit.ax).toBeCloseTo(1)
  })

  it('degenerates cleanly toward linear motion when acceleration is zero', () => {
    const result = fitted(
      trackFrom([0, 0.5, 2, 4, 7], (time) => ({ x: 3 + 2 * time, y: -time })),
      'constant-acceleration',
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.fit.type !== 'constant-acceleration') return
    expect(result.fit.vx0).toBeCloseTo(2, 9)
    expect(result.fit.vy0).toBeCloseTo(-1, 9)
    expect(result.fit.ax).toBeCloseTo(0, 9)
    expect(result.fit.ay).toBeCloseTo(0, 9)
  })

  it('fits calibrated physical acceleration and preserves pixel fallback', () => {
    const calibration = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 20, y: 0 },
      knownDistance: 1,
      unit: 'm',
    })
    if (!calibration.ok) throw new Error('fixture calibration must be valid')
    const track = trackFrom([0, 1, 2, 3], (time) => ({ x: 20 * time * time, y: 0 }))
    const pixel = deriveTrackKinematics(track, null)
    const world = deriveTrackKinematics(track, calibration.calibration)
    const pixelFit = fitMotionModel(pixel, 'constant-acceleration', 'raw')
    const worldFit = fitMotionModel(world, 'constant-acceleration', 'raw')
    expect(pixel.accelerationUnit).toBe('px/s²')
    expect(world.accelerationUnit).toBe('m/s²')
    expect(pixelFit.ok && pixelFit.fit.type === 'constant-acceleration' ? pixelFit.fit.ax : null).toBeCloseTo(40)
    expect(worldFit.ok && worldFit.fit.type === 'constant-acceleration' ? worldFit.fit.ax : null).toBeCloseTo(2)
  })

  it('reports fewer than three samples and near-degenerate timing safely', () => {
    expect(fitted(
      trackFrom([0, 1], (time) => ({ x: time, y: 0 })),
      'constant-acceleration',
    ).ok).toBe(false)
    const degenerate = fitted(
      trackFrom([0, 1e-8, 2e-8], (time) => ({ x: time, y: time * time })),
      'constant-acceleration',
    )
    expect(degenerate.ok).toBe(false)
    expect(JSON.stringify(degenerate)).not.toMatch(/NaN|Infinity/)
  })

  it('evaluates analytic position, velocity, and acceleration without creating observations', () => {
    const track = trackFrom([2, 3, 5, 8], (time) => {
      const tau = time - 2
      return { x: 1 + 2 * tau + 1.5 * tau * tau, y: -tau }
    })
    const result = fitted(track, 'constant-acceleration')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const evaluated = evaluateMotionModel(result.fit, 4)
    expect(evaluated).toMatchObject({
      position: { x: expect.closeTo(11), y: expect.closeTo(-2) },
      velocity: { x: expect.closeTo(8), y: expect.closeTo(-1) },
      acceleration: { x: expect.closeTo(3), y: expect.closeTo(0) },
    })
    expect(track.samples).toHaveLength(4)
  })
})

describe('fit metrics', () => {
  it('computes vector RMSE and per-axis R² from residuals', () => {
    const result = fitted(
      trackFrom([0, 1, 2], (_, index) => ({
        x: [0, 2, 2][index]!,
        y: [0, 1, 3][index]!,
      })),
      'constant-velocity',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fit.rmse).toBeCloseTo(Math.sqrt(5 / 18), 10)
    expect(result.fit.rSquaredX).toBeCloseTo(0.75)
    expect(result.fit.rSquaredY).toBeCloseTo(0.9642857142857143)
  })

  it('never exposes non-finite scientific values', () => {
    const result = fitted(
      trackFrom([0, 0.25, 1.1, 3.8], (time) => ({ x: time ** 2, y: -time })),
      'constant-acceleration',
    )
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const numericValues = Object.values(result.fit).filter(
      (value): value is number => typeof value === 'number',
    )
    expect(numericValues.every(Number.isFinite)).toBe(true)
  })
})
