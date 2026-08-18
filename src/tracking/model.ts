import type { Point } from '../video/geometry'
import {
  frameReferenceKey,
  isSameFrameReference,
  isValidFrameReference,
  type TimestampFrameReference,
} from '../video/frameReference'
import type {
  Track,
  TrackSample,
  TrackValidationError,
} from './types'

const TIME_EPSILON = 1e-9

function hasText(value: string): boolean {
  return value.trim().length > 0
}

export function isFiniteNativePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export function orderTrackSamples(
  samples: readonly TrackSample[],
): TrackSample[] {
  return [...samples].sort((first, second) => {
    const timeDifference = first.time - second.time
    if (timeDifference !== 0) return timeDifference

    const bucketDifference = first.frame.bucketIndex - second.frame.bucketIndex
    if (bucketDifference !== 0) return bucketDifference

    return first.id.localeCompare(second.id)
  })
}

export function createTrack(
  id: string,
  name: string,
  color: string,
): Track | null {
  const trimmedName = name.trim()
  if (!hasText(id) || !hasText(trimmedName) || !hasText(color)) {
    return null
  }

  return { id, name: trimmedName, color, samples: [] }
}

export function renameTrack(track: Track, name: string): Track {
  const trimmedName = name.trim()
  return hasText(trimmedName) && trimmedName !== track.name
    ? { ...track, name: trimmedName }
    : track
}

export function createTrackSample(
  id: string,
  frame: TimestampFrameReference,
  nativePosition: Point,
): TrackSample | null {
  if (
    !hasText(id) ||
    !isValidFrameReference(frame) ||
    !isFiniteNativePoint(nativePosition)
  ) {
    return null
  }

  return {
    id,
    time: frame.anchorTime,
    frame,
    nativePosition,
  }
}

export function insertOrReplaceTrackSample(
  track: Track,
  sample: TrackSample,
): Track {
  if (validateTrackSample(sample).length > 0) {
    return track
  }

  if (
    track.samples.some(
      (candidate) =>
        candidate.id === sample.id &&
        !isSameFrameReference(candidate.frame, sample.frame),
    )
  ) {
    return track
  }

  const existingIndex = track.samples.findIndex((candidate) =>
    isSameFrameReference(candidate.frame, sample.frame),
  )

  if (existingIndex >= 0) {
    const existing = track.samples[existingIndex]!
    if (
      existing.nativePosition.x === sample.nativePosition.x &&
      existing.nativePosition.y === sample.nativePosition.y
    ) {
      return track
    }

    const samples = [...track.samples]
    // A correction within the same frame keeps the original sample identity and
    // exact anchor timestamp; only its native position changes.
    samples[existingIndex] = {
      ...existing,
      nativePosition: sample.nativePosition,
    }
    return { ...track, samples: orderTrackSamples(samples) }
  }

  return {
    ...track,
    samples: orderTrackSamples([...track.samples, sample]),
  }
}

export function updateTrackSamplePosition(
  track: Track,
  sampleId: string,
  nativePosition: Point,
): Track {
  if (!hasText(sampleId) || !isFiniteNativePoint(nativePosition)) {
    return track
  }

  let changed = false
  const samples = track.samples.map((sample) => {
    if (sample.id !== sampleId) return sample
    if (
      sample.nativePosition.x === nativePosition.x &&
      sample.nativePosition.y === nativePosition.y
    ) {
      return sample
    }
    changed = true
    return { ...sample, nativePosition }
  })

  return changed ? { ...track, samples } : track
}

export function deleteTrackSample(track: Track, sampleId: string): Track {
  const samples = track.samples.filter((sample) => sample.id !== sampleId)
  return samples.length === track.samples.length ? track : { ...track, samples }
}

export function deleteTrack(tracks: readonly Track[], trackId: string): Track[] {
  return tracks.filter((track) => track.id !== trackId)
}

export function findTrack(
  tracks: readonly Track[],
  trackId: string | null,
): Track | null {
  if (trackId === null) return null
  return tracks.find((track) => track.id === trackId) ?? null
}

export function validateTrackSample(
  sample: TrackSample,
): TrackValidationError[] {
  const errors: TrackValidationError[] = []
  if (!hasText(sample.id)) {
    errors.push({ code: 'empty-id', message: 'Sample ID cannot be empty.' })
  }
  if (!Number.isFinite(sample.time) || sample.time < 0) {
    errors.push({
      code: 'non-finite-time',
      message: 'Sample time must be a finite non-negative value.',
    })
  }
  if (!isFiniteNativePoint(sample.nativePosition)) {
    errors.push({
      code: 'non-finite-position',
      message: 'Sample position must contain finite native coordinates.',
    })
  }
  if (!isValidFrameReference(sample.frame)) {
    errors.push({
      code: 'invalid-frame-reference',
      message: 'Sample frame reference is invalid.',
    })
  } else if (
    Number.isFinite(sample.time) &&
    Math.abs(sample.time - sample.frame.anchorTime) > TIME_EPSILON
  ) {
    errors.push({
      code: 'time-anchor-mismatch',
      message: 'Sample time must match its exact frame anchor timestamp.',
    })
  }
  return errors
}

export function validateTrack(track: Track): TrackValidationError[] {
  const errors: TrackValidationError[] = []
  if (!hasText(track.id)) {
    errors.push({ code: 'empty-id', message: 'Track ID cannot be empty.' })
  }
  if (!hasText(track.name)) {
    errors.push({ code: 'empty-name', message: 'Track name cannot be empty.' })
  }
  if (!hasText(track.color)) {
    errors.push({ code: 'empty-color', message: 'Track color cannot be empty.' })
  }

  const sampleIds = new Set<string>()
  const frameKeys = new Set<string>()
  for (const sample of track.samples) {
    errors.push(...validateTrackSample(sample))
    if (sampleIds.has(sample.id)) {
      errors.push({
        code: 'duplicate-sample-id',
        message: `Duplicate sample ID: ${sample.id}.`,
      })
    }
    sampleIds.add(sample.id)

    if (isValidFrameReference(sample.frame)) {
      const frameKey = frameReferenceKey(sample.frame)
      if (frameKeys.has(frameKey)) {
        errors.push({
          code: 'duplicate-frame-reference',
          message: `Track contains more than one sample for ${frameKey}.`,
        })
      }
      frameKeys.add(frameKey)
    }
  }
  return errors
}
