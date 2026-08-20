import { describe, expect, it } from 'vitest'

import { deriveTrackKinematics } from '../analysis/kinematics'
import { deriveFitDiagnostics } from '../analysis/fitDiagnostics'
import { fitMotionModel } from '../analysis/modelFit'
import {
  selectResidualVisualizationGroup,
  selectVisualizationGroup,
} from '../analysis/series'
import { deriveSmoothedTrackKinematics } from '../analysis/smoothing'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import { createGraphSvg } from './graphSvg'

function trackWithSamples(): Track {
  return {
    id: 'track-1',
    name: 'Ball <A>',
    color: '#4ecdc4',
    samples: [0, 1, 2].map((time) => ({
      id: `sample-${time}`,
      time,
      frame: createFrameReference(time),
      nativePosition: { x: time * 10, y: time * 5 },
    })),
  }
}

describe('graph SVG export', () => {
  it('exports the current graph with title, axes, units, and no UI chrome', () => {
    const track = trackWithSamples()
    const group = selectVisualizationGroup(
      deriveTrackKinematics(track, null),
      'position',
    )
    const result = createGraphSvg(group, track.name, track.color)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.svg).toContain('Ball &lt;A&gt; — Position')
    expect(result.svg).toContain('Time (s)')
    expect(result.svg).toContain('Position (px)')
    expect(result.svg).not.toMatch(/playhead|cursor|interaction-area/)
  })

  it('fails clearly when the selected graph has no derived values', () => {
    const track = { ...trackWithSamples(), samples: trackWithSamples().samples.slice(0, 1) }
    const group = selectVisualizationGroup(
      deriveTrackKinematics(track, null),
      'acceleration',
    )
    expect(createGraphSvg(group, track.name, track.color)).toMatchObject({
      ok: false,
    })
  })

  it('supports every existing analysis graph family', () => {
    const track = trackWithSamples()
    const analysis = deriveTrackKinematics(track, null)
    for (const mode of ['position', 'velocity', 'acceleration'] as const) {
      const group = selectVisualizationGroup(analysis, mode)
      const result = createGraphSvg(group, track.name, track.color)
      expect(result.ok, mode).toBe(true)
      if (result.ok) expect(result.svg).toContain(group.axisLabel)
    }
  })

  it('exports measured, smoothed, and model-fit layers from the current visualization', () => {
    const track: Track = {
      ...trackWithSamples(),
      samples: [0, 0.4, 1.1, 2, 3.2, 4.8, 6.5].map((time, index) => ({
        id: `layer-${index}`,
        time,
        frame: createFrameReference(time),
        nativePosition: {
          x: 5 + 2 * time + [1, -1, 0.5, -0.8, 1, -0.4, 0.6][index]!,
          y: time * time,
        },
      })),
    }
    const raw = deriveTrackKinematics(track, null)
    const smoothed = deriveSmoothedTrackKinematics(track, null, 5)
    expect(smoothed.ok).toBe(true)
    if (!smoothed.ok) return
    const fit = fitMotionModel(
      smoothed.analysis,
      'constant-acceleration',
      'smoothed',
    )
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    const group = selectVisualizationGroup(smoothed.analysis, 'position', {
      analysisSource: 'smoothed',
      rawAnalysis: raw,
      modelFit: fit.fit,
    })
    const result = createGraphSvg(group, track.name, track.color)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.svg).toContain('Measured')
    expect(result.svg).toContain('Smoothed')
    expect(result.svg).toContain('Model fit')
    expect(result.svg).toContain('stroke-dasharray="8 6"')
    expect(result.svg).not.toMatch(/playhead|cursor|interaction-area|point-hit/)
  })

  it('exports residual markers, units, outlier indication, and signed zero baseline', () => {
    const noise = [-1, 0.5, -0.7, 1.1, -0.3, 0.8, 35, -0.6, 0.4, -1.2, 0.2]
    const track: Track = {
      ...trackWithSamples(),
      name: 'Diagnostic ball',
      samples: noise.map((offset, index) => ({
        id: `residual-${index}`,
        time: index * 0.1,
        frame: createFrameReference(index * 0.1),
        nativePosition: { x: 20 + 5 * index, y: 80 + offset },
      })),
    }
    const analysis = deriveTrackKinematics(track, null)
    const fit = fitMotionModel(analysis, 'constant-velocity', 'raw')
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    const diagnostics = deriveFitDiagnostics(analysis, fit.fit)
    expect(diagnostics).not.toBeNull()
    if (diagnostics === null) return

    const magnitude = createGraphSvg(
      selectResidualVisualizationGroup(diagnostics, 'residual-magnitude'),
      track.name,
      track.color,
    )
    expect(magnitude.ok).toBe(true)
    if (!magnitude.ok) return
    expect(magnitude.svg).toContain('Diagnostic ball — Residual magnitude')
    expect(magnitude.svg).toContain('Fit residual (px)')
    expect(magnitude.svg).toContain('Potential outlier')
    expect(magnitude.svg).toContain('stroke-dasharray="3 3"')
    expect(magnitude.svg).not.toMatch(/playhead|cursor|interaction-area|point-hit/)

    const signed = createGraphSvg(
      selectResidualVisualizationGroup(diagnostics, 'residual-y'),
      track.name,
      track.color,
    )
    expect(signed.ok).toBe(true)
    if (signed.ok) expect(signed.svg).toContain('data-role="zero-baseline"')
  })
})
