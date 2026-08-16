import { getFrameStepSeconds } from '../video/timing'
import type { Annotation, TimestampFrameReference } from './types'

const FRAME_DURATION_EPSILON = 1e-9

export function createFrameReference(
  mediaTime: number,
  bucketDuration: number = getFrameStepSeconds(),
): TimestampFrameReference {
  const safeTime = Number.isFinite(mediaTime) ? Math.max(0, mediaTime) : 0
  const safeDuration =
    Number.isFinite(bucketDuration) && bucketDuration > 0
      ? bucketDuration
      : getFrameStepSeconds()

  return {
    scheme: 'timestamp-bucket-v1',
    bucketIndex: Math.round(safeTime / safeDuration),
    bucketDuration: safeDuration,
    anchorTime: safeTime,
  }
}

export function isSameFrameReference(
  first: TimestampFrameReference,
  second: TimestampFrameReference,
): boolean {
  return (
    first.scheme === second.scheme &&
    first.bucketIndex === second.bucketIndex &&
    Math.abs(first.bucketDuration - second.bucketDuration) <
      FRAME_DURATION_EPSILON
  )
}

export function annotationsForFrame(
  annotations: readonly Annotation[],
  frame: TimestampFrameReference,
): Annotation[] {
  return annotations.filter((annotation) =>
    isSameFrameReference(annotation.frame, frame),
  )
}

export function frameReferenceKey(frame: TimestampFrameReference): string {
  return `${frame.scheme}:${frame.bucketDuration.toFixed(9)}:${frame.bucketIndex}`
}
