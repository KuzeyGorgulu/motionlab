import type { GraphSeriesKey } from './types'

export interface AnalysisPanelState {
  expanded: boolean
  seriesKey: GraphSeriesKey
}

export type AnalysisPanelAction =
  | { type: 'toggle-expanded' }
  | { type: 'select-series'; seriesKey: GraphSeriesKey }

export const INITIAL_ANALYSIS_PANEL_STATE: AnalysisPanelState = {
  expanded: true,
  seriesKey: 'position-x',
}

export function reduceAnalysisPanelState(
  state: AnalysisPanelState,
  action: AnalysisPanelAction,
): AnalysisPanelState {
  switch (action.type) {
    case 'toggle-expanded':
      return { ...state, expanded: !state.expanded }
    case 'select-series':
      return { ...state, seriesKey: action.seriesKey }
  }
}
