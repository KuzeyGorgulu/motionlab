import type { Point } from '../video/geometry'
import { annotationPoints } from './model'
import type { Annotation } from './types'

export interface AnnotationHit {
  annotationId: string
  handleIndex: number | null
  distance: number
}

function pointDistance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

export function distanceToSegment(
  point: Point,
  start: Point,
  end: Point,
): number {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const lengthSquared = segmentX * segmentX + segmentY * segmentY

  if (lengthSquared === 0) {
    return pointDistance(point, start)
  }

  const projection =
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
    lengthSquared
  const clampedProjection = Math.max(0, Math.min(1, projection))

  return pointDistance(point, {
    x: start.x + clampedProjection * segmentX,
    y: start.y + clampedProjection * segmentY,
  })
}

export function hitTestAnnotations(
  annotations: readonly Annotation[],
  point: Point,
  tolerance: number,
): AnnotationHit | null {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return null
  }

  const topmostFirst = [...annotations].reverse()

  for (const annotation of topmostFirst) {
    const points = annotationPoints(annotation)
    for (let handleIndex = 0; handleIndex < points.length; handleIndex += 1) {
      const distance = pointDistance(point, points[handleIndex]!)
      if (distance <= tolerance) {
        return { annotationId: annotation.id, handleIndex, distance }
      }
    }
  }

  for (const annotation of topmostFirst) {
    let distance: number | null = null
    if (annotation.type === 'line') {
      distance = distanceToSegment(point, annotation.a, annotation.b)
    } else if (annotation.type === 'angle') {
      distance = Math.min(
        distanceToSegment(point, annotation.vertex, annotation.a),
        distanceToSegment(point, annotation.vertex, annotation.b),
      )
    }

    if (distance !== null && distance <= tolerance) {
      return { annotationId: annotation.id, handleIndex: null, distance }
    }
  }

  return null
}
