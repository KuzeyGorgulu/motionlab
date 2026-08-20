import type {
  AnalysisSource,
  MotionModelType,
  SmoothingWindowSize,
  VisualizationMode,
} from './types'

export interface AnalysisPanelState {
  expanded: boolean
  mode: VisualizationMode
  source: AnalysisSource
  model: MotionModelType
}

export type AnalysisPanelAction =
  | { type: 'toggle-expanded' }
  | { type: 'select-mode'; mode: VisualizationMode }
  | { type: 'select-source'; source: AnalysisSource['type'] }
  | { type: 'select-window'; windowSize: SmoothingWindowSize }
  | { type: 'select-model'; model: MotionModelType }

export const INITIAL_ANALYSIS_PANEL_STATE: AnalysisPanelState = {
  expanded: true,
  mode: 'position',
  source: { type: 'raw' },
  model: 'none',
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
    case 'select-source':
      return {
        ...state,
        source: action.source === 'raw'
          ? { type: 'raw' }
          : {
              type: 'smoothed',
              windowSize: state.source.type === 'smoothed'
                ? state.source.windowSize
                : 5,
            },
      }
    case 'select-window':
      return {
        ...state,
        source: { type: 'smoothed', windowSize: action.windowSize },
      }
    case 'select-model':
      return { ...state, model: action.model }
  }
}
