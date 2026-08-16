import { describe, expect, it } from 'vitest'

import { createCalibration } from './model'
import { calibrationReducer, createCalibrationState } from './state'

function validCalibration(distance = 10, unit: 'cm' | 'm' = 'cm') {
  const result = createCalibration({
    referenceA: { x: 0, y: 0 },
    referenceB: { x: 100, y: 0 },
    knownDistance: distance,
    unit,
  })
  if (!result.ok) throw new Error('fixture should be valid')
  return result.calibration
}

describe('calibration reducer', () => {
  it('creates and edits the active calibration', () => {
    const created = calibrationReducer(createCalibrationState(), {
      type: 'set',
      calibration: validCalibration(),
    })
    const editedCalibration = validCalibration(2, 'm')
    const edited = calibrationReducer(created, {
      type: 'set',
      calibration: editedCalibration,
    })

    expect(created.calibration?.knownDistance).toBe(10)
    expect(edited.calibration).toEqual(editedCalibration)
  })

  it('resets calibration without requiring annotation state', () => {
    const active = { calibration: validCalibration() }
    expect(calibrationReducer(active, { type: 'reset' })).toEqual({ calibration: null })
  })

  it('resets calibration when the video is replaced', () => {
    const active = { calibration: validCalibration() }
    expect(calibrationReducer(active, { type: 'video-replaced' })).toEqual({
      calibration: null,
    })
  })
})
