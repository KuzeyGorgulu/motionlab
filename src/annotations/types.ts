import type { Point } from '../video/geometry'

export type AnnotationTool = 'select' | 'point' | 'line' | 'angle'
export type DrawingTool = Exclude<AnnotationTool, 'select'>

export interface TimestampFrameReference {
  scheme: 'timestamp-bucket-v1'
  bucketIndex: number
  bucketDuration: number
  anchorTime: number
}

interface AnnotationBase {
  id: string
  frame: TimestampFrameReference
}

export interface PointAnnotation extends AnnotationBase {
  type: 'point'
  point: Point
}

export interface LineAnnotation extends AnnotationBase {
  type: 'line'
  a: Point
  b: Point
}

export interface AngleAnnotation extends AnnotationBase {
  type: 'angle'
  a: Point
  vertex: Point
  b: Point
}

export type Annotation = PointAnnotation | LineAnnotation | AngleAnnotation

export interface AnnotationDraft {
  tool: DrawingTool
  points: Point[]
  previewPoint: Point | null
}
