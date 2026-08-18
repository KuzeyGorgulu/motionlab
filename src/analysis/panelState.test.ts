import { describe, expect, it } from 'vitest'

import { createTrack, createTrackSample } from '../tracking/model'
import { createFrameReference } from '../video/frameReference'
import { deriveTrackKinematics } from './kinematics'
import {
  INITIAL_ANALYSIS_PANEL_STATE,
  reduceAnalysisPanelState,
} from './panelState'
import { selectGraphSeries } from './series'

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
  it('retains the selected graph through collapse and reopen', () => {
    let state = reduceAnalysisPanelState(INITIAL_ANALYSIS_PANEL_STATE, {
      type: 'select-series',
      seriesKey: 'speed',
    })
    const analysis = analyzedTrack('tracked', 3)
    const beforeCollapse = selectGraphSeries(analysis, state.seriesKey)

    state = reduceAnalysisPanelState(state, { type: 'toggle-expanded' })
    expect(state).toEqual({ expanded: false, seriesKey: 'speed' })

    state = reduceAnalysisPanelState(state, { type: 'toggle-expanded' })
    expect(state).toEqual({ expanded: true, seriesKey: 'speed' })
    expect(selectGraphSeries(analysis, state.seriesKey)).toEqual(beforeCollapse)
  })

  it('keeps the graph selection while newly derived active-track data updates', () => {
    const state = reduceAnalysisPanelState(INITIAL_ANALYSIS_PANEL_STATE, {
      type: 'select-series',
      seriesKey: 'position-x',
    })
    const first = selectGraphSeries(analyzedTrack('first', 2), state.seriesKey)
    const second = selectGraphSeries(analyzedTrack('second', 5), state.seriesKey)

    expect(first.points[2]).toMatchObject({ time: 2, value: 4 })
    expect(second.points[2]).toMatchObject({ time: 2, value: 10 })
    expect(state.seriesKey).toBe('position-x')
  })
})
