import { describe, expect, it } from 'vitest'

import { createTrack, createTrackSample } from '../tracking/model'
import { createFrameReference } from '../video/frameReference'
import { deriveTrackKinematics } from './kinematics'
import {
  INITIAL_ANALYSIS_PANEL_STATE,
  reduceAnalysisPanelState,
} from './panelState'
import { selectVisualizationGroup } from './series'

function analyzedTrack(id: string, multiplier: number) {
  const track = createTrack(id, id, '#4ecdc4')!
  return deriveTrackKinematics(
    {
      ...track,
      samples: [0, 1, 2].map((time, index) =>
        createTrackSample(
          `${id}-${index}`,
          createFrameReference(time),
          { x: multiplier * time, y: 0 },
        )!,
      ),
    },
    null,
  )
}

describe('analysis panel state', () => {
  it('retains the visualization mode through collapse and reopen', () => {
    let state = reduceAnalysisPanelState(INITIAL_ANALYSIS_PANEL_STATE, {
      type: 'select-mode',
      mode: 'velocity',
    })
    const analysis = analyzedTrack('tracked', 3)
    const beforeCollapse = selectVisualizationGroup(analysis, state.mode)

    state = reduceAnalysisPanelState(state, { type: 'toggle-expanded' })
    expect(state).toMatchObject({ expanded: false, mode: 'velocity' })

    state = reduceAnalysisPanelState(state, { type: 'toggle-expanded' })
    expect(state).toMatchObject({ expanded: true, mode: 'velocity' })
    expect(selectVisualizationGroup(analysis, state.mode)).toEqual(beforeCollapse)
  })

  it('keeps the mode while newly derived active-track data updates', () => {
    const state = reduceAnalysisPanelState(INITIAL_ANALYSIS_PANEL_STATE, {
      type: 'select-mode',
      mode: 'position',
    })
    const first = selectVisualizationGroup(analyzedTrack('first', 2), state.mode)
    const second = selectVisualizationGroup(analyzedTrack('second', 5), state.mode)

    expect(first.series[0]?.points[2]).toMatchObject({ time: 2, value: 4 })
    expect(second.series[0]?.points[2]).toMatchObject({ time: 2, value: 10 })
    expect(state.mode).toBe('position')
  })

  it('defaults to raw/no-model and changes derived controls without touching other state', () => {
    expect(INITIAL_ANALYSIS_PANEL_STATE).toMatchObject({
      source: { type: 'raw' },
      model: 'none',
    })
    let state = reduceAnalysisPanelState(INITIAL_ANALYSIS_PANEL_STATE, {
      type: 'select-source',
      source: 'smoothed',
    })
    state = reduceAnalysisPanelState(state, {
      type: 'select-window',
      windowSize: 9,
    })
    state = reduceAnalysisPanelState(state, {
      type: 'select-model',
      model: 'constant-acceleration',
    })
    expect(state).toMatchObject({
      expanded: true,
      mode: 'position',
      source: { type: 'smoothed', windowSize: 9 },
      model: 'constant-acceleration',
    })
    expect(reduceAnalysisPanelState(state, {
      type: 'select-source',
      source: 'raw',
    }).source).toEqual({ type: 'raw' })
  })
})
