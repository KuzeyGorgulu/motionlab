import { describe, expect, it } from 'vitest'

import {
  calibrationPixelDistance,
  createCalibration,
  derivedYAxis,
  unitsPerPixel,
  updateCalibrationMeasurement,
  updateCalibrationOrigin,
  updateCalibrationXAxis,
} from './model'

describe('calibration creation', () => {
  it('creates a valid uniform scale with documented defaults', () => {
    const result = createCalibration({
      referenceA: { x: 100, y: 200 },
      referenceB: { x: 600, y: 200 },
      knownDistance: 100,
      unit: 'cm',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(calibrationPixelDistance(result.calibration)).toBe(500)
    expect(unitsPerPixel(result.calibration)).toBe(0.2)
    expect(result.calibration.origin).toEqual({ x: 100, y: 200 })
    expect(result.calibration.xAxis).toEqual({ x: 1, y: 0 })
    expect(derivedYAxis(result.calibration)).toEqual({ x: 0, y: -1 })
  })

  it('rejects identical reference points', () => {
    const result = createCalibration({
      referenceA: { x: 1, y: 1 },
      referenceB: { x: 1, y: 1 },
      knownDistance: 1,
      unit: 'm',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((item) => item.code)).toContain('zero-pixel-distance')
  })

  it.each([0, -2])('rejects non-positive physical distance %s', (knownDistance) => {
    const result = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance,
      unit: 'm',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((item) => item.code)).toContain('non-positive-distance')
  })

  it('rejects non-finite values and a missing unit', () => {
    const result = createCalibration({
      referenceA: { x: Number.NaN, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: Number.POSITIVE_INFINITY,
      unit: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((item) => item.code)).toEqual([
      'non-finite-point',
      'non-finite-distance',
      'missing-unit',
    ])
  })

  it('rejects finite coordinates whose separation overflows', () => {
    const result = createCalibration({
      referenceA: { x: -Number.MAX_VALUE, y: 0 },
      referenceB: { x: Number.MAX_VALUE, y: 0 },
      knownDistance: 1,
      unit: 'm',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map((item) => item.code)).toContain('non-finite-point')
  })
})

describe('calibration editing', () => {
  const base = createCalibration({
    referenceA: { x: 0, y: 0 },
    referenceB: { x: 100, y: 0 },
    knownDistance: 10,
    unit: 'cm',
  })

  it('changes measurement metadata without rebuilding origin or axes', () => {
    if (!base.ok) throw new Error('fixture should be valid')
    const withOrigin = updateCalibrationOrigin(base.calibration, { x: 25, y: 40 })
    if (!withOrigin.ok) throw new Error('fixture origin should be valid')
    const edited = updateCalibrationMeasurement(withOrigin.calibration, 2, 'm')
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(edited.calibration.origin).toEqual({ x: 25, y: 40 })
    expect(edited.calibration.knownDistance).toBe(2)
    expect(edited.calibration.unit).toBe('m')
  })

  it('rejects a degenerate custom axis and accepts a rotated axis', () => {
    if (!base.ok) throw new Error('fixture should be valid')
    const invalid = updateCalibrationXAxis(base.calibration, base.calibration.origin)
    expect(invalid.ok).toBe(false)

    const rotated = updateCalibrationXAxis(base.calibration, { x: 10, y: 10 })
    expect(rotated.ok).toBe(true)
    if (!rotated.ok) return
    expect(rotated.calibration.xAxis.x).toBeCloseTo(Math.SQRT1_2)
    expect(rotated.calibration.xAxis.y).toBeCloseTo(Math.SQRT1_2)
  })
})
