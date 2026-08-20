import { createVectorQuantity } from '../analysis/kinematics'
import type { FitDiagnosticObservation } from '../analysis/fitDiagnostics'
import { unitsPerPixel } from '../calibration/model'
import type { KinematicSample, MotionModelFit, TrackKinematics } from '../analysis/types'
import { buildReportGraphs } from './graphs'
import type {
  BuildExperimentReportInput,
  ExperimentReport,
  ReportMeasurementSummary,
  ReportModelFit,
  ReportObservation,
  ReportTrack,
  ReportTrackAnalysisInput,
} from './types'

function maximum(values: readonly (number | null)[]): number | null {
  const finite = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  )
  return finite.length === 0 ? null : Math.max(...finite)
}

export function buildMeasurementSummary(
  analysis: TrackKinematics | null,
): ReportMeasurementSummary {
  const first = analysis?.samples[0]
  const last = analysis?.samples[analysis.samples.length - 1]
  if (analysis === null || first === undefined || last === undefined) {
    return {
      initialPosition: null,
      finalPosition: null,
      displacement: null,
      totalPathDistance: null,
      averageVelocityX: null,
      averageVelocityY: null,
      averageSpeed: null,
      maximumSpeed: null,
      maximumAccelerationMagnitude: null,
    }
  }

  const initialPosition = createVectorQuantity(first.position.x, first.position.y)
  const finalPosition = createVectorQuantity(last.position.x, last.position.y)
  const displacement = createVectorQuantity(
    last.position.x - first.position.x,
    last.position.y - first.position.y,
  )
  const duration = last.source.time - first.source.time
  const totalPathDistance = last.cumulativeDistance
  const validDuration = Number.isFinite(duration) && duration > 0
  return {
    initialPosition,
    finalPosition,
    displacement,
    totalPathDistance:
      totalPathDistance !== null && Number.isFinite(totalPathDistance)
        ? totalPathDistance
        : null,
    averageVelocityX:
      validDuration && displacement !== null ? displacement.x / duration : null,
    averageVelocityY:
      validDuration && displacement !== null ? displacement.y / duration : null,
    averageSpeed:
      validDuration && totalPathDistance !== null
        ? totalPathDistance / duration
        : null,
    maximumSpeed: maximum(
      analysis.samples.map((sample) => sample.velocity?.magnitude ?? null),
    ),
    maximumAccelerationMagnitude: maximum(
      analysis.samples.map((sample) => sample.acceleration?.magnitude ?? null),
    ),
  }
}

function modelParameters(
  fit: MotionModelFit,
  analysis: TrackKinematics,
): ReportModelFit['parameters'] {
  const shared = [
    { label: 't₀', value: fit.t0, unit: 's' },
    { label: 'x₀', value: fit.x0, unit: analysis.positionUnit },
    { label: 'y₀', value: fit.y0, unit: analysis.positionUnit },
  ]
  return fit.type === 'constant-velocity'
    ? [
        ...shared,
        { label: 'vx', value: fit.vx, unit: analysis.velocityUnit },
        { label: 'vy', value: fit.vy, unit: analysis.velocityUnit },
      ]
    : [
        ...shared,
        { label: 'vx₀', value: fit.vx0, unit: analysis.velocityUnit },
        { label: 'vy₀', value: fit.vy0, unit: analysis.velocityUnit },
        { label: 'ax', value: fit.ax, unit: analysis.accelerationUnit },
        { label: 'ay', value: fit.ay, unit: analysis.accelerationUnit },
      ]
}

function buildModelFit(
  input: ReportTrackAnalysisInput,
): ReportModelFit | null {
  if (input.analysis === null || input.fit === null || input.diagnostics === null) {
    return null
  }
  const { fit, diagnostics, analysis } = input
  return {
    type: fit.type,
    name: fit.type === 'constant-velocity'
      ? 'Constant velocity'
      : 'Constant acceleration',
    equations: fit.type === 'constant-velocity'
      ? ['x(t) = x₀ + vx(t − t₀)', 'y(t) = y₀ + vy(t − t₀)']
      : [
          'x(t) = x₀ + vx₀(t − t₀) + ½ax(t − t₀)²',
          'y(t) = y₀ + vy₀(t − t₀) + ½ay(t − t₀)²',
        ],
    parameters: modelParameters(fit, analysis),
    sampleCount: diagnostics.summary.sampleCount,
    timeSpan: diagnostics.summary.timeSpan,
    rSquaredX: diagnostics.summary.rSquaredX,
    rSquaredY: diagnostics.summary.rSquaredY,
    rmse: diagnostics.summary.rmse,
    mae: diagnostics.summary.mae,
    maximumDeviation: diagnostics.summary.maximumResidualMagnitude,
    meanResidualX: diagnostics.summary.meanResidualX,
    meanResidualY: diagnostics.summary.meanResidualY,
  }
}

function buildObservation(
  sample: KinematicSample,
  diagnostic: FitDiagnosticObservation | undefined,
): ReportObservation {
  return {
    sampleId: sample.source.id,
    time: sample.source.time,
    x: sample.position.x,
    y: sample.position.y,
    vx: sample.velocity?.x ?? null,
    vy: sample.velocity?.y ?? null,
    speed: sample.velocity?.magnitude ?? null,
    ax: sample.acceleration?.x ?? null,
    ay: sample.acceleration?.y ?? null,
    accelerationMagnitude: sample.acceleration?.magnitude ?? null,
    predictedX: diagnostic?.predictedX ?? null,
    predictedY: diagnostic?.predictedY ?? null,
    residualX: diagnostic?.residualX ?? null,
    residualY: diagnostic?.residualY ?? null,
    residualMagnitude: diagnostic?.residualMagnitude ?? null,
  }
}

function buildReportTrack(
  input: ReportTrackAnalysisInput,
  reportInput: BuildExperimentReportInput,
): ReportTrack {
  const selectedAnalysis = input.analysis
  const sourceSamples = input.rawAnalysis.samples
  const first = sourceSamples[0]
  const last = sourceSamples[sourceSamples.length - 1]
  const diagnostics = input.diagnostics
  const diagnosticBySampleId = new Map(
    diagnostics?.observations.map((observation) => [
      observation.sampleId,
      observation,
    ]) ?? [],
  )
  return {
    id: input.track.id,
    name: input.track.name,
    color: input.track.color,
    markerCount: input.track.samples.length,
    observationCount: sourceSamples.length,
    firstObservationTime: first?.source.time ?? null,
    lastObservationTime: last?.source.time ?? null,
    trackedDuration:
      first !== undefined && last !== undefined
        ? last.source.time - first.source.time
        : null,
    analysisAvailable: selectedAnalysis !== null,
    analysisUnavailableReason: selectedAnalysis === null
      ? `The selected ${reportInput.analysisSource.type} analysis source is unavailable for this track.`
      : null,
    positionUnit: selectedAnalysis?.positionUnit ?? input.rawAnalysis.positionUnit,
    velocityUnit: selectedAnalysis?.velocityUnit ?? input.rawAnalysis.velocityUnit,
    accelerationUnit:
      selectedAnalysis?.accelerationUnit ?? input.rawAnalysis.accelerationUnit,
    measurementSummary: buildMeasurementSummary(selectedAnalysis),
    modelFit: buildModelFit(input),
    potentialDeviations: diagnostics?.observations
      .filter((observation) => observation.potentialOutlier)
      .map((observation) => ({
        sampleId: observation.sampleId,
        time: observation.time,
        residualMagnitude: observation.residualMagnitude,
        residualX: observation.residualX,
        residualY: observation.residualY,
      })) ?? [],
    graphs: selectedAnalysis === null
      ? []
      : buildReportGraphs({
          analysis: selectedAnalysis,
          rawAnalysis: input.rawAnalysis,
          fit: input.fit,
          diagnostics,
          analysisSource: reportInput.analysisSource.type,
          includedGraphs: reportInput.reportState.preferences.includedGraphs,
        }),
    includeObservationTable:
      reportInput.reportState.preferences.observationTableTrackIds.includes(input.track.id),
    observations: selectedAnalysis?.samples.map((sample) =>
      buildObservation(sample, diagnosticBySampleId.get(sample.source.id))) ?? [],
  }
}

function fallbackTitle(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '').trim()
  return withoutExtension || filename || 'MotionLab experiment'
}

export function buildExperimentReport(
  input: BuildExperimentReportInput,
): ExperimentReport {
  const excluded = new Set(input.reportState.preferences.excludedTrackIds)
  const tracks = input.trackAnalyses
    .filter(({ track }) => !excluded.has(track.id))
    .map((track) => buildReportTrack(track, input))
  const times = tracks.flatMap((track) => [
    track.firstObservationTime,
    track.lastObservationTime,
  ]).filter((time): time is number => time !== null && Number.isFinite(time))
  const scale = input.calibration === null ? null : unitsPerPixel(input.calibration)

  return {
    metadata: { ...input.reportState.metadata },
    displayTitle:
      input.reportState.metadata.title.trim() || fallbackTitle(input.video.filename),
    video: { ...input.video },
    calibration: {
      calibrated: input.calibration !== null,
      unit: input.calibration?.unit ?? 'px',
      scale: scale !== null && Number.isFinite(scale) && scale > 0 ? scale : null,
      origin: input.calibration === null ? null : { ...input.calibration.origin },
      originSource: input.calibration?.originSource ?? null,
      xAxis: input.calibration === null ? null : { ...input.calibration.xAxis },
      axisSource: input.calibration?.axisSource ?? null,
    },
    analysisTimeRange: times.length === 0
      ? null
      : { start: Math.min(...times), end: Math.max(...times) },
    tracks,
    provenance: {
      motionLabVersion: input.motionLabVersion,
      reportSchemaVersion: input.reportState.schemaVersion,
      calibrationUnit: input.calibration?.unit ?? 'px',
      calibrationScale:
        scale !== null && Number.isFinite(scale) && scale > 0 ? scale : null,
      analyzedTrackCount: tracks.length,
      generatedAt: input.generatedAt,
      sourceVideoFilename: input.video.filename,
      analysisSource: { ...input.analysisSource },
    },
  }
}
