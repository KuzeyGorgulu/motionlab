import { describe, expect, it } from 'vitest'

import { deriveFitDiagnostics } from '../analysis/fitDiagnostics'
import { deriveTrackKinematics } from '../analysis/kinematics'
import { fitMotionModel } from '../analysis/modelFit'
import type { MotionModelType } from '../analysis/types'
import type { Calibration } from '../calibration/types'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import { buildExperimentReport, buildMeasurementSummary } from './builder'
import { createDefaultReportProjectState } from './projectState'
import type {
  BuildExperimentReportInput,
  ReportProjectState,
  ReportTrackAnalysisInput,
} from './types'

function track(
  id: string,
  points: Array<{ time: number; x: number; y: number }>,
): Track {
  return {
    id,
    name: `Track ${id}`,
    color: '#4ecdc4',
    samples: points.map((point, index) => ({
      id: `${id}-sample-${index}`,
      time: point.time,
      frame: createFrameReference(point.time),
      nativePosition: { x: point.x, y: point.y },
    })),
  }
}

function analyzedTrack(
  source: Track,
  calibration: Calibration | null = null,
  model: MotionModelType = 'none',
): ReportTrackAnalysisInput {
  const analysis = deriveTrackKinematics(source, calibration)
  const fitResult = model === 'none'
    ? null
    : fitMotionModel(analysis, model, 'raw')
  const fit = fitResult?.ok ? fitResult.fit : null
  return {
    track: source,
    rawAnalysis: analysis,
    analysis,
    fit,
    diagnostics: fit === null ? null : deriveFitDiagnostics(analysis, fit),
  }
}

function input(
  trackAnalyses: ReportTrackAnalysisInput[],
  reportState: ReportProjectState = createDefaultReportProjectState(),
  calibration: Calibration | null = null,
): BuildExperimentReportInput {
  return {
    reportState,
    video: {
      filename: 'experiment.webm',
      duration: 8,
      width: 1280,
      height: 720,
    },
    calibration,
    analysisSource: { type: 'raw' },
    trackAnalyses,
    generatedAt: '2026-08-20T12:00:00.000Z',
    motionLabVersion: '1.0.0',
  }
}

describe('experiment report builder', () => {
  it('maps existing kinematics into the scientific measurement summary', () => {
    const analysis = deriveTrackKinematics(track('linear', [
      { time: 0, x: 0, y: 0 },
      { time: 1, x: 3, y: 4 },
      { time: 2, x: 6, y: 8 },
    ]), null)
    const summary = buildMeasurementSummary(analysis)

    expect(summary.initialPosition).toEqual({ x: 0, y: 0, magnitude: 0 })
    expect(summary.finalPosition).toEqual({ x: 6, y: 8, magnitude: 10 })
    expect(summary.displacement).toEqual({ x: 6, y: 8, magnitude: 10 })
    expect(summary.totalPathDistance).toBe(10)
    expect(summary.averageVelocityX).toBe(3)
    expect(summary.averageVelocityY).toBe(4)
    expect(summary.averageSpeed).toBe(5)
    expect(summary.maximumSpeed).toBeCloseTo(5)
    expect(summary.maximumAccelerationMagnitude).toBeCloseTo(0)
  })

  it('keeps unavailable one-observation derivatives explicit', () => {
    const summary = buildMeasurementSummary(
      deriveTrackKinematics(track('single', [{ time: 1, x: 4, y: 7 }]), null),
    )
    expect(summary.displacement?.magnitude).toBe(0)
    expect(summary.totalPathDistance).toBe(0)
    expect(summary.averageVelocityX).toBeNull()
    expect(summary.averageSpeed).toBeNull()
    expect(summary.maximumSpeed).toBeNull()
    expect(summary.maximumAccelerationMagnitude).toBeNull()
  })

  it('maps metadata and uses the video name only when title is empty', () => {
    const state = createDefaultReportProjectState()
    state.metadata = {
      title: 'Ramp experiment',
      author: 'Ada',
      date: '2026-08-20',
      course: 'Mechanics',
      instructor: 'Dr. Lin',
      description: 'A cart on a ramp.',
      notes: 'Discuss friction.',
    }
    const report = buildExperimentReport(input([], state))
    expect(report.displayTitle).toBe('Ramp experiment')
    expect(report.metadata).toEqual(state.metadata)

    state.metadata.title = ''
    expect(buildExperimentReport(input([], state)).displayTitle).toBe('experiment')
  })

  it('builds a controlled empty report when video metadata and tracks are absent', () => {
    const report = buildExperimentReport({
      ...input([]),
      video: { filename: '', duration: null, width: null, height: null },
    })
    expect(report.displayTitle).toBe('MotionLab experiment')
    expect(report.video.duration).toBeNull()
    expect(report.analysisTimeRange).toBeNull()
    expect(report.tracks).toEqual([])
  })

  it('honors track inclusion without mutating source tracks', () => {
    const first = track('a', [{ time: 0, x: 0, y: 0 }])
    const second = track('b', [{ time: 1, x: 1, y: 1 }])
    const before = JSON.stringify([first, second])
    const state = createDefaultReportProjectState()
    state.preferences.excludedTrackIds = ['a']
    const report = buildExperimentReport(input([
      analyzedTrack(first),
      analyzedTrack(second),
    ], state))
    expect(report.tracks.map((item) => item.id)).toEqual(['b'])
    expect(JSON.stringify([first, second])).toBe(before)
  })

  it('uses current calibrated analysis units and scale', () => {
    const calibration: Calibration = {
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 100, y: 0 },
      knownDistance: 2,
      unit: 'm',
      origin: { x: 0, y: 0 },
      originSource: 'reference-a',
      xAxis: { x: 1, y: 0 },
      axisSource: 'reference',
    }
    const source = track('calibrated', [
      { time: 0, x: 0, y: 0 },
      { time: 1, x: 50, y: 0 },
    ])
    const report = buildExperimentReport(input([
      analyzedTrack(source, calibration),
    ], createDefaultReportProjectState(), calibration))
    expect(report.tracks[0]?.positionUnit).toBe('m')
    expect(report.tracks[0]?.measurementSummary.displacement?.x).toBe(1)
    expect(report.calibration.scale).toBe(0.02)
  })

  it('includes an existing fit and Phase 11 diagnostics without redefining them', () => {
    const source = track('fit', [0, 0.4, 1.1, 2, 3.5].map((time) => ({
      time,
      x: 2 + 3 * time,
      y: 8 - 2 * time,
    })))
    const prepared = analyzedTrack(source, null, 'constant-velocity')
    const reportTrack = buildExperimentReport(input([prepared])).tracks[0]!
    expect(reportTrack.modelFit?.name).toBe('Constant velocity')
    expect(reportTrack.modelFit?.rmse).toBe(prepared.diagnostics?.summary.rmse)
    expect(reportTrack.modelFit?.mae).toBe(prepared.diagnostics?.summary.mae)
    expect(reportTrack.modelFit?.parameters.map((item) => item.label)).toContain('vx')
  })

  it('omits model information when no fit exists', () => {
    const reportTrack = buildExperimentReport(input([
      analyzedTrack(track('none', [{ time: 0, x: 1, y: 2 }])),
    ])).tracks[0]!
    expect(reportTrack.modelFit).toBeNull()
    expect(reportTrack.potentialDeviations).toEqual([])
  })

  it('maps only statistically flagged Phase 11 observations as potential deviations', () => {
    const offsets = [-1, 0.5, -0.7, 1.1, -0.3, 0.8, 35, -0.6, 0.4, -1.2, 0.2]
    const prepared = analyzedTrack(track('outlier', offsets.map((offset, index) => ({
      time: index * 0.1,
      x: 20 + index * 5,
      y: 80 + offset,
    }))), null, 'constant-velocity')
    const reportTrack = buildExperimentReport(input([prepared])).tracks[0]!
    expect(reportTrack.potentialDeviations).toHaveLength(1)
    expect(reportTrack.potentialDeviations[0]?.sampleId).toBe('outlier-sample-6')
  })

  it('adds model predictions to an explicitly included observation table', () => {
    const state = createDefaultReportProjectState()
    state.preferences.observationTableTrackIds = ['table']
    const source = track('table', [0, 1, 2].map((time) => ({ time, x: time, y: 2 * time })))
    const reportTrack = buildExperimentReport(input([
      analyzedTrack(source, null, 'constant-velocity'),
    ], state)).tracks[0]!
    expect(reportTrack.includeObservationTable).toBe(true)
    expect(reportTrack.observations).toHaveLength(3)
    expect(reportTrack.observations[1]?.predictedX).toBeCloseTo(1)
    expect(reportTrack.observations[1]?.residualMagnitude).toBeCloseTo(0)
  })

  it('builds selected reusable graph groups and remains deterministic', () => {
    const state = createDefaultReportProjectState()
    state.preferences.includedGraphs = ['position-x', 'residual-y']
    const prepared = analyzedTrack(track('graphs', [0, 1, 2].map((time) => ({
      time,
      x: time,
      y: time * 2,
    }))), null, 'constant-velocity')
    const first = buildExperimentReport(input([prepared], state))
    const second = buildExperimentReport(input([prepared], state))
    expect(first).toEqual(second)
    expect(first.tracks[0]?.graphs.map((graph) => graph.type)).toEqual([
      'position-x',
      'residual-y',
    ])
  })

  it('retains track facts but exposes unavailable selected-source science safely', () => {
    const prepared = analyzedTrack(track('unavailable', [
      { time: 0, x: 1, y: 2 },
      { time: 1, x: 2, y: 3 },
    ]))
    prepared.analysis = null
    prepared.fit = null
    prepared.diagnostics = null
    const reportTrack = buildExperimentReport({
      ...input([prepared]),
      analysisSource: { type: 'smoothed', windowSize: 5 },
    }).tracks[0]!
    expect(reportTrack.observationCount).toBe(2)
    expect(reportTrack.analysisAvailable).toBe(false)
    expect(reportTrack.measurementSummary.maximumSpeed).toBeNull()
    expect(reportTrack.observations).toEqual([])
  })
})
