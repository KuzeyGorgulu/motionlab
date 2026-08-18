import { pixelToWorld } from '../calibration/transform'
import type { Calibration } from '../calibration/types'
import type { Point } from '../video/geometry'
import {
  isSameFrameReference,
  type TimestampFrameReference,
} from '../video/frameReference'
import { findTrack } from './model'
import type { Track, TrackSample, TrackingSnapshot, TrailMode } from './types'

export interface DerivedTrackSample extends TrackSample {
  worldPosition: Point
}

export interface TrackSamplePartition {
  past: TrackSample[]
  current: TrackSample | null
  future: TrackSample[]
}

export function activeTrack(snapshot: TrackingSnapshot): Track | null {
  return findTrack(snapshot.tracks, snapshot.activeTrackId)
}

export function currentFrameTrackSample(
  track: Track | null,
  frame: TimestampFrameReference,
): TrackSample | null {
  if (track === null) return null
  return (
    track.samples.find((sample) =>
      isSameFrameReference(sample.frame, frame),
    ) ?? null
  )
}

export function partitionTrackSamples(
  track: Track,
  frame: TimestampFrameReference,
  currentTime: number,
): TrackSamplePartition {
  const past: TrackSample[] = []
  const future: TrackSample[] = []
  let current: TrackSample | null = null

  // Track mutations establish chronological order once. Selectors preserve that
  // invariant without re-sorting unchanged arrays during video-frame repaints.
  for (const sample of track.samples) {
    if (isSameFrameReference(sample.frame, frame)) current = sample
    else if (sample.time < currentTime) past.push(sample)
    else future.push(sample)
  }

  return { past, current, future }
}

export function visibleTrackSamples(
  track: Track,
  frame: TimestampFrameReference,
  currentTime: number,
  trailMode: TrailMode,
): TrackSample[] {
  const partition = partitionTrackSamples(track, frame, currentTime)
  if (trailMode === 'current') {
    return partition.current === null ? [] : [partition.current]
  }
  if (trailMode === 'past') {
    return [
      ...partition.past,
      ...(partition.current === null ? [] : [partition.current]),
    ]
  }
  return track.samples
}

export function deriveWorldTrackSamples(
  track: Track,
  calibration: Calibration,
): DerivedTrackSample[] {
  const derived: DerivedTrackSample[] = []
  for (const sample of track.samples) {
    const worldPosition = pixelToWorld(sample.nativePosition, calibration)
    // Stored calibrations are valid by construction. Retaining this guard keeps
    // the selector total if externally supplied data is ever introduced.
    if (worldPosition !== null) derived.push({ ...sample, worldPosition })
  }
  return derived
}
