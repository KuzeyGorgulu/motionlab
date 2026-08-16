import type { Calibration, CalibrationState } from './types'

export type CalibrationAction =
  | { type: 'set'; calibration: Calibration }
  | { type: 'reset' }
  | { type: 'video-replaced' }

export function createCalibrationState(): CalibrationState {
  return { calibration: null }
}

export function calibrationReducer(
  state: CalibrationState,
  action: CalibrationAction,
): CalibrationState {
  switch (action.type) {
    case 'set':
      return state.calibration === action.calibration
        ? state
        : { calibration: action.calibration }
    case 'reset':
    case 'video-replaced':
      return createCalibrationState()
  }
}
