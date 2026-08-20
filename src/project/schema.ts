import type { Annotation } from '../annotations/types'
import { DISTANCE_UNITS, type Calibration } from '../calibration/types'
import { validateTrack } from '../tracking/model'
import type { Track, TrackSample, TrailMode } from '../tracking/types'
import {
  isValidFrameReference,
  type TimestampFrameReference,
} from '../video/frameReference'
import type { Point } from '../video/geometry'
import type { VisualizationMode } from '../analysis/types'
import {
  MOTIONLAB_PROJECT_FORMAT,
  MOTIONLAB_PROJECT_VERSION,
  type ProjectParseResult,
  type ProjectVideoReferenceV1,
  type ProjectWorkspaceV1,
} from './types'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nonNegativeNumber(value: unknown): number | null {
  const number = finiteNumber(value)
  return number !== null && number >= 0 ? number : null
}

function point(value: unknown): Point | null {
  const candidate = record(value)
  if (candidate === null) return null
  const x = finiteNumber(candidate.x)
  const y = finiteNumber(candidate.y)
  return x === null || y === null ? null : { x, y }
}

function frameReference(value: unknown): TimestampFrameReference | null {
  const candidate = record(value)
  if (candidate === null) return null
  const frame: TimestampFrameReference = {
    scheme: candidate.scheme === 'timestamp-bucket-v1'
      ? candidate.scheme
      : 'timestamp-bucket-v1',
    bucketIndex: typeof candidate.bucketIndex === 'number'
      ? candidate.bucketIndex
      : Number.NaN,
    bucketDuration: typeof candidate.bucketDuration === 'number'
      ? candidate.bucketDuration
      : Number.NaN,
    anchorTime: typeof candidate.anchorTime === 'number'
      ? candidate.anchorTime
      : Number.NaN,
  }
  return candidate.scheme === 'timestamp-bucket-v1' && isValidFrameReference(frame)
    ? frame
    : null
}

function annotation(value: unknown): Annotation | null {
  const candidate = record(value)
  if (candidate === null) return null
  const id = text(candidate.id)
  const frame = frameReference(candidate.frame)
  if (id === null || frame === null) return null

  if (candidate.type === 'point') {
    const annotationPoint = point(candidate.point)
    return annotationPoint === null
      ? null
      : { id, type: 'point', frame, point: annotationPoint }
  }
  if (candidate.type === 'line') {
    const a = point(candidate.a)
    const b = point(candidate.b)
    return a === null || b === null ? null : { id, type: 'line', frame, a, b }
  }
  if (candidate.type === 'angle') {
    const a = point(candidate.a)
    const vertex = point(candidate.vertex)
    const b = point(candidate.b)
    return a === null || vertex === null || b === null
      ? null
      : { id, type: 'angle', frame, a, vertex, b }
  }
  return null
}

function calibration(value: unknown): Calibration | null | undefined {
  if (value === null) return null
  const candidate = record(value)
  if (candidate === null) return undefined
  const referenceA = point(candidate.referenceA)
  const referenceB = point(candidate.referenceB)
  const origin = point(candidate.origin)
  const xAxis = point(candidate.xAxis)
  const knownDistance = finiteNumber(candidate.knownDistance)
  const unit = typeof candidate.unit === 'string' &&
      DISTANCE_UNITS.includes(candidate.unit as (typeof DISTANCE_UNITS)[number])
    ? candidate.unit as Calibration['unit']
    : null
  const originSource = candidate.originSource === 'reference-a' ||
      candidate.originSource === 'custom'
    ? candidate.originSource
    : null
  const axisSource = candidate.axisSource === 'reference' ||
      candidate.axisSource === 'custom'
    ? candidate.axisSource
    : null
  if (
    referenceA === null ||
    referenceB === null ||
    origin === null ||
    xAxis === null ||
    knownDistance === null ||
    knownDistance <= 0 ||
    unit === null ||
    originSource === null ||
    axisSource === null ||
    Math.hypot(referenceB.x - referenceA.x, referenceB.y - referenceA.y) <= 1e-9 ||
    Math.abs(Math.hypot(xAxis.x, xAxis.y) - 1) > 1e-6
  ) {
    return undefined
  }
  return {
    referenceA,
    referenceB,
    knownDistance,
    unit,
    origin,
    originSource,
    xAxis,
    axisSource,
  }
}

function trackSample(value: unknown): TrackSample | null {
  const candidate = record(value)
  if (candidate === null) return null
  const id = text(candidate.id)
  const time = nonNegativeNumber(candidate.time)
  const frame = frameReference(candidate.frame)
  const nativePosition = point(candidate.nativePosition)
  if (
    id === null ||
    time === null ||
    frame === null ||
    nativePosition === null ||
    Math.abs(time - frame.anchorTime) > 1e-9
  ) {
    return null
  }
  return { id, time, frame, nativePosition }
}

function track(value: unknown): Track | null {
  const candidate = record(value)
  if (candidate === null || !Array.isArray(candidate.samples)) return null
  const id = text(candidate.id)
  const name = text(candidate.name)
  const color = text(candidate.color)
  const samples = candidate.samples.map(trackSample)
  if (
    id === null ||
    name === null ||
    color === null ||
    !/^#[0-9a-fA-F]{6}$/.test(color) ||
    samples.some((sample) => sample === null)
  ) {
    return null
  }
  const parsed: Track = { id, name, color, samples: samples as TrackSample[] }
  return validateTrack(parsed).length === 0 ? parsed : null
}

function videoReference(value: unknown): ProjectVideoReferenceV1 | null {
  const candidate = record(value)
  if (candidate === null) return null
  const name = text(candidate.name)
  if (name === null) return null
  const video: ProjectVideoReferenceV1 = { name }
  for (const key of ['width', 'height'] as const) {
    if (candidate[key] === undefined) continue
    const dimension = finiteNumber(candidate[key])
    if (dimension === null || !Number.isInteger(dimension) || dimension <= 0) {
      return null
    }
    video[key] = dimension
  }
  if (candidate.duration !== undefined) {
    const duration = nonNegativeNumber(candidate.duration)
    if (duration === null) return null
    video.duration = duration
  }
  return video
}

const TRAIL_MODES: TrailMode[] = ['all', 'past', 'current']
const ANALYSIS_MODES: VisualizationMode[] = [
  'position',
  'velocity',
  'acceleration',
]

function workspace(value: unknown, tracks: readonly Track[]): ProjectWorkspaceV1 | null {
  const candidate = record(value)
  if (candidate === null) return null
  const activeTrackId = candidate.activeTrackId === null
    ? null
    : text(candidate.activeTrackId)
  const trailMode = typeof candidate.trailMode === 'string' &&
      TRAIL_MODES.includes(candidate.trailMode as TrailMode)
    ? candidate.trailMode as TrailMode
    : null
  const analysisMode = typeof candidate.analysisMode === 'string' &&
      ANALYSIS_MODES.includes(candidate.analysisMode as VisualizationMode)
    ? candidate.analysisMode as VisualizationMode
    : null
  const mediaTime = nonNegativeNumber(candidate.mediaTime)
  if (
    activeTrackId === null && candidate.activeTrackId !== null ||
    activeTrackId !== null && !tracks.some((item) => item.id === activeTrackId) ||
    trailMode === null ||
    analysisMode === null ||
    typeof candidate.advanceAfterMark !== 'boolean' ||
    typeof candidate.analysisExpanded !== 'boolean' ||
    mediaTime === null
  ) {
    return null
  }
  return {
    activeTrackId,
    trailMode,
    advanceAfterMark: candidate.advanceAfterMark,
    analysisMode,
    analysisExpanded: candidate.analysisExpanded,
    mediaTime,
  }
}

export function validateMotionLabProject(value: unknown): ProjectParseResult {
  const root = record(value)
  if (root === null) {
    return { ok: false, code: 'invalid-schema', message: 'The project file does not contain a valid MotionLab project object. Existing work is safe.' }
  }
  if (root.format !== MOTIONLAB_PROJECT_FORMAT) {
    return { ok: false, code: 'invalid-format', message: 'This file is not a MotionLab project. Existing work is safe; choose a .motionlab file.' }
  }
  if (typeof root.version !== 'number' || !Number.isInteger(root.version)) {
    return { ok: false, code: 'invalid-schema', message: 'The MotionLab project version is missing or invalid. Existing work is safe.' }
  }
  if (root.version > MOTIONLAB_PROJECT_VERSION) {
    return { ok: false, code: 'newer-version', message: 'This project was created with a newer MotionLab project format and cannot be opened by this version. Existing work is safe.' }
  }
  if (root.version !== MOTIONLAB_PROJECT_VERSION) {
    return { ok: false, code: 'unsupported-version', message: `MotionLab project version ${root.version} is not supported. Existing work is safe.` }
  }
  if (!Array.isArray(root.annotations) || !Array.isArray(root.tracks)) {
    return { ok: false, code: 'invalid-schema', message: 'The project is missing its annotation or track data. Existing work is safe.' }
  }
  const parsedAnnotations = root.annotations.map(annotation)
  const parsedTracks = root.tracks.map(track)
  const parsedCalibration = calibration(root.calibration)
  const parsedVideo = videoReference(root.video)
  if (
    parsedAnnotations.some((item) => item === null) ||
    new Set(parsedAnnotations.map((item) => item?.id)).size !== parsedAnnotations.length ||
    parsedTracks.some((item) => item === null) ||
    new Set(parsedTracks.map((item) => item?.id)).size !== parsedTracks.length ||
    parsedCalibration === undefined ||
    parsedVideo === null
  ) {
    return { ok: false, code: 'invalid-schema', message: 'The project contains invalid or corrupt experiment data. Existing work is safe; choose another project file.' }
  }
  const tracks = parsedTracks as Track[]
  const parsedWorkspace = workspace(root.workspace, tracks)
  if (parsedWorkspace === null) {
    return { ok: false, code: 'invalid-schema', message: 'The project workspace metadata is invalid. Existing work is safe.' }
  }
  return {
    ok: true,
    project: {
      format: MOTIONLAB_PROJECT_FORMAT,
      version: MOTIONLAB_PROJECT_VERSION,
      video: parsedVideo,
      annotations: parsedAnnotations as Annotation[],
      calibration: parsedCalibration,
      tracks,
      workspace: parsedWorkspace,
    },
  }
}

export function parseMotionLabProject(textValue: string): ProjectParseResult {
  try {
    return validateMotionLabProject(JSON.parse(textValue) as unknown)
  } catch {
    return {
      ok: false,
      code: 'invalid-json',
      message: 'The selected project is not valid JSON and could not be opened. Existing work is safe; choose an unmodified .motionlab file.',
    }
  }
}
