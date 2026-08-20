import { deriveTrackKinematics } from '../analysis/kinematics'
import type { Annotation } from '../annotations/types'
import type { Calibration } from '../calibration/types'
import { frameReferenceKey } from '../video/frameReference'
import type { ProjectVideoReferenceV1 } from '../project/types'
import type { Track } from '../tracking/types'

export interface ScientificDataRow {
  trackId: string
  trackName: string
  sampleId: string
  timeSeconds: number
  frameReference: string
  frameBucketIndex: number
  frameAnchorTimeSeconds: number
  xPixels: number
  yPixels: number
  positionSpace: 'pixel' | 'world'
  positionUnit: string
  xPosition: number
  yPosition: number
  velocityUnit: string
  velocityX: number | null
  velocityY: number | null
  speed: number | null
  accelerationUnit: string
  accelerationX: number | null
  accelerationY: number | null
  accelerationMagnitude: number | null
}

export type ScientificExportResult<T> =
  | { ok: true; value: T; rowCount: number }
  | { ok: false; message: string }

const CSV_COLUMNS: Array<{
  header: string
  value: (row: ScientificDataRow) => string | number | null
}> = [
  { header: 'track_id', value: (row) => row.trackId },
  { header: 'track_name', value: (row) => row.trackName },
  { header: 'sample_id', value: (row) => row.sampleId },
  { header: 'time_s', value: (row) => row.timeSeconds },
  { header: 'frame_reference', value: (row) => row.frameReference },
  { header: 'frame_bucket_index', value: (row) => row.frameBucketIndex },
  { header: 'frame_anchor_time_s', value: (row) => row.frameAnchorTimeSeconds },
  { header: 'x_px', value: (row) => row.xPixels },
  { header: 'y_px', value: (row) => row.yPixels },
  { header: 'position_space', value: (row) => row.positionSpace },
  { header: 'position_unit', value: (row) => row.positionUnit },
  { header: 'x_position', value: (row) => row.xPosition },
  { header: 'y_position', value: (row) => row.yPosition },
  { header: 'velocity_unit', value: (row) => row.velocityUnit },
  { header: 'vx', value: (row) => row.velocityX },
  { header: 'vy', value: (row) => row.velocityY },
  { header: 'speed', value: (row) => row.speed },
  { header: 'acceleration_unit', value: (row) => row.accelerationUnit },
  { header: 'ax', value: (row) => row.accelerationX },
  { header: 'ay', value: (row) => row.accelerationY },
  {
    header: 'acceleration_magnitude',
    value: (row) => row.accelerationMagnitude,
  },
]

function csvCell(value: string | number | null): string {
  if (value === null) return ''
  const stringValue = typeof value === 'number' ? String(value) : value
  return /[",\r\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue
}

export function buildScientificDataRows(
  tracks: readonly Track[],
  calibration: Calibration | null,
): ScientificDataRow[] {
  const rows = tracks.flatMap((track) => {
    const analysis = deriveTrackKinematics(track, calibration)
    return analysis.samples.map((sample) => ({
      trackId: track.id,
      trackName: track.name,
      sampleId: sample.source.id,
      timeSeconds: sample.source.time,
      frameReference: frameReferenceKey(sample.source.frame),
      frameBucketIndex: sample.source.frame.bucketIndex,
      frameAnchorTimeSeconds: sample.source.frame.anchorTime,
      xPixels: sample.source.nativePosition.x,
      yPixels: sample.source.nativePosition.y,
      positionSpace: analysis.space,
      positionUnit: analysis.positionUnit,
      xPosition: sample.position.x,
      yPosition: sample.position.y,
      velocityUnit: analysis.velocityUnit,
      velocityX: sample.velocity?.x ?? null,
      velocityY: sample.velocity?.y ?? null,
      speed: sample.velocity?.magnitude ?? null,
      accelerationUnit: analysis.accelerationUnit,
      accelerationX: sample.acceleration?.x ?? null,
      accelerationY: sample.acceleration?.y ?? null,
      accelerationMagnitude: sample.acceleration?.magnitude ?? null,
    }))
  })
  return rows.sort(
    (first, second) =>
      first.timeSeconds - second.timeSeconds ||
      first.trackId.localeCompare(second.trackId) ||
      first.sampleId.localeCompare(second.sampleId),
  )
}

export function createScientificCsv(
  tracks: readonly Track[],
  calibration: Calibration | null,
): ScientificExportResult<string> {
  const rows = buildScientificDataRows(tracks, calibration)
  if (rows.length === 0) {
    return {
      ok: false,
      message: 'There are no confirmed track samples to export. Add or restore track samples, then try again.',
    }
  }
  const lines = [
    CSV_COLUMNS.map((column) => column.header).join(','),
    ...rows.map((row) =>
      CSV_COLUMNS.map((column) => csvCell(column.value(row))).join(','),
    ),
  ]
  return { ok: true, value: `${lines.join('\n')}\n`, rowCount: rows.length }
}

export interface ScientificDataExportV1 {
  format: 'motionlab-data'
  version: 1
  video: ProjectVideoReferenceV1
  calibration: Calibration | null
  annotations: readonly Annotation[]
  tracks: Array<{
    id: string
    name: string
    color: string
    samples: ScientificDataRow[]
  }>
}

export function createScientificJson(
  video: ProjectVideoReferenceV1,
  annotations: readonly Annotation[],
  tracks: readonly Track[],
  calibration: Calibration | null,
): ScientificExportResult<string> {
  const rows = buildScientificDataRows(tracks, calibration)
  if (rows.length === 0) {
    return {
      ok: false,
      message: 'There are no confirmed track samples to export. Add or restore track samples, then try again.',
    }
  }
  const data: ScientificDataExportV1 = {
    format: 'motionlab-data',
    version: 1,
    video,
    calibration,
    annotations,
    tracks: tracks.map((track) => ({
      id: track.id,
      name: track.name,
      color: track.color,
      samples: rows.filter((row) => row.trackId === track.id),
    })),
  }
  return {
    ok: true,
    value: `${JSON.stringify(data, null, 2)}\n`,
    rowCount: rows.length,
  }
}
