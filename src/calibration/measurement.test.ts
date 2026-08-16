import { describe, expect, it } from 'vitest'

import { angleBetweenThreePoints } from '../annotations/measurement'
import { createCalibration, updateCalibrationMeasurement } from './model'
import {
  angleAfterCalibration,
  formatLineMeasurement,
  measureLine,
  measurePoint,
} from './measurement'

function calibration() {
  const result = createCalibration({
    referenceA: { x: 20, y: 30 },
    referenceB: { x: 220, y: 30 },
    knownDistance: 100,
    unit: 'cm',
  })
  if (!result.ok) throw new Error('fixture should be valid')
  return result.calibration
}

describe('calibrated measurements', () => {
  it('retains pixel measurements without calibration', () => {
    expect(measureLine({ x: 0, y: 0 }, { x: 30, y: 40 }, null)).toEqual({
      kind: 'pixel',
      value: 50,
      unit: 'px',
    })
  })

  it('converts a line to the active physical unit', () => {
    const measurement = measureLine(
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      calibration(),
    )
    expect(measurement).toEqual({
      kind: 'physical',
      value: 25,
      unit: 'cm',
      pixelValue: 50,
    })
    expect(formatLineMeasurement(measurement!)).toBe('25 cm')
  })

  it('derives new values when calibration changes without changing geometry', () => {
    const original = calibration()
    const changed = updateCalibrationMeasurement(original, 2, 'm')
    if (!changed.ok) throw new Error('fixture should be valid')
    const points = [{ x: 0, y: 0 }, { x: 30, y: 40 }] as const

    expect(measureLine(points[0], points[1], original)?.value).toBe(25)
    expect(measureLine(points[0], points[1], changed.calibration)?.value).toBe(0.5)
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 30, y: 40 }])
  })

  it('derives calibrated point coordinates from the native point', () => {
    expect(measurePoint({ x: 120, y: -70 }, calibration())).toEqual({
      position: { x: 50, y: 50 },
      unit: 'cm',
    })
  })

  it('leaves angles invariant under uniform calibration transforms', () => {
    const a = { x: 40, y: 30 }
    const vertex = { x: 80, y: 100 }
    const b = { x: 180, y: 60 }
    expect(angleAfterCalibration(a, vertex, b, calibration())).toBeCloseTo(
      angleBetweenThreePoints(a, vertex, b)!,
      10,
    )
  })
})
