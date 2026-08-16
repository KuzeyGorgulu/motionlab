import type { Point } from '../video/geometry'

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export function distanceBetweenPoints(a: Point, b: Point): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(b)) {
    return null
  }

  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function angleBetweenThreePoints(
  a: Point,
  vertex: Point,
  b: Point,
): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(vertex) || !isFinitePoint(b)) {
    return null
  }

  const firstVector = { x: a.x - vertex.x, y: a.y - vertex.y }
  const secondVector = { x: b.x - vertex.x, y: b.y - vertex.y }
  const firstLength = Math.hypot(firstVector.x, firstVector.y)
  const secondLength = Math.hypot(secondVector.x, secondVector.y)

  if (firstLength === 0 || secondLength === 0) {
    return null
  }

  const cosine =
    (firstVector.x * secondVector.x + firstVector.y * secondVector.y) /
    (firstLength * secondLength)

  // Floating-point error can otherwise push a theoretically valid cosine past ±1.
  const clampedCosine = Math.max(-1, Math.min(1, cosine))
  return (Math.acos(clampedCosine) * 180) / Math.PI
}
