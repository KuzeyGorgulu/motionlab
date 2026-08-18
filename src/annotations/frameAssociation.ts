import {
  isSameFrameReference,
  type TimestampFrameReference,
} from '../video/frameReference'
import type { Annotation } from './types'

export {
  createFrameReference,
  frameReferenceKey,
  isSameFrameReference,
} from '../video/frameReference'

export function annotationsForFrame(
  annotations: readonly Annotation[],
  frame: TimestampFrameReference,
): Annotation[] {
  return annotations.filter((annotation) =>
    isSameFrameReference(annotation.frame, frame),
  )
}
