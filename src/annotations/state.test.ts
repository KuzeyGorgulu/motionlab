import { describe, expect, it } from 'vitest'

import { createFrameReference } from './frameAssociation'
import { buildAnnotation } from './model'
import {
  annotationHistoryReducer,
  createAnnotationHistory,
  type AnnotationHistory,
} from './state'

const frame = createFrameReference(0.5)
const point = buildAnnotation('point-1', 'point', frame, [{ x: 10, y: 20 }])!
const line = buildAnnotation('line-1', 'line', frame, [
  { x: 1, y: 2 },
  { x: 3, y: 4 },
])!

function reduce(
  history: AnnotationHistory,
  action: Parameters<typeof annotationHistoryReducer>[1],
) {
  return annotationHistoryReducer(history, action)
}

describe('annotation history reducer', () => {
  it('adds and selects a newly created annotation', () => {
    const history = reduce(createAnnotationHistory(), {
      type: 'add',
      annotation: point,
    })

    expect(history.present.annotations).toEqual([point])
    expect(history.present.selectedId).toBe(point.id)
  })

  it('updates an annotation while preserving its native coordinates exactly', () => {
    let history = reduce(createAnnotationHistory(), { type: 'add', annotation: line })
    history = reduce(history, {
      type: 'update-handle',
      id: line.id,
      handleIndex: 0,
      point: { x: 123.456, y: 789.012 },
    })

    expect(history.present.annotations[0]).toMatchObject({
      id: line.id,
      a: { x: 123.456, y: 789.012 },
      b: { x: 3, y: 4 },
    })
  })

  it('deletes only the requested annotation', () => {
    let history = reduce(createAnnotationHistory(), { type: 'add', annotation: point })
    history = reduce(history, { type: 'add', annotation: line })
    history = reduce(history, { type: 'delete', id: point.id })

    expect(history.present.annotations).toEqual([line])
  })

  it('undoes and redoes creation, deletion, and movement', () => {
    const initial = createAnnotationHistory()
    const created = reduce(initial, { type: 'add', annotation: point })
    const moved = reduce(created, {
      type: 'update-handle',
      id: point.id,
      handleIndex: 0,
      point: { x: 90, y: 80 },
    })
    const deleted = reduce(moved, { type: 'delete', id: point.id })

    const undoDelete = reduce(deleted, { type: 'undo' })
    const undoMove = reduce(undoDelete, { type: 'undo' })
    const undoCreate = reduce(undoMove, { type: 'undo' })
    expect(undoDelete.present.annotations[0]).toMatchObject({ point: { x: 90, y: 80 } })
    expect(undoMove.present.annotations[0]).toEqual(point)
    expect(undoCreate.present.annotations).toEqual([])

    const redoCreate = reduce(undoCreate, { type: 'redo' })
    const redoMove = reduce(redoCreate, { type: 'redo' })
    expect(redoMove.present.annotations[0]).toMatchObject({ point: { x: 90, y: 80 } })
  })
})
