import type { Point } from '../video/geometry'
import type { TimestampFrameReference } from '../video/frameReference'

export const TRACK_COLORS = [
  '#4ecdc4',
  '#ffb454',
  '#ff6b8a',
  '#8d82ff',
  '#7ed957',
  '#50a7ff',
] as const

export type TrackingMode = 'idle' | 'mark' | 'edit'
export type TrailMode = 'all' | 'past' | 'current'

export interface TrackSample {
  id: string
  time: number
  frame: TimestampFrameReference
  nativePosition: Point
}

export interface Track {
  id: string
  name: string
  color: string
  samples: TrackSample[]
}

export interface TrackingSnapshot {
  tracks: Track[]
  activeTrackId: string | null
}

export interface TrackingHistory {
  past: TrackingSnapshot[]
  present: TrackingSnapshot
  future: TrackingSnapshot[]
}

export interface TrackDragPreview {
  trackId: string
  sampleId: string
  nativePosition: Point
}

export type TrackValidationErrorCode =
  | 'empty-id'
  | 'empty-name'
  | 'empty-color'
  | 'non-finite-time'
  | 'non-finite-position'
  | 'invalid-frame-reference'
  | 'time-anchor-mismatch'
  | 'duplicate-sample-id'
  | 'duplicate-frame-reference'

export interface TrackValidationError {
  code: TrackValidationErrorCode
  message: string
}
