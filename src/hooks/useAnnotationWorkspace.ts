import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import {
  annotationsForFrame,
  createFrameReference,
  frameReferenceKey,
} from '../annotations/frameAssociation'
import { hitTestAnnotations } from '../annotations/hitTest'
import {
  advanceAnnotationDraft,
  annotationPoints,
  buildAnnotation,
  updateAnnotationHandle,
} from '../annotations/model'
import {
  annotationHistoryReducer,
  createAnnotationHistory,
} from '../annotations/state'
import type {
  Annotation,
  AnnotationDraft,
  AnnotationTool,
} from '../annotations/types'
import type { Point } from '../video/geometry'

interface DragState {
  annotationId: string
  handleIndex: number
  originalPoint: Point
  startPointer: Point
  point: Point
  activationDistance: number
  hasMoved: boolean
}

export interface AnnotationWorkspaceController {
  annotations: Annotation[]
  activeTool: AnnotationTool
  currentAnnotations: Annotation[]
  renderedAnnotations: Annotation[]
  selectedId: string | null
  draft: AnnotationDraft | null
  canUndo: boolean
  canRedo: boolean
  setActiveTool: (tool: AnnotationTool) => void
  selectAnnotation: (id: string | null) => void
  deleteAnnotation: (id: string) => void
  deleteSelected: () => void
  undo: () => void
  redo: () => void
  cancelInteraction: () => void
  pointerDown: (point: Point, hitTolerance: number) => boolean
  pointerMove: (point: Point | null) => void
  pointerUp: (point: Point) => void
  pointerCancel: () => void
}

export function useAnnotationWorkspace(
  currentTime: number,
  initialAnnotations: readonly Annotation[] = [],
): AnnotationWorkspaceController {
  const [history, dispatch] = useReducer(
    annotationHistoryReducer,
    initialAnnotations,
    createAnnotationHistory,
  )
  const [activeTool, setActiveToolState] = useState<AnnotationTool>('select')
  const [draft, setDraft] = useState<AnnotationDraft | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const nextId = useRef(
    initialAnnotations.reduce((next, annotation) => {
      const match = /^annotation-(\d+)$/.exec(annotation.id)
      return match === null ? next : Math.max(next, Number(match[1]) + 1)
    }, 1),
  )

  const currentFrame = useMemo(
    () => createFrameReference(currentTime),
    [currentTime],
  )
  const currentFrameKey = frameReferenceKey(currentFrame)
  const currentAnnotations = useMemo(
    () => annotationsForFrame(history.present.annotations, currentFrame),
    [currentFrame, history.present.annotations],
  )

  const renderedAnnotations = useMemo(() => {
    if (drag === null || !drag.hasMoved) {
      return currentAnnotations
    }

    return currentAnnotations.map((annotation) =>
      annotation.id === drag.annotationId
        ? updateAnnotationHandle(annotation, drag.handleIndex, drag.point)
        : annotation,
    )
  }, [currentAnnotations, drag])

  useEffect(() => {
    setDraft(null)
    setDrag(null)
  }, [currentFrameKey])

  useEffect(() => {
    const selectedId = history.present.selectedId
    if (
      selectedId !== null &&
      !currentAnnotations.some((annotation) => annotation.id === selectedId)
    ) {
      dispatch({ type: 'select', id: null })
    }
  }, [currentAnnotations, history.present.selectedId])

  const setActiveTool = useCallback((tool: AnnotationTool) => {
    setActiveToolState(tool)
    setDraft(null)
    setDrag(null)
  }, [])

  const selectAnnotation = useCallback((id: string | null) => {
    dispatch({ type: 'select', id })
  }, [])

  const deleteAnnotation = useCallback((id: string) => {
    setDrag(null)
    dispatch({ type: 'delete', id })
  }, [])

  const deleteSelected = useCallback(() => {
    if (
      history.present.selectedId !== null &&
      currentAnnotations.some(
        (annotation) => annotation.id === history.present.selectedId,
      )
    ) {
      deleteAnnotation(history.present.selectedId)
    }
  }, [currentAnnotations, deleteAnnotation, history.present.selectedId])

  const cancelInteraction = useCallback(() => {
    setDraft(null)
    setDrag(null)
  }, [])

  const undo = useCallback(() => {
    cancelInteraction()
    dispatch({ type: 'undo' })
  }, [cancelInteraction])

  const redo = useCallback(() => {
    cancelInteraction()
    dispatch({ type: 'redo' })
  }, [cancelInteraction])

  const pointerDown = useCallback(
    (point: Point, hitTolerance: number): boolean => {
      if (activeTool !== 'select') {
        const advanced = advanceAnnotationDraft(activeTool, draft, point)
        setDraft(advanced.draft)

        if (advanced.completedPoints !== null) {
          const annotation = buildAnnotation(
            `annotation-${nextId.current}`,
            activeTool,
            createFrameReference(currentTime),
            advanced.completedPoints,
          )
          if (annotation !== null) {
            nextId.current += 1
            dispatch({ type: 'add', annotation })
          }
        }
        return false
      }

      const hit = hitTestAnnotations(currentAnnotations, point, hitTolerance)
      dispatch({ type: 'select', id: hit?.annotationId ?? null })
      if (hit === null || hit.handleIndex === null) {
        return false
      }

      const annotation = currentAnnotations.find(
        (candidate) => candidate.id === hit.annotationId,
      )
      const originalPoint =
        annotation === undefined
          ? undefined
          : annotationPoints(annotation)[hit.handleIndex]
      if (originalPoint === undefined) {
        return false
      }

      setDrag({
        annotationId: hit.annotationId,
        handleIndex: hit.handleIndex,
        originalPoint,
        startPointer: point,
        point: originalPoint,
        activationDistance: hitTolerance * 0.3,
        hasMoved: false,
      })
      return true
    },
    [activeTool, currentAnnotations, currentTime, draft],
  )

  const pointerMove = useCallback((point: Point | null) => {
    setDrag((currentDrag) => {
      if (currentDrag === null || point === null) {
        return currentDrag
      }

      const movement = Math.hypot(
        point.x - currentDrag.startPointer.x,
        point.y - currentDrag.startPointer.y,
      )
      return {
        ...currentDrag,
        point,
        hasMoved:
          currentDrag.hasMoved || movement >= currentDrag.activationDistance,
      }
    })

    setDraft((currentDraft) =>
      currentDraft === null ? null : { ...currentDraft, previewPoint: point },
    )
  }, [])

  const pointerUp = useCallback((point: Point) => {
    setDrag((currentDrag) => {
      if (currentDrag !== null && currentDrag.hasMoved) {
        dispatch({
          type: 'update-handle',
          id: currentDrag.annotationId,
          handleIndex: currentDrag.handleIndex,
          point,
        })
      }
      return null
    })
  }, [])

  const pointerCancel = useCallback(() => setDrag(null), [])

  return {
    annotations: history.present.annotations,
    activeTool,
    currentAnnotations,
    renderedAnnotations,
    selectedId: history.present.selectedId,
    draft,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    setActiveTool,
    selectAnnotation,
    deleteAnnotation,
    deleteSelected,
    undo,
    redo,
    cancelInteraction,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
  }
}
