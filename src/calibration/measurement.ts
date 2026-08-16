import { angleBetweenThreePoints, distanceBetweenPoints } from '../math/geometry'
import type { Point } from '../video/geometry'
import { unitsPerPixel } from './model'
import { pixelToWorld } from './transform'
import type { Calibration, DistanceUnit } from './types'

export type LineMeasurement =
  | { kind: 'pixel'; value: number; unit: 'px' }
  | {
      kind: 'physical'
      value: number
      unit: DistanceUnit
      pixelValue: number
    }

export function measureLine(
  a: Point,
  b: Point,
  calibration: Calibration | null,
): LineMeasurement | null {
  const pixelValue = distanceBetweenPoints(a, b)
  if (pixelValue === null) {
    return null
  }

  if (calibration === null) {
    return { kind: 'pixel', value: pixelValue, unit: 'px' }
  }

  const scale = unitsPerPixel(calibration)
  if (!Number.isFinite(scale) || scale <= 0) {
    return null
  }

  return {
    kind: 'physical',
    value: pixelValue * scale,
    unit: calibration.unit,
    pixelValue,
  }
}

export function measurePoint(
  point: Point,
  calibration: Calibration | null,
): { position: Point; unit: DistanceUnit } | null {
  if (calibration === null) {
    return null
  }

  const position = pixelToWorld(point, calibration)
  return position === null ? null : { position, unit: calibration.unit }
}

export function formatMeasurementValue(value: number): string {
  const magnitude = Math.abs(value)
  const decimalPlaces = magnitude >= 100 ? 1 : magnitude >= 10 ? 2 : magnitude >= 1 ? 3 : 4
  return value.toFixed(decimalPlaces).replace(/\.?0+$/, '')
}

export function formatLineMeasurement(measurement: LineMeasurement): string {
  return measurement.kind === 'pixel'
    ? `${measurement.value.toFixed(1)} px`
    : `${formatMeasurementValue(measurement.value)} ${measurement.unit}`
}

export function angleAfterCalibration(
  a: Point,
  vertex: Point,
  b: Point,
  calibration: Calibration,
): number | null {
  const worldA = pixelToWorld(a, calibration)
  const worldVertex = pixelToWorld(vertex, calibration)
  const worldB = pixelToWorld(b, calibration)
  if (worldA === null || worldVertex === null || worldB === null) {
    return null
  }

  return angleBetweenThreePoints(worldA, worldVertex, worldB)
}
