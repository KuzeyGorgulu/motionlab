import { evaluateMotionModel } from './modelFit'
import type {
  AnalysisSource,
  MotionModelFit,
  PositionUnit,
  TrackKinematics,
} from './types'

export const MINIMUM_OUTLIER_SAMPLE_COUNT = 7
export const MAD_SCALE_FACTOR = 1.4826
export const OUTLIER_ROBUST_Z_THRESHOLD = 4

const NUMERIC_SPREAD_EPSILON = 1e-12

export interface FitDiagnosticObservation {
  sampleId: string
  time: number
  observedX: number
  observedY: number
  predictedX: number
  predictedY: number
  residualX: number
  residualY: number
  residualMagnitude: number
  potentialOutlier: boolean
}

export interface FitDiagnosticSummary {
  sampleCount: number
  timeSpan: number
  rmse: number
  mae: number
  maximumResidualMagnitude: number
  meanResidualX: number
  meanResidualY: number
  largestResidualSampleId: string
  largestResidualTime: number
  rSquaredX: number | null
  rSquaredY: number | null
}

export interface FitDiagnostics {
  source: AnalysisSource['type']
  modelType: MotionModelFit['type']
  positionUnit: PositionUnit
  observations: FitDiagnosticObservation[]
  rankedObservations: FitDiagnosticObservation[]
  summary: FitDiagnosticSummary
  residualMedian: number
  residualMad: number
  outlierThreshold: number | null
}

function median(values: readonly number[]): number | null {
  if (
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}

export function potentialOutlierThreshold(
  residualMagnitudes: readonly number[],
): { median: number; mad: number; threshold: number | null } | null {
  const residualMedian = median(residualMagnitudes)
  if (residualMedian === null) return null
  const residualMad = median(
    residualMagnitudes.map((magnitude) => Math.abs(magnitude - residualMedian)),
  )
  if (residualMad === null) return null
  if (residualMagnitudes.length < MINIMUM_OUTLIER_SAMPLE_COUNT) {
    return { median: residualMedian, mad: residualMad, threshold: null }
  }

  const scale = Math.max(1, Math.abs(residualMedian))
  if (residualMad <= scale * NUMERIC_SPREAD_EPSILON) {
    return { median: residualMedian, mad: residualMad, threshold: null }
  }

  const threshold =
    residualMedian +
    OUTLIER_ROBUST_Z_THRESHOLD * MAD_SCALE_FACTOR * residualMad
  return Number.isFinite(threshold)
    ? { median: residualMedian, mad: residualMad, threshold }
    : { median: residualMedian, mad: residualMad, threshold: null }
}

function compareRanked(
  left: FitDiagnosticObservation,
  right: FitDiagnosticObservation,
): number {
  return (
    right.residualMagnitude - left.residualMagnitude ||
    left.time - right.time ||
    left.sampleId.localeCompare(right.sampleId)
  )
}

export function deriveFitDiagnostics(
  analysis: TrackKinematics,
  fit: MotionModelFit,
): FitDiagnostics | null {
  const analysisSource = 'analysisSource' in analysis ? 'smoothed' : 'raw'
  if (
    analysis.samples.length === 0 ||
    analysis.samples.length !== fit.sampleCount ||
    !Number.isFinite(fit.rmse) ||
    fit.rmse < 0 ||
    fit.source !== analysisSource
  ) {
    return null
  }

  const baseObservations: FitDiagnosticObservation[] = []
  for (const sample of analysis.samples) {
    const evaluated = evaluateMotionModel(fit, sample.source.time)
    if (evaluated === null) return null
    const residualX = sample.position.x - evaluated.position.x
    const residualY = sample.position.y - evaluated.position.y
    const residualMagnitude = Math.hypot(residualX, residualY)
    const values = [
      sample.source.time,
      sample.position.x,
      sample.position.y,
      evaluated.position.x,
      evaluated.position.y,
      residualX,
      residualY,
      residualMagnitude,
    ]
    if (values.some((value) => !Number.isFinite(value))) return null
    baseObservations.push({
      sampleId: sample.source.id,
      time: sample.source.time,
      observedX: sample.position.x,
      observedY: sample.position.y,
      predictedX: evaluated.position.x,
      predictedY: evaluated.position.y,
      residualX,
      residualY,
      residualMagnitude,
      potentialOutlier: false,
    })
  }

  const outlierScale = potentialOutlierThreshold(
    baseObservations.map((observation) => observation.residualMagnitude),
  )
  if (outlierScale === null) return null
  const observations = baseObservations.map((observation) => ({
    ...observation,
    potentialOutlier:
      outlierScale.threshold !== null &&
      observation.residualMagnitude > outlierScale.threshold,
  }))
  const rankedObservations = [...observations].sort(compareRanked)
  const largest = rankedObservations[0]
  if (largest === undefined) return null
  const sampleCount = observations.length
  const sums = observations.reduce(
    (total, observation) => ({
      magnitude: total.magnitude + observation.residualMagnitude,
      x: total.x + observation.residualX,
      y: total.y + observation.residualY,
    }),
    { magnitude: 0, x: 0, y: 0 },
  )
  const summary: FitDiagnosticSummary = {
    sampleCount,
    timeSpan: fit.timeSpan,
    rmse: fit.rmse,
    mae: sums.magnitude / sampleCount,
    maximumResidualMagnitude: largest.residualMagnitude,
    meanResidualX: sums.x / sampleCount,
    meanResidualY: sums.y / sampleCount,
    largestResidualSampleId: largest.sampleId,
    largestResidualTime: largest.time,
    rSquaredX: fit.rSquaredX,
    rSquaredY: fit.rSquaredY,
  }
  if (
    Object.values(summary)
      .filter((value): value is number => typeof value === 'number')
      .some((value) => !Number.isFinite(value))
  ) {
    return null
  }

  return {
    source: fit.source,
    modelType: fit.type,
    positionUnit: analysis.positionUnit,
    observations,
    rankedObservations,
    summary,
    residualMedian: outlierScale.median,
    residualMad: outlierScale.mad,
    outlierThreshold: outlierScale.threshold,
  }
}
