import type { DistanceUnit } from '../calibration/types'
import type { TrackSample } from '../tracking/types'
import type { Point } from '../video/geometry'

export type PositionUnit = DistanceUnit | 'px'
export type VelocityUnit = `${PositionUnit}/s`
export type AccelerationUnit = `${PositionUnit}/s²`
export type AnalysisSpace = 'pixel' | 'world'

export interface VectorQuantity extends Point {
  magnitude: number
}

export interface DisplacementQuantity extends VectorQuantity {
  dt: number
}

export interface KinematicSample {
  source: TrackSample
  position: Point
  positionMagnitude: number
  displacementFromPrevious: DisplacementQuantity | null
  cumulativeDistance: number | null
  velocity: VectorQuantity | null
  acceleration: VectorQuantity | null
}

export interface TrackKinematics {
  trackId: string
  space: AnalysisSpace
  positionUnit: PositionUnit
  velocityUnit: VelocityUnit
  accelerationUnit: AccelerationUnit
  samples: KinematicSample[]
}

export type GraphSeriesKey =
  | 'position-x'
  | 'position-y'
  | 'speed'
  | 'acceleration'

export interface GraphDataPoint {
  sampleId: string
  time: number
  value: number
}

export interface GraphSeries {
  key: GraphSeriesKey
  label: string
  axisLabel: string
  unit: PositionUnit | VelocityUnit | AccelerationUnit
  points: GraphDataPoint[]
}

export interface ChartPoint extends GraphDataPoint {
  x: number
  y: number
}

export interface ChartLayout {
  points: ChartPoint[]
  plot: { left: number; top: number; right: number; bottom: number }
  timeMin: number
  timeMax: number
  valueMin: number
  valueMax: number
}
