import { describe, expect, it } from 'vitest'

import { deriveFitDiagnostics } from '../analysis/fitDiagnostics'
import { deriveTrackKinematics } from '../analysis/kinematics'
import { fitMotionModel } from '../analysis/modelFit'
import { buildExperimentReport } from '../report/builder'
import { createDefaultReportProjectState } from '../report/projectState'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import { createExperimentReportHtml } from './reportHtml'

function reportFixture() {
  const track: Track = {
    id: 'track-1',
    name: 'Cart <one>',
    color: '#4ecdc4',
    samples: [0, 1, 2].map((time) => ({
      id: `sample-${time}`,
      time,
      frame: createFrameReference(time),
      nativePosition: { x: 10 + time * 4, y: 30 - time * 2 },
    })),
  }
  const analysis = deriveTrackKinematics(track, null)
  const fitResult = fitMotionModel(analysis, 'constant-velocity', 'raw')
  if (!fitResult.ok) throw new Error('fixture fit failed')
  const diagnostics = deriveFitDiagnostics(analysis, fitResult.fit)
  if (diagnostics === null) throw new Error('fixture diagnostics failed')
  const state = createDefaultReportProjectState()
  state.metadata.title = 'Offline <report>'
  state.metadata.notes = 'Interpretation & discussion'
  state.preferences.includedGraphs = ['position-x', 'observed-vs-fitted', 'residual-y']
  state.preferences.observationTableTrackIds = [track.id]
  return buildExperimentReport({
    reportState: state,
    video: { filename: 'private-video.webm', duration: 2, width: 320, height: 180 },
    calibration: null,
    analysisSource: { type: 'raw' },
    trackAnalyses: [{
      track,
      rawAnalysis: analysis,
      analysis,
      fit: fitResult.fit,
      diagnostics,
    }],
    generatedAt: '2026-08-20T12:00:00.000Z',
    motionLabVersion: '0.1.0',
  })
}

describe('standalone experiment report HTML', () => {
  it('embeds metadata, summaries, models, selected graphs, tables, and provenance', () => {
    const result = createExperimentReportHtml(reportFixture())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.html).toMatch(/^<!doctype html>/)
    expect(result.html).toContain('Offline &lt;report&gt;')
    expect(result.html).toContain('Measurement Summary')
    expect(result.html).toContain('Constant velocity')
    expect(result.html).toContain('Observed vs Fitted Position')
    expect(result.html).toContain('<svg')
    expect(result.html).toContain('<th>Pred. X</th>')
    expect(result.html).toContain('Interpretation &amp; discussion')
    expect(result.html).toContain('Measurements were derived from video-based tracking')
  })

  it('is offline and never embeds the original video', () => {
    const result = createExperimentReportHtml(reportFixture())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.html).not.toMatch(/<(?:video|script|link)\b/i)
    expect(result.html).not.toMatch(/(?:src|href)=["']https?:\/\//i)
    expect(result.html).not.toContain('data:video')
    expect(result.html).toContain('<style>')
  })
})
