import type { Point } from '../video/geometry'
import type {
  AngleAnnotation,
  Annotation,
  AnnotationDraft,
  DrawingTool,
  TimestampFrameReference,
} from './types'

export interface DraftAdvance {
  draft: AnnotationDraft | null
  completedPoints: Point[] | null
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export function advanceAnnotationDraft(
  tool: DrawingTool,
  draft: AnnotationDraft | null,
  point: Point,
): DraftAdvance {
  if (!isFinitePoint(point)) {
    return { draft, completedPoints: null }
  }

  if (tool === 'point') {
    return { draft: null, completedPoints: [point] }
  }

  const existingPoints = draft?.tool === tool ? draft.points : []
  const points = [...existingPoints, point]
  const requiredPointCount = tool === 'line' ? 2 : 3

  if (points.length === requiredPointCount) {
    return { draft: null, completedPoints: points }
  }

  return {
    draft: { tool, points, previewPoint: null },
    completedPoints: null,
  }
}

export function buildAnnotation(
  id: string,
  tool: DrawingTool,
  frame: TimestampFrameReference,
  points: readonly Point[],
): Annotation | null {
  if (id === '' || points.some((point) => !isFinitePoint(point))) {
    return null
  }

  if (tool === 'point' && points.length === 1) {
    return { id, type: 'point', frame, point: points[0]! }
  }

  if (tool === 'line' && points.length === 2) {
    return { id, type: 'line', frame, a: points[0]!, b: points[1]! }
  }

  if (tool === 'angle' && points.length === 3) {
    return {
      id,
      type: 'angle',
      frame,
      a: points[0]!,
      vertex: points[1]!,
      b: points[2]!,
    }
  }

  return null
}

export function annotationPoints(annotation: Annotation): Point[] {
  switch (annotation.type) {
    case 'point':
      return [annotation.point]
    case 'line':
      return [annotation.a, annotation.b]
    case 'angle':
      return [annotation.a, annotation.vertex, annotation.b]
  }
}

export function updateAnnotationHandle(
  annotation: Annotation,
  handleIndex: number,
  point: Point,
): Annotation {
  if (!isFinitePoint(point)) {
    return annotation
  }

  switch (annotation.type) {
    case 'point':
      return handleIndex === 0 ? { ...annotation, point } : annotation
    case 'line':
      if (handleIndex === 0) return { ...annotation, a: point }
      if (handleIndex === 1) return { ...annotation, b: point }
      return annotation
    case 'angle': {
      const pointKeys: Array<keyof Pick<AngleAnnotation, 'a' | 'vertex' | 'b'>> = [
        'a',
        'vertex',
        'b',
      ]
      const key = pointKeys[handleIndex]
      return key === undefined ? annotation : { ...annotation, [key]: point }
    }
  }
}
