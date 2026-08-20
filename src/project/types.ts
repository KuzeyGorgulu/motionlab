import type { VisualizationMode } from '../analysis/types'
import type { Annotation } from '../annotations/types'
import type { Calibration } from '../calibration/types'
import type { Track, TrailMode } from '../tracking/types'

export const MOTIONLAB_PROJECT_FORMAT = 'motionlab'
export const MOTIONLAB_PROJECT_VERSION = 1

export interface ProjectVideoReferenceV1 {
  name: string
  width?: number
  height?: number
  duration?: number
}

export interface ProjectWorkspaceV1 {
  activeTrackId: string | null
  trailMode: TrailMode
  advanceAfterMark: boolean
  analysisMode: VisualizationMode
  analysisExpanded: boolean
  mediaTime: number
}

export interface MotionLabProjectV1 {
  format: typeof MOTIONLAB_PROJECT_FORMAT
  version: typeof MOTIONLAB_PROJECT_VERSION
  video: ProjectVideoReferenceV1
  annotations: Annotation[]
  calibration: Calibration | null
  tracks: Track[]
  workspace: ProjectWorkspaceV1
}

export type ProjectParseErrorCode =
  | 'invalid-json'
  | 'invalid-format'
  | 'newer-version'
  | 'unsupported-version'
  | 'invalid-schema'

export type ProjectParseResult =
  | { ok: true; project: MotionLabProjectV1 }
  | { ok: false; code: ProjectParseErrorCode; message: string }
