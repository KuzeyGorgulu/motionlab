import type { VisualizationMode } from './types'

export interface AnalysisPanelState {
  expanded: boolean
  mode: VisualizationMode
}

export type AnalysisPanelAction =
  | { type: 'toggle-expanded' }
  | { type: 'select-mode'; mode: VisualizationMode }

export const INITIAL_ANALYSIS_PANEL_STATE: AnalysisPanelState = {
  expanded: true,
  mode: 'position',
}

export function reduceAnalysisPanelState(
  state: AnalysisPanelState,
  action: AnalysisPanelAction,
): AnalysisPanelState {
  switch (action.type) {
    case 'toggle-expanded':
      return { ...state, expanded: !state.expanded }
    case 'select-mode':
      return { ...state, mode: action.mode }
  }
}
