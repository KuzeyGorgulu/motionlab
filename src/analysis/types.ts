import type { DistanceUnit } from '../calibration/types'
import type { TrackSample } from '../tracking/types'
import type { Point } from '../video/geometry'

export type PositionUnit = DistanceUnit | 'px'
export type VelocityUnit = `${PositionUnit}/s`
export type AccelerationUnit = `${PositionUnit}/s²`
export type AnalysisSpace = 'pixel' | 'world'

export type SmoothingWindowSize = 5 | 7 | 9

export type AnalysisSource =
  | { type: 'raw' }
  | { type: 'smoothed'; windowSize: SmoothingWindowSize }

export type MotionModelType =
  | 'none'
  | 'constant-velocity'
  | 'constant-acceleration'

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

export interface SmoothedKinematicSample extends KinematicSample {
  velocity: VectorQuantity
  acceleration: VectorQuantity
  rawNativePosition: Point
  rawPosition: Point
  smoothedPosition: Point
  smoothedVelocity: VectorQuantity
  smoothedAcceleration: VectorQuantity
}

export interface SmoothedTrackKinematics extends TrackKinematics {
  analysisSource: { type: 'smoothed'; windowSize: SmoothingWindowSize }
  samples: SmoothedKinematicSample[]
}

export type SmoothingResult =
  | { ok: true; analysis: SmoothedTrackKinematics }
  | { ok: false; message: string }

export interface MotionFitMetrics {
  rmse: number
  rSquaredX: number | null
  rSquaredY: number | null
}

interface BaseMotionModelFit extends MotionFitMetrics {
  t0: number
  x0: number
  y0: number
  sampleCount: number
  timeSpan: number
  source: AnalysisSource['type']
}

export interface ConstantVelocityFit extends BaseMotionModelFit {
  type: 'constant-velocity'
  vx: number
  vy: number
  speed: number
}

export interface ConstantAccelerationFit extends BaseMotionModelFit {
  type: 'constant-acceleration'
  vx0: number
  vy0: number
  ax: number
  ay: number
  initialSpeed: number
  accelerationMagnitude: number
}

export type MotionModelFit = ConstantVelocityFit | ConstantAccelerationFit

export type MotionModelFitResult =
  | { ok: true; fit: MotionModelFit }
  | { ok: false; message: string }

export type VisualizationMode = 'position' | 'velocity' | 'acceleration'

export type VisualizationSeriesKey =
  | 'position-x'
  | 'position-y'
  | 'velocity-x'
  | 'velocity-y'
  | 'speed'
  | 'acceleration-x'
  | 'acceleration-y'
  | 'acceleration'

export type MarkerShape = 'circle' | 'square' | 'diamond'

export interface GraphDataPoint {
  sampleId: string
  time: number
  value: number
}

export interface AnalysisTimePoint {
  sampleId: string
  time: number
}

export interface VisualizationSeries {
  key: VisualizationSeriesKey
  label: string
  marker: MarkerShape
  points: GraphDataPoint[]
}

export interface VisualizationGroup {
  mode: VisualizationMode
  label: string
  axisLabel: string
  unit: PositionUnit | VelocityUnit | AccelerationUnit
  timeline: AnalysisTimePoint[]
  series: VisualizationSeries[]
  measuredSeries: VisualizationSeries[]
  modelSeries: VisualizationSeries[]
  analysisSource: AnalysisSource['type']
  modelType: MotionModelType
}

export interface ChartPoint extends GraphDataPoint {
  x: number
  y: number
}

export interface ChartPlot {
  left: number
  top: number
  right: number
  bottom: number
}

export interface TimeDomain {
  min: number
  max: number
  sourceMin: number
  sourceMax: number
}

export interface ChartSeriesLayout {
  key: VisualizationSeriesKey
  points: ChartPoint[]
}

export interface ChartLayout {
  series: ChartSeriesLayout[]
  plot: ChartPlot
  timeMin: number
  timeMax: number
  sourceTimeMin: number
  sourceTimeMax: number
  valueMin: number
  valueMax: number
}
