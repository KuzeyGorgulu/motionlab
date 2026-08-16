import { describe, expect, it } from 'vitest'

import { createFrameReference } from './frameAssociation'
import {
  advanceAnnotationDraft,
  buildAnnotation,
  updateAnnotationHandle,
} from './model'

describe('annotation creation state transitions', () => {
  it('completes a point in one click', () => {
    expect(advanceAnnotationDraft('point', null, { x: 10, y: 20 })).toEqual({
      draft: null,
      completedPoints: [{ x: 10, y: 20 }],
    })
  })

  it('keeps a line incomplete until its second point', () => {
    const first = advanceAnnotationDraft('line', null, { x: 1, y: 2 })
    expect(first.completedPoints).toBeNull()
    expect(first.draft?.points).toEqual([{ x: 1, y: 2 }])

    const second = advanceAnnotationDraft('line', first.draft, { x: 3, y: 4 })
    expect(second.draft).toBeNull()
    expect(second.completedPoints).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ])
  })

  it('completes an angle only after A, vertex, and B', () => {
    const first = advanceAnnotationDraft('angle', null, { x: 0, y: 0 })
    const second = advanceAnnotationDraft('angle', first.draft, { x: 1, y: 1 })
    const third = advanceAnnotationDraft('angle', second.draft, { x: 2, y: 0 })

    expect(second.completedPoints).toBeNull()
    expect(third.draft).toBeNull()
    expect(third.completedPoints).toHaveLength(3)
  })
})

describe('annotation model', () => {
  it('builds annotations with stable IDs and native coordinates', () => {
    const frame = createFrameReference(1.5)
    expect(
      buildAnnotation('line-7', 'line', frame, [
        { x: 1920, y: 1080 },
        { x: 12.25, y: 9.5 },
      ]),
    ).toEqual({
      id: 'line-7',
      type: 'line',
      frame,
      a: { x: 1920, y: 1080 },
      b: { x: 12.25, y: 9.5 },
    })
  })

  it('updates only the requested native-coordinate handle', () => {
    const line = buildAnnotation('line-1', 'line', createFrameReference(0), [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ])!

    expect(updateAnnotationHandle(line, 1, { x: 300.5, y: 400.25 })).toEqual({
      ...line,
      b: { x: 300.5, y: 400.25 },
    })
    expect(updateAnnotationHandle(line, 99, { x: 0, y: 0 })).toBe(line)
  })
})
