import { updateAnnotationHandle } from './model'
import type { Annotation } from './types'
import type { Point } from '../video/geometry'

export interface AnnotationSnapshot {
  annotations: Annotation[]
  selectedId: string | null
}

export interface AnnotationHistory {
  past: AnnotationSnapshot[]
  present: AnnotationSnapshot
  future: AnnotationSnapshot[]
}

export type AnnotationAction =
  | { type: 'select'; id: string | null }
  | { type: 'add'; annotation: Annotation }
  | { type: 'delete'; id: string }
  | { type: 'update-handle'; id: string; handleIndex: number; point: Point }
  | { type: 'undo' }
  | { type: 'redo' }

const HISTORY_LIMIT = 100

export function createAnnotationHistory(): AnnotationHistory {
  return {
    past: [],
    present: { annotations: [], selectedId: null },
    future: [],
  }
}

function commit(
  history: AnnotationHistory,
  next: AnnotationSnapshot,
): AnnotationHistory {
  if (next === history.present) {
    return history
  }

  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  }
}

export function annotationHistoryReducer(
  history: AnnotationHistory,
  action: AnnotationAction,
): AnnotationHistory {
  switch (action.type) {
    case 'select': {
      const selectedId = history.present.annotations.some(
        (annotation) => annotation.id === action.id,
      )
        ? action.id
        : null

      if (selectedId === history.present.selectedId) {
        return history
      }

      return {
        ...history,
        present: { ...history.present, selectedId },
      }
    }
    case 'add': {
      if (
        history.present.annotations.some(
          (annotation) => annotation.id === action.annotation.id,
        )
      ) {
        return history
      }

      return commit(history, {
        annotations: [...history.present.annotations, action.annotation],
        selectedId: action.annotation.id,
      })
    }
    case 'delete': {
      const annotations = history.present.annotations.filter(
        (annotation) => annotation.id !== action.id,
      )
      if (annotations.length === history.present.annotations.length) {
        return history
      }

      return commit(history, {
        annotations,
        selectedId:
          history.present.selectedId === action.id
            ? null
            : history.present.selectedId,
      })
    }
    case 'update-handle': {
      let changed = false
      const annotations = history.present.annotations.map((annotation) => {
        if (annotation.id !== action.id) {
          return annotation
        }

        const updated = updateAnnotationHandle(
          annotation,
          action.handleIndex,
          action.point,
        )
        changed = updated !== annotation
        return updated
      })

      return changed
        ? commit(history, { ...history.present, annotations })
        : history
    }
    case 'undo': {
      const previous = history.past.at(-1)
      if (previous === undefined) {
        return history
      }

      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      }
    }
    case 'redo': {
      const next = history.future[0]
      if (next === undefined) {
        return history
      }

      return {
        past: [...history.past, history.present].slice(-HISTORY_LIMIT),
        present: next,
        future: history.future.slice(1),
      }
    }
  }
}
