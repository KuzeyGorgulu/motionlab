import { describe, expect, it } from 'vitest'

import { angleBetweenThreePoints, distanceBetweenPoints } from './measurement'

describe('distanceBetweenPoints', () => {
  it('calculates Euclidean pixel distance', () => {
    expect(distanceBetweenPoints({ x: 1, y: 2 }, { x: 4, y: 6 })).toBe(5)
  })

  it('returns zero for coincident points', () => {
    expect(distanceBetweenPoints({ x: 8, y: 3 }, { x: 8, y: 3 })).toBe(0)
  })

  it('rejects non-finite coordinates', () => {
    expect(distanceBetweenPoints({ x: Number.NaN, y: 0 }, { x: 2, y: 3 })).toBeNull()
  })
})

describe('angleBetweenThreePoints', () => {
  it('calculates a right angle with the middle point as the vertex', () => {
    expect(
      angleBetweenThreePoints(
        { x: 10, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 10 },
      ),
    ).toBeCloseTo(90)
  })

  it('calculates straight and acute angles', () => {
    expect(
      angleBetweenThreePoints(
        { x: -1, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ),
    ).toBeCloseTo(180)
    expect(
      angleBetweenThreePoints(
        { x: 1, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ),
    ).toBeCloseTo(45)
  })

  it('returns null when either arm has zero length', () => {
    expect(
      angleBetweenThreePoints(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ),
    ).toBeNull()
    expect(
      angleBetweenThreePoints(
        { x: 1, y: 1 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ),
    ).toBeNull()
  })
})
