import type { FitDiagnostics } from '../analysis/fitDiagnostics'
import type {
  AnalysisSource,
  MotionModelFit,
  MotionModelType,
  TrackKinematics,
  VectorQuantity,
  VisualizationGroup,
} from '../analysis/types'
import type { Calibration } from '../calibration/types'
import type { Track } from '../tracking/types'

export const REPORT_SCHEMA_VERSION = 1

export const REPORT_GRAPH_TYPES = [
  'position-x',
  'position-y',
  'speed',
  'acceleration-magnitude',
  'observed-vs-fitted',
  'residual-magnitude',
  'residual-x',
  'residual-y',
] as const

export type ReportGraphType = (typeof REPORT_GRAPH_TYPES)[number]

export interface ReportMetadata {
  title: string
  author: string
  date: string
  course: string
  instructor: string
  description: string
  notes: string
}

export interface ReportPreferences {
  excludedTrackIds: string[]
  includedGraphs: ReportGraphType[]
  observationTableTrackIds: string[]
}

export interface ReportProjectState {
  schemaVersion: typeof REPORT_SCHEMA_VERSION
  metadata: ReportMetadata
  preferences: ReportPreferences
}

export interface ReportTrackAnalysisInput {
  track: Track
  rawAnalysis: TrackKinematics
  analysis: TrackKinematics | null
  fit: MotionModelFit | null
  diagnostics: FitDiagnostics | null
}

export interface ReportVideoInformation {
  filename: string
  duration: number | null
  width: number | null
  height: number | null
}

export interface ReportCalibrationInformation {
  calibrated: boolean
  unit: string
  scale: number | null
  origin: { x: number; y: number } | null
  originSource: Calibration['originSource'] | null
  xAxis: { x: number; y: number } | null
  axisSource: Calibration['axisSource'] | null
}

export interface ReportMeasurementSummary {
  initialPosition: VectorQuantity | null
  finalPosition: VectorQuantity | null
  displacement: VectorQuantity | null
  totalPathDistance: number | null
  averageVelocityX: number | null
  averageVelocityY: number | null
  averageSpeed: number | null
  maximumSpeed: number | null
  maximumAccelerationMagnitude: number | null
}

export interface ReportModelParameter {
  label: string
  value: number
  unit: string
}

export interface ReportModelFit {
  type: Exclude<MotionModelType, 'none'>
  name: string
  equations: [string, string]
  parameters: ReportModelParameter[]
  sampleCount: number
  timeSpan: number
  rSquaredX: number | null
  rSquaredY: number | null
  rmse: number
  mae: number
  maximumDeviation: number
  meanResidualX: number
  meanResidualY: number
}

export interface ReportPotentialDeviation {
  sampleId: string
  time: number
  residualMagnitude: number
  residualX: number
  residualY: number
}

export interface ReportObservation {
  sampleId: string
  time: number
  x: number
  y: number
  vx: number | null
  vy: number | null
  speed: number | null
  ax: number | null
  ay: number | null
  accelerationMagnitude: number | null
  predictedX: number | null
  predictedY: number | null
  residualX: number | null
  residualY: number | null
  residualMagnitude: number | null
}

export interface ReportGraph {
  type: ReportGraphType
  title: string
  group: VisualizationGroup
}

export interface ReportTrack {
  id: string
  name: string
  color: string
  markerCount: number
  observationCount: number
  firstObservationTime: number | null
  lastObservationTime: number | null
  trackedDuration: number | null
  analysisAvailable: boolean
  analysisUnavailableReason: string | null
  positionUnit: string
  velocityUnit: string
  accelerationUnit: string
  measurementSummary: ReportMeasurementSummary
  modelFit: ReportModelFit | null
  potentialDeviations: ReportPotentialDeviation[]
  graphs: ReportGraph[]
  includeObservationTable: boolean
  observations: ReportObservation[]
}

export interface ReportProvenance {
  motionLabVersion: string
  reportSchemaVersion: number
  calibrationUnit: string
  calibrationScale: number | null
  analyzedTrackCount: number
  generatedAt: string
  sourceVideoFilename: string
  analysisSource: AnalysisSource
}

export interface ExperimentReport {
  metadata: ReportMetadata
  displayTitle: string
  video: ReportVideoInformation
  calibration: ReportCalibrationInformation
  analysisTimeRange: { start: number; end: number } | null
  tracks: ReportTrack[]
  provenance: ReportProvenance
}

export interface BuildExperimentReportInput {
  reportState: ReportProjectState
  video: ReportVideoInformation
  calibration: Calibration | null
  analysisSource: AnalysisSource
  trackAnalyses: readonly ReportTrackAnalysisInput[]
  generatedAt: string
  motionLabVersion: string
}
