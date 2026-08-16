import type { Point } from '../video/geometry'

export const DISTANCE_UNITS = ['mm', 'cm', 'm', 'in', 'ft'] as const
export type DistanceUnit = (typeof DISTANCE_UNITS)[number]

export const DISTANCE_UNIT_LABELS: Record<DistanceUnit, string> = {
  mm: 'Millimeter',
  cm: 'Centimeter',
  m: 'Meter',
  in: 'Inch',
  ft: 'Foot',
}

export interface UnitVector {
  x: number
  y: number
}

export interface Calibration {
  referenceA: Point
  referenceB: Point
  knownDistance: number
  unit: DistanceUnit
  origin: Point
  originSource: 'reference-a' | 'custom'
  xAxis: UnitVector
  axisSource: 'reference' | 'custom'
}

export type CalibrationMode =
  | 'idle'
  | 'scale-points'
  | 'scale-values'
  | 'origin'
  | 'x-axis'

export interface CalibrationOverlayDraft {
  mode: Exclude<CalibrationMode, 'idle'>
  referencePoints: Point[]
  previewPoint: Point | null
}

export type CalibrationErrorCode =
  | 'non-finite-point'
  | 'zero-pixel-distance'
  | 'non-finite-distance'
  | 'non-positive-distance'
  | 'missing-unit'
  | 'degenerate-axis'

export interface CalibrationError {
  code: CalibrationErrorCode
  message: string
}

export type CalibrationResult =
  | { ok: true; calibration: Calibration }
  | { ok: false; errors: CalibrationError[] }

export interface CalibrationState {
  calibration: Calibration | null
}
