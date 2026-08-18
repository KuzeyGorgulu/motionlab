import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { hitTestTrackSample } from '../tracking/hitTest'
import { createTrack, createTrackSample } from '../tracking/model'
import { activeTrack, currentFrameTrackSample } from '../tracking/selectors'
import {
  createTrackingHistory,
  trackingHistoryReducer,
} from '../tracking/state'
import {
  TRACK_COLORS,
  type Track,
  type TrackDragPreview,
  type TrackSample,
  type TrackingMode,
  type TrailMode,
} from '../tracking/types'
import type { Point } from '../video/geometry'
import {
  createFrameReference,
  frameReferenceKey,
} from '../video/frameReference'

interface DragState {
  trackId: string
  sampleId: string
  startPointer: Point
  nativePosition: Point
  activationDistance: number
  hasMoved: boolean
}

export interface TrackingPointerDownResult {
  capturePointer: boolean
  marked: boolean
}

export interface TrackingWorkspaceController {
  tracks: Track[]
  activeTrack: Track | null
  currentSample: TrackSample | null
  activeTrackId: string | null
  mode: TrackingMode
  trailMode: TrailMode
  advanceAfterMark: boolean
  dragPreview: TrackDragPreview | null
  canUndo: boolean
  canRedo: boolean
  createTrack: (name: string) => boolean
  renameTrack: (id: string, name: string) => void
  deleteTrack: (id: string) => void
  selectTrack: (id: string) => void
  beginMark: () => void
  beginEdit: () => void
  cancelInteraction: () => void
  setTrailMode: (mode: TrailMode) => void
  setAdvanceAfterMark: (enabled: boolean) => void
  deleteCurrentSample: () => void
  undo: () => void
  redo: () => void
  pointerDown: (
    point: Point,
    hitTolerance: number,
  ) => TrackingPointerDownResult
  pointerMove: (point: Point | null) => void
  pointerUp: (point: Point) => void
  pointerCancel: () => void
}

export function useTrackingWorkspace(
  currentTime: number,
): TrackingWorkspaceController {
  const [history, dispatch] = useReducer(
    trackingHistoryReducer,
    undefined,
    createTrackingHistory,
  )
  const [mode, setMode] = useState<TrackingMode>('idle')
  const [trailMode, setTrailMode] = useState<TrailMode>('past')
  const [advanceAfterMark, setAdvanceAfterMark] = useState(false)
  const [drag, setDrag] = useState<DragState | null>(null)
  const nextTrackId = useRef(1)
  const nextSampleId = useRef(1)
  const currentFrame = useMemo(
    () => createFrameReference(currentTime),
    [currentTime],
  )
  const currentFrameKey = frameReferenceKey(currentFrame)
  const previousFrameKey = useRef(currentFrameKey)
  const selectedTrack = useMemo(
    () => activeTrack(history.present),
    [history.present],
  )
  const currentSample = useMemo(
    () => currentFrameTrackSample(selectedTrack, currentFrame),
    [currentFrame, selectedTrack],
  )
  const dragPreview = useMemo<TrackDragPreview | null>(
    () =>
      drag === null
        ? null
        : {
            trackId: drag.trackId,
            sampleId: drag.sampleId,
            nativePosition: drag.nativePosition,
          },
    [drag],
  )

  useEffect(() => {
    if (previousFrameKey.current !== currentFrameKey) {
      previousFrameKey.current = currentFrameKey
      setDrag(null)
    }
  }, [currentFrameKey])

  useEffect(() => {
    if (selectedTrack === null && mode !== 'idle') setMode('idle')
  }, [mode, selectedTrack])

  const addTrack = useCallback((name: string): boolean => {
    const ordinal = nextTrackId.current
    const track = createTrack(
      `track-${ordinal}`,
      name,
      TRACK_COLORS[(ordinal - 1) % TRACK_COLORS.length]!,
    )
    if (track === null) return false
    nextTrackId.current += 1
    dispatch({ type: 'create-track', track })
    return true
  }, [])

  const cancelInteraction = useCallback(() => {
    setMode('idle')
    setDrag(null)
  }, [])

  const undo = useCallback(() => {
    setDrag(null)
    dispatch({ type: 'undo' })
  }, [])

  const redo = useCallback(() => {
    setDrag(null)
    dispatch({ type: 'redo' })
  }, [])

  const deleteCurrentSample = useCallback(() => {
    if (selectedTrack === null || currentSample === null) return
    setDrag(null)
    dispatch({
      type: 'delete-sample',
      trackId: selectedTrack.id,
      sampleId: currentSample.id,
    })
  }, [currentSample, selectedTrack])

  const pointerDown = useCallback(
    (point: Point, hitTolerance: number): TrackingPointerDownResult => {
      if (selectedTrack === null) {
        return { capturePointer: false, marked: false }
      }

      if (mode === 'mark') {
        const sample = createTrackSample(
          `sample-${nextSampleId.current}`,
          currentFrame,
          point,
        )
        if (sample === null) {
          return { capturePointer: false, marked: false }
        }
        nextSampleId.current += 1
        dispatch({ type: 'upsert-sample', trackId: selectedTrack.id, sample })
        return { capturePointer: false, marked: true }
      }

      if (mode === 'edit' && currentSample !== null) {
        const hit = hitTestTrackSample([currentSample], point, hitTolerance)
        if (hit !== null) {
          setDrag({
            trackId: selectedTrack.id,
            sampleId: hit.id,
            startPointer: point,
            nativePosition: hit.nativePosition,
            activationDistance: hitTolerance * 0.3,
            hasMoved: false,
          })
          return { capturePointer: true, marked: false }
        }
      }

      return { capturePointer: false, marked: false }
    },
    [currentFrame, currentSample, mode, selectedTrack],
  )

  const pointerMove = useCallback((point: Point | null) => {
    if (point === null) return
    setDrag((currentDrag) => {
      if (currentDrag === null) return null
      const distance = Math.hypot(
        point.x - currentDrag.startPointer.x,
        point.y - currentDrag.startPointer.y,
      )
      return {
        ...currentDrag,
        nativePosition: point,
        hasMoved:
          currentDrag.hasMoved || distance >= currentDrag.activationDistance,
      }
    })
  }, [])

  const pointerUp = useCallback((point: Point) => {
    setDrag((currentDrag) => {
      if (currentDrag !== null && currentDrag.hasMoved) {
        dispatch({
          type: 'update-sample-position',
          trackId: currentDrag.trackId,
          sampleId: currentDrag.sampleId,
          nativePosition: point,
        })
      }
      return null
    })
  }, [])

  return {
    tracks: history.present.tracks,
    activeTrack: selectedTrack,
    currentSample,
    activeTrackId: history.present.activeTrackId,
    mode,
    trailMode,
    advanceAfterMark,
    dragPreview,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    createTrack: addTrack,
    renameTrack: (id, name) => dispatch({ type: 'rename-track', id, name }),
    deleteTrack: (id) => {
      setDrag(null)
      dispatch({ type: 'delete-track', id })
    },
    selectTrack: (id) => {
      setDrag(null)
      dispatch({ type: 'set-active-track', id })
    },
    beginMark: () => {
      if (selectedTrack !== null) {
        setDrag(null)
        setMode('mark')
      }
    },
    beginEdit: () => {
      if (selectedTrack !== null) {
        setDrag(null)
        setMode('edit')
      }
    },
    cancelInteraction,
    setTrailMode,
    setAdvanceAfterMark,
    deleteCurrentSample,
    undo,
    redo,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel: () => setDrag(null),
  }
}
