import { describe, expect, it } from 'vitest'

import { createFrameReference } from './frameAssociation'
import { distanceToSegment, hitTestAnnotations } from './hitTest'
import { buildAnnotation } from './model'

const frame = createFrameReference(0)

describe('distanceToSegment', () => {
  it('uses the closest position on the bounded segment', () => {
    expect(
      distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(3)
    expect(
      distanceToSegment({ x: 14, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(4)
  })
})

describe('hitTestAnnotations', () => {
  const line = buildAnnotation('line', 'line', frame, [
    { x: 10, y: 10 },
    { x: 100, y: 10 },
  ])!
  const angle = buildAnnotation('angle', 'angle', frame, [
    { x: 20, y: 80 },
    { x: 50, y: 50 },
    { x: 100, y: 80 },
  ])!

  it('prioritizes editable handles over line bodies', () => {
    expect(hitTestAnnotations([line], { x: 11, y: 11 }, 5)).toMatchObject({
      annotationId: 'line',
      handleIndex: 0,
    })
  })

  it('selects line and angle ray bodies', () => {
    expect(hitTestAnnotations([line], { x: 55, y: 13 }, 5)).toMatchObject({
      annotationId: 'line',
      handleIndex: null,
    })
    expect(hitTestAnnotations([angle], { x: 35, y: 65 }, 3)).toMatchObject({
      annotationId: 'angle',
      handleIndex: null,
    })
  })

  it('returns null outside the native-coordinate tolerance', () => {
    expect(hitTestAnnotations([line, angle], { x: 400, y: 400 }, 8)).toBeNull()
  })
})
