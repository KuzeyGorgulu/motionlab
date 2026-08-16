import { describe, expect, it } from 'vitest'

import { createCalibration, updateCalibrationOrigin, updateCalibrationXAxis } from './model'
import { pixelToWorld, worldToPixel } from './transform'
import type { Calibration } from './types'

function standardCalibration(): Calibration {
  const result = createCalibration({
    referenceA: { x: 100, y: 200 },
    referenceB: { x: 200, y: 200 },
    knownDistance: 10,
    unit: 'cm',
  })
  if (!result.ok) throw new Error('fixture should be valid')
  return result.calibration
}

describe('pixelToWorld', () => {
  it('maps the translated origin to zero', () => {
    const base = standardCalibration()
    const changed = updateCalibrationOrigin(base, { x: 150, y: 250 })
    if (!changed.ok) throw new Error('fixture should be valid')
    expect(pixelToWorld({ x: 150, y: 250 }, changed.calibration)).toEqual({ x: 0, y: 0 })
  })

  it('uses rightward X and flips image-down into world-up Y', () => {
    const calibration = standardCalibration()
    expect(pixelToWorld({ x: 150, y: 150 }, calibration)).toEqual({ x: 5, y: 5 })
    expect(pixelToWorld({ x: 150, y: 250 }, calibration)).toEqual({ x: 5, y: -5 })
  })

  it('projects onto a rotated X-axis basis', () => {
    const base = standardCalibration()
    const rotated = updateCalibrationXAxis(base, { x: 200, y: 300 })
    if (!rotated.ok) throw new Error('fixture should be valid')

    const alongPositiveX = pixelToWorld({ x: 150, y: 250 }, rotated.calibration)
    expect(alongPositiveX?.x).toBeCloseTo(Math.sqrt(50))
    expect(alongPositiveX?.y).toBeCloseTo(0)
  })
})

describe('worldToPixel', () => {
  it('is the inverse of the standard transform', () => {
    const calibration = standardCalibration()
    expect(worldToPixel({ x: 5, y: 5 }, calibration)).toEqual({ x: 150, y: 150 })
  })

  it('round-trips through a translated, rotated calibration', () => {
    const base = standardCalibration()
    const translated = updateCalibrationOrigin(base, { x: 31.25, y: 82.75 })
    if (!translated.ok) throw new Error('fixture should be valid')
    const rotated = updateCalibrationXAxis(translated.calibration, { x: 80, y: 140 })
    if (!rotated.ok) throw new Error('fixture should be valid')

    const pixel = { x: 843.125, y: 511.75 }
    const world = pixelToWorld(pixel, rotated.calibration)
    expect(world).not.toBeNull()
    const roundTrip = worldToPixel(world!, rotated.calibration)
    expect(roundTrip?.x).toBeCloseTo(pixel.x, 10)
    expect(roundTrip?.y).toBeCloseTo(pixel.y, 10)
  })
})
