import { describe, expect, it } from 'vitest'

import { createCalibration } from '../calibration/model'
import { createMotionLabProject, serializeMotionLabProject } from '../project/serialize'
import { createTrack, createTrackSample } from '../tracking/model'
import { createTrackingHistory, trackingHistoryReducer } from '../tracking/state'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import { deriveFitDiagnostics } from './fitDiagnostics'
import { deriveTrackKinematics } from './kinematics'
import { fitMotionModel } from './modelFit'
import { INITIAL_ANALYSIS_PANEL_STATE, reduceAnalysisPanelState } from './panelState'
import { deriveSmoothedTrackKinematics } from './smoothing'
import type { AnalysisSource, MotionModelType, TrackKinematics } from './types'

function diagnosticTrack(): Track {
  const times = [0, 0.35, 0.9, 1.6, 2.4, 3.5, 4.7, 6, 7.4]
  const noise = [-0.6, 0.3, -0.2, 0.8, -0.4, 6, 0.2, -0.5, 0.1]
  return {
    ...createTrack('phase-11-track', 'Residual test', '#4ecdc4')!,
    samples: times.map((time, index) => createTrackSample(
      `phase-11-${index}`,
      createFrameReference(time),
      {
        x: 5 + 3 * time + noise[index]!,
        y: 20 - 2 * time + noise[index]! * 0.4,
      },
    )!),
  }
}

function diagnosticsFor(
  analysis: TrackKinematics | null,
  source: AnalysisSource['type'],
  model: MotionModelType,
) {
  if (analysis === null || model === 'none') return null
  const fit = fitMotionModel(analysis, model, source)
  return fit.ok ? deriveFitDiagnostics(analysis, fit.fit) : null
}

describe('Phase 11 fit diagnostic integration boundaries', () => {
  it('model activation produces diagnostics and Model None removes them', () => {
    const analysis = deriveTrackKinematics(diagnosticTrack(), null)
    expect(diagnosticsFor(analysis, 'raw', 'none')).toBeNull()
    const diagnostics = diagnosticsFor(analysis, 'raw', 'constant-velocity')
    expect(diagnostics).not.toBeNull()
    expect(diagnostics?.observations).toHaveLength(analysis.samples.length)
  })

  it('recomputes diagnostics when Raw changes to Smoothed', () => {
    const track = diagnosticTrack()
    const raw = deriveTrackKinematics(track, null)
    const smoothed = deriveSmoothedTrackKinematics(track, null, 5)
    expect(smoothed.ok).toBe(true)
    if (!smoothed.ok) return
    const rawDiagnostics = diagnosticsFor(raw, 'raw', 'constant-velocity')
    const smoothedDiagnostics = diagnosticsFor(
      smoothed.analysis,
      'smoothed',
      'constant-velocity',
    )
    expect(rawDiagnostics?.source).toBe('raw')
    expect(smoothedDiagnostics?.source).toBe('smoothed')
    expect(smoothedDiagnostics?.observations.map((item) => item.residualMagnitude))
      .not.toEqual(rawDiagnostics?.observations.map((item) => item.residualMagnitude))
    expect(track.samples.map((sample) => sample.nativePosition))
      .toEqual(diagnosticTrack().samples.map((sample) => sample.nativePosition))
  })

  it('recomputes calibrated diagnostics in position units without changing samples', () => {
    const track = diagnosticTrack()
    const before = structuredClone(track.samples)
    const calibration = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 20, y: 0 },
      knownDistance: 1,
      unit: 'm',
    })
    if (!calibration.ok) throw new Error('calibration fixture failed')
    const pixelDiagnostics = diagnosticsFor(
      deriveTrackKinematics(track, null),
      'raw',
      'constant-velocity',
    )
    const worldDiagnostics = diagnosticsFor(
      deriveTrackKinematics(track, calibration.calibration),
      'raw',
      'constant-velocity',
    )
    expect(pixelDiagnostics?.positionUnit).toBe('px')
    expect(worldDiagnostics?.positionUnit).toBe('m')
    expect(worldDiagnostics?.summary.maximumResidualMagnitude).toBeCloseTo(
      (pixelDiagnostics?.summary.maximumResidualMagnitude ?? 0) / 20,
    )
    expect(track.samples).toEqual(before)
  })

  it('keeps ranked rows tied to exact observation anchors', () => {
    const track = diagnosticTrack()
    const diagnostics = diagnosticsFor(
      deriveTrackKinematics(track, null),
      'raw',
      'constant-velocity',
    )
    for (const observation of diagnostics?.rankedObservations ?? []) {
      const sample = track.samples.find((item) => item.id === observation.sampleId)
      expect(observation.time).toBe(sample?.time)
      expect(observation.time).toBe(sample?.frame.anchorTime)
    }
  })

  it('recomputes after editing and undo restores prior diagnostics', () => {
    const track = diagnosticTrack()
    const initial = diagnosticsFor(
      deriveTrackKinematics(track, null),
      'raw',
      'constant-velocity',
    )
    let history = createTrackingHistory({ tracks: [track], activeTrackId: track.id })
    history = trackingHistoryReducer(history, {
      type: 'update-sample-position',
      trackId: track.id,
      sampleId: 'phase-11-5',
      nativePosition: { x: 25.5, y: 13 },
    })
    const editedTrack = history.present.tracks[0]!
    const edited = diagnosticsFor(
      deriveTrackKinematics(editedTrack, null),
      'raw',
      'constant-velocity',
    )
    expect(edited?.summary.maximumResidualMagnitude)
      .not.toBe(initial?.summary.maximumResidualMagnitude)

    history = trackingHistoryReducer(history, { type: 'undo' })
    const restored = diagnosticsFor(
      deriveTrackKinematics(history.present.tracks[0]!, null),
      'raw',
      'constant-velocity',
    )
    expect(restored).toEqual(initial)
  })

  it('keeps diagnostic selection/view outside tracking history and project version 1', () => {
    const track = diagnosticTrack()
    const history = createTrackingHistory({ tracks: [track], activeTrackId: track.id })
    let panel = reduceAnalysisPanelState(INITIAL_ANALYSIS_PANEL_STATE, {
      type: 'select-model',
      model: 'constant-velocity',
    })
    panel = reduceAnalysisPanelState(panel, { type: 'select-view', view: 'residuals' })
    panel = reduceAnalysisPanelState(panel, {
      type: 'select-residual-mode',
      mode: 'residual-x',
    })
    const selectedResidualSampleId = 'phase-11-5'
    expect(history).toEqual(createTrackingHistory({ tracks: [track], activeTrackId: track.id }))
    expect(selectedResidualSampleId).toBe(track.samples[5]?.id)

    const project = createMotionLabProject({
      videoName: 'phase-11.webm',
      metadata: { width: 320, height: 180, duration: 8 },
      annotations: [],
      calibration: null,
      tracks: [track],
      activeTrackId: track.id,
      trailMode: 'past',
      advanceAfterMark: false,
      analysisMode: panel.mode,
      analysisExpanded: panel.expanded,
      mediaTime: 0,
    })
    const serialized = serializeMotionLabProject(project)
    expect(serialized.ok).toBe(true)
    if (!serialized.ok) return
    expect(JSON.parse(serialized.text)).toMatchObject({ version: 1 })
    expect(serialized.text).not.toMatch(
      /"(?:analysisView|residualMode|fitDiagnostics|potentialOutlier|selectedResidualSampleId)"\s*:/i,
    )
  })
})
