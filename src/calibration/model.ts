import { distanceBetweenPoints } from '../math/geometry'
import type { Point } from '../video/geometry'
import {
  DISTANCE_UNITS,
  type Calibration,
  type CalibrationError,
  type CalibrationResult,
  type DistanceUnit,
  type UnitVector,
} from './types'

const VECTOR_EPSILON = 1e-9

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function isDistanceUnit(unit: DistanceUnit | null): unit is DistanceUnit {
  return unit !== null && DISTANCE_UNITS.includes(unit)
}

function error(code: CalibrationError['code'], message: string): CalibrationError {
  return { code, message }
}

function normalizedDirection(from: Point, to: Point): UnitVector | null {
  if (!isFinitePoint(from) || !isFinitePoint(to)) {
    return null
  }

  const x = to.x - from.x
  const y = to.y - from.y
  const length = Math.hypot(x, y)
  if (!Number.isFinite(length) || length <= VECTOR_EPSILON) {
    return null
  }

  return { x: x / length, y: y / length }
}

export interface CreateCalibrationInput {
  referenceA: Point
  referenceB: Point
  knownDistance: number
  unit: DistanceUnit | null
}

export function createCalibration(
  input: CreateCalibrationInput,
): CalibrationResult {
  const errors: CalibrationError[] = []
  const finiteReferences =
    isFinitePoint(input.referenceA) && isFinitePoint(input.referenceB)
  if (!finiteReferences) {
    errors.push(error('non-finite-point', 'Calibration points must be finite.'))
  }

  const pixelDistance = finiteReferences
    ? distanceBetweenPoints(input.referenceA, input.referenceB)
    : null
  if (pixelDistance !== null && !Number.isFinite(pixelDistance)) {
    errors.push(
      error(
        'non-finite-point',
        'Calibration reference geometry must have a finite pixel distance.',
      ),
    )
  } else if (pixelDistance !== null && pixelDistance <= VECTOR_EPSILON) {
    errors.push(
      error(
        'zero-pixel-distance',
        'Reference points A and B must be different.',
      ),
    )
  }

  if (!Number.isFinite(input.knownDistance)) {
    errors.push(
      error('non-finite-distance', 'Known distance must be a finite number.'),
    )
  } else if (input.knownDistance <= 0) {
    errors.push(
      error('non-positive-distance', 'Known distance must be greater than zero.'),
    )
  }

  if (!isDistanceUnit(input.unit)) {
    errors.push(error('missing-unit', 'Choose a supported distance unit.'))
  }

  const xAxis = normalizedDirection(input.referenceA, input.referenceB)
  if (errors.length > 0 || xAxis === null || input.unit === null) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    calibration: {
      referenceA: input.referenceA,
      referenceB: input.referenceB,
      knownDistance: input.knownDistance,
      unit: input.unit,
      origin: input.referenceA,
      originSource: 'reference-a',
      xAxis,
      axisSource: 'reference',
    },
  }
}

export function updateCalibrationMeasurement(
  calibration: Calibration,
  knownDistance: number,
  unit: DistanceUnit | null,
): CalibrationResult {
  const recreated = createCalibration({
    referenceA: calibration.referenceA,
    referenceB: calibration.referenceB,
    knownDistance,
    unit,
  })
  if (!recreated.ok) {
    return recreated
  }

  return {
    ok: true,
    calibration: {
      ...calibration,
      knownDistance: recreated.calibration.knownDistance,
      unit: recreated.calibration.unit,
    },
  }
}

export function updateCalibrationOrigin(
  calibration: Calibration,
  origin: Point,
): CalibrationResult {
  if (!isFinitePoint(origin)) {
    return {
      ok: false,
      errors: [error('non-finite-point', 'Origin must be a finite video point.')],
    }
  }

  return {
    ok: true,
    calibration: { ...calibration, origin, originSource: 'custom' },
  }
}

export function updateCalibrationXAxis(
  calibration: Calibration,
  directionPoint: Point,
): CalibrationResult {
  if (!isFinitePoint(directionPoint)) {
    return {
      ok: false,
      errors: [error('non-finite-point', 'X-axis point must be finite.')],
    }
  }

  const xAxis = normalizedDirection(calibration.origin, directionPoint)
  if (xAxis === null) {
    return {
      ok: false,
      errors: [
        error(
          'degenerate-axis',
          'Positive X direction must be different from the origin.',
        ),
      ],
    }
  }

  return {
    ok: true,
    calibration: { ...calibration, xAxis, axisSource: 'custom' },
  }
}

export function calibrationPixelDistance(calibration: Calibration): number {
  return distanceBetweenPoints(calibration.referenceA, calibration.referenceB) ?? 0
}

export function unitsPerPixel(calibration: Calibration): number {
  const pixelDistance = calibrationPixelDistance(calibration)
  return pixelDistance > VECTOR_EPSILON
    ? calibration.knownDistance / pixelDistance
    : 0
}

/** Positive world Y is the image-space direction 90° counterclockwise from X. */
export function derivedYAxis(calibration: Calibration): UnitVector {
  return { x: calibration.xAxis.y, y: -calibration.xAxis.x }
}
