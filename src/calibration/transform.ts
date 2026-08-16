import type { Point } from '../video/geometry'
import { derivedYAxis, unitsPerPixel } from './model'
import type { Calibration } from './types'

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export function pixelToWorld(
  point: Point,
  calibration: Calibration,
): Point | null {
  const scale = unitsPerPixel(calibration)
  if (!isFinitePoint(point) || !Number.isFinite(scale) || scale <= 0) {
    return null
  }

  const delta = {
    x: point.x - calibration.origin.x,
    y: point.y - calibration.origin.y,
  }
  const yAxis = derivedYAxis(calibration)

  return {
    x: (delta.x * calibration.xAxis.x + delta.y * calibration.xAxis.y) * scale,
    y: (delta.x * yAxis.x + delta.y * yAxis.y) * scale,
  }
}

export function worldToPixel(
  worldPoint: Point,
  calibration: Calibration,
): Point | null {
  const scale = unitsPerPixel(calibration)
  if (!isFinitePoint(worldPoint) || !Number.isFinite(scale) || scale <= 0) {
    return null
  }

  const yAxis = derivedYAxis(calibration)
  const worldXInPixels = worldPoint.x / scale
  const worldYInPixels = worldPoint.y / scale

  return {
    x:
      calibration.origin.x +
      worldXInPixels * calibration.xAxis.x +
      worldYInPixels * yAxis.x,
    y:
      calibration.origin.y +
      worldXInPixels * calibration.xAxis.y +
      worldYInPixels * yAxis.y,
  }
}
