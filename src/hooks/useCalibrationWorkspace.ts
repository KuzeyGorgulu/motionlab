import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { createFrameReference, frameReferenceKey } from '../annotations/frameAssociation'
import {
  createCalibration,
  updateCalibrationMeasurement,
  updateCalibrationOrigin,
  updateCalibrationXAxis,
} from '../calibration/model'
import {
  calibrationReducer,
  createCalibrationState,
} from '../calibration/state'
import type {
  Calibration,
  CalibrationMode,
  CalibrationOverlayDraft,
  DistanceUnit,
} from '../calibration/types'
import type { Point } from '../video/geometry'

export interface CalibrationWorkspaceController {
  calibration: Calibration | null
  mode: CalibrationMode
  overlayDraft: CalibrationOverlayDraft | null
  knownDistanceInput: string
  unit: DistanceUnit
  error: string | null
  setKnownDistanceInput: (value: string) => void
  setUnit: (unit: DistanceUnit) => void
  beginScale: () => void
  beginOrigin: () => void
  beginXAxis: () => void
  cancelInteraction: () => void
  pointerDown: (point: Point) => void
  pointerMove: (point: Point | null) => void
  confirmScale: () => void
  updateMeasurement: () => void
  reset: () => void
}

function firstErrorMessage(
  result: ReturnType<typeof createCalibration>,
): string | null {
  return result.ok ? null : (result.errors[0]?.message ?? 'Calibration is invalid.')
}

export function useCalibrationWorkspace(
  currentTime: number,
): CalibrationWorkspaceController {
  const [state, dispatch] = useReducer(
    calibrationReducer,
    undefined,
    createCalibrationState,
  )
  const [mode, setMode] = useState<CalibrationMode>('idle')
  const [referencePoints, setReferencePoints] = useState<Point[]>([])
  const [previewPoint, setPreviewPoint] = useState<Point | null>(null)
  const [knownDistanceInput, setKnownDistanceInput] = useState('1')
  const [unit, setUnit] = useState<DistanceUnit>('m')
  const [error, setError] = useState<string | null>(null)
  const currentFrameKey = frameReferenceKey(createFrameReference(currentTime))
  const previousFrameKey = useRef(currentFrameKey)

  const overlayDraft = useMemo<CalibrationOverlayDraft | null>(
    () =>
      mode === 'idle'
        ? null
        : { mode, referencePoints, previewPoint },
    [mode, previewPoint, referencePoints],
  )

  const clearInteraction = useCallback(() => {
    setMode('idle')
    setReferencePoints([])
    setPreviewPoint(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (previousFrameKey.current !== currentFrameKey) {
      previousFrameKey.current = currentFrameKey
      clearInteraction()
    }
  }, [clearInteraction, currentFrameKey])

  const beginScale = useCallback(() => {
    setMode('scale-points')
    setReferencePoints([])
    setPreviewPoint(null)
    setError(null)
  }, [])

  const beginOrigin = useCallback(() => {
    if (state.calibration === null) return
    setMode('origin')
    setReferencePoints([])
    setPreviewPoint(null)
    setError(null)
  }, [state.calibration])

  const beginXAxis = useCallback(() => {
    if (state.calibration === null) return
    setMode('x-axis')
    setReferencePoints([])
    setPreviewPoint(null)
    setError(null)
  }, [state.calibration])

  const pointerDown = useCallback(
    (point: Point) => {
      if (mode === 'scale-points') {
        if (referencePoints.length === 0) {
          setReferencePoints([point])
          setPreviewPoint(null)
        } else {
          setReferencePoints([referencePoints[0]!, point])
          setPreviewPoint(null)
          setMode('scale-values')
        }
        return
      }

      if (mode === 'origin' && state.calibration !== null) {
        const result = updateCalibrationOrigin(state.calibration, point)
        if (result.ok) {
          dispatch({ type: 'set', calibration: result.calibration })
          clearInteraction()
        } else {
          setError(result.errors[0]?.message ?? 'Origin is invalid.')
        }
        return
      }

      if (mode === 'x-axis' && state.calibration !== null) {
        const result = updateCalibrationXAxis(state.calibration, point)
        if (result.ok) {
          dispatch({ type: 'set', calibration: result.calibration })
          clearInteraction()
        } else {
          setError(result.errors[0]?.message ?? 'X axis is invalid.')
        }
      }
    },
    [clearInteraction, mode, referencePoints, state.calibration],
  )

  const pointerMove = useCallback(
    (point: Point | null) => {
      if (mode === 'scale-points' || mode === 'origin' || mode === 'x-axis') {
        setPreviewPoint(point)
      }
    },
    [mode],
  )

  const confirmScale = useCallback(() => {
    if (referencePoints.length !== 2) {
      setError('Select both calibration reference points before confirming.')
      return
    }

    const result = createCalibration({
      referenceA: referencePoints[0]!,
      referenceB: referencePoints[1]!,
      knownDistance: Number(knownDistanceInput),
      unit,
    })
    if (!result.ok) {
      setError(firstErrorMessage(result))
      return
    }

    dispatch({ type: 'set', calibration: result.calibration })
    clearInteraction()
  }, [clearInteraction, knownDistanceInput, referencePoints, unit])

  const updateMeasurement = useCallback(() => {
    if (state.calibration === null) return
    const result = updateCalibrationMeasurement(
      state.calibration,
      Number(knownDistanceInput),
      unit,
    )
    if (!result.ok) {
      setError(firstErrorMessage(result))
      return
    }

    dispatch({ type: 'set', calibration: result.calibration })
    setError(null)
  }, [knownDistanceInput, state.calibration, unit])

  const reset = useCallback(() => {
    dispatch({ type: 'reset' })
    setKnownDistanceInput('1')
    setUnit('m')
    clearInteraction()
  }, [clearInteraction])

  return {
    calibration: state.calibration,
    mode,
    overlayDraft,
    knownDistanceInput,
    unit,
    error,
    setKnownDistanceInput,
    setUnit,
    beginScale,
    beginOrigin,
    beginXAxis,
    cancelInteraction: clearInteraction,
    pointerDown,
    pointerMove,
    confirmScale,
    updateMeasurement,
    reset,
  }
}
