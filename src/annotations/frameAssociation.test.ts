import { describe, expect, it } from 'vitest'

import type { Annotation } from './types'
import {
  annotationsForFrame,
  createFrameReference,
  isSameFrameReference,
} from './frameAssociation'

function pointAnnotation(id: string, time: number): Annotation {
  return {
    id,
    type: 'point',
    frame: createFrameReference(time),
    point: { x: 100, y: 200 },
  }
}

describe('timestamp frame association', () => {
  it('groups nearby timestamps in the same fallback frame bucket', () => {
    expect(
      isSameFrameReference(
        createFrameReference(1.0001),
        createFrameReference(1.009),
      ),
    ).toBe(true)
  })

  it('keeps adjacent frame buckets separate', () => {
    expect(
      isSameFrameReference(
        createFrameReference(1),
        createFrameReference(1 + 1 / 30),
      ),
    ).toBe(false)
  })

  it('preserves the actual creation timestamp for future migration', () => {
    expect(createFrameReference(1.004).anchorTime).toBe(1.004)
  })

  it('returns only annotations belonging to the requested frame', () => {
    const annotations = [
      pointAnnotation('current-a', 2),
      pointAnnotation('current-b', 2.005),
      pointAnnotation('next', 2 + 1 / 30),
    ]

    expect(
      annotationsForFrame(annotations, createFrameReference(2)).map(
        (annotation) => annotation.id,
      ),
    ).toEqual(['current-a', 'current-b'])
  })
})
