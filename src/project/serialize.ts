import type { VisualizationMode } from '../analysis/types'
import type { Annotation } from '../annotations/types'
import type { Calibration } from '../calibration/types'
import type { Track, TrailMode } from '../tracking/types'
import type { VideoMetadata } from '../types/video'
import { reportProjectStateForTracks } from '../report/projectState'
import { createDefaultReportProjectState } from '../report/projectState'
import type { ReportProjectState } from '../report/types'
import { validateMotionLabProject } from './schema'
import {
  MOTIONLAB_PROJECT_FORMAT,
  MOTIONLAB_PROJECT_VERSION,
  type MotionLabProjectV1,
} from './types'

export interface ProjectSnapshot {
  videoName: string
  metadata: VideoMetadata
  annotations: readonly Annotation[]
  calibration: Calibration | null
  tracks: readonly Track[]
  activeTrackId: string | null
  trailMode: TrailMode
  advanceAfterMark: boolean
  analysisMode: VisualizationMode
  analysisExpanded: boolean
  mediaTime: number
  report?: ReportProjectState
}

export type ProjectSerializationResult =
  | { ok: true; text: string }
  | { ok: false; message: string }

export function createMotionLabProject(
  snapshot: ProjectSnapshot,
): MotionLabProjectV1 {
  const trackIds = new Set(snapshot.tracks.map((track) => track.id))
  return {
    format: MOTIONLAB_PROJECT_FORMAT,
    version: MOTIONLAB_PROJECT_VERSION,
    video: {
      name: snapshot.videoName,
      width: snapshot.metadata.width,
      height: snapshot.metadata.height,
      ...(snapshot.metadata.duration === null
        ? {}
        : { duration: snapshot.metadata.duration }),
    },
    annotations: snapshot.annotations.map((annotation) => ({ ...annotation })),
    calibration: snapshot.calibration === null
      ? null
      : { ...snapshot.calibration },
    tracks: snapshot.tracks.map((track) => ({
      ...track,
      samples: track.samples.map((sample) => ({
        ...sample,
        frame: { ...sample.frame },
        nativePosition: { ...sample.nativePosition },
      })),
    })),
    workspace: {
      activeTrackId: snapshot.activeTrackId,
      trailMode: snapshot.trailMode,
      advanceAfterMark: snapshot.advanceAfterMark,
      analysisMode: snapshot.analysisMode,
      analysisExpanded: snapshot.analysisExpanded,
      mediaTime: snapshot.mediaTime,
    },
    report: reportProjectStateForTracks(
      snapshot.report ?? createDefaultReportProjectState(),
      trackIds,
    ),
  }
}

export function serializeMotionLabProject(
  project: MotionLabProjectV1,
): ProjectSerializationResult {
  const validation = validateMotionLabProject(project)
  return validation.ok
    ? { ok: true, text: `${JSON.stringify(validation.project, null, 2)}\n` }
    : { ok: false, message: `The current experiment could not be saved safely. ${validation.message}` }
}

export function projectFilenameForVideo(videoName: string): string {
  const base = videoName.replace(/\.[^.]+$/, '').trim() || 'motionlab-project'
  const safe = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, '-')
  return `${safe}.motionlab`
}
