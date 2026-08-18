import { describe, expect, it } from 'vitest'

import { createFrameReference } from '../video/frameReference'
import {
  createTrack,
  createTrackSample,
  deleteTrack,
  deleteTrackSample,
  findTrack,
  insertOrReplaceTrackSample,
  renameTrack,
  updateTrackSamplePosition,
  validateTrack,
} from './model'
import type { Track, TrackSample } from './types'

function trackFixture(): Track {
  const track = createTrack('track-1', 'Ball', '#4ecdc4')
  if (track === null) throw new Error('fixture track should be valid')
  return track
}

function sampleFixture(id: string, time: number, x = 10): TrackSample {
  const sample = createTrackSample(
    id,
    createFrameReference(time),
    { x, y: 20 },
  )
  if (sample === null) throw new Error('fixture sample should be valid')
  return sample
}

describe('track model', () => {
  it('creates a stable named track and trims its name', () => {
    expect(createTrack('track-1', '  Ball  ', '#fff')).toEqual({
      id: 'track-1',
      name: 'Ball',
      color: '#fff',
      samples: [],
    })
  })

  it('rejects empty identity data and ignores an empty rename', () => {
    const track = trackFixture()
    expect(createTrack('', 'Ball', '#fff')).toBeNull()
    expect(createTrack('track-1', '  ', '#fff')).toBeNull()
    expect(renameTrack(track, '  ')).toBe(track)
    expect(renameTrack(track, ' Hand ')).toMatchObject({ name: 'Hand' })
  })

  it('adds a native-coordinate sample with its exact anchor time', () => {
    const sample = sampleFixture('sample-1', 2.004, 33)
    const track = insertOrReplaceTrackSample(trackFixture(), sample)
    expect(track.samples).toEqual([sample])
    expect(track.samples[0]?.time).toBe(2.004)
    expect(track.samples[0]?.nativePosition).toEqual({ x: 33, y: 20 })
  })

  it('replaces the position in the same frame bucket without changing identity or anchor', () => {
    const original = sampleFixture('sample-1', 2.000001, 10)
    const first = insertOrReplaceTrackSample(trackFixture(), original)
    const nearby = sampleFixture('sample-2', 2.000009, 99)
    const replaced = insertOrReplaceTrackSample(first, nearby)

    expect(replaced.samples).toHaveLength(1)
    expect(replaced.samples[0]).toEqual({
      ...original,
      nativePosition: { x: 99, y: 20 },
    })
  })

  it('sorts samples chronologically when they are added out of order', () => {
    let track = trackFixture()
    track = insertOrReplaceTrackSample(track, sampleFixture('later', 3))
    track = insertOrReplaceTrackSample(track, sampleFixture('earlier', 1))
    track = insertOrReplaceTrackSample(track, sampleFixture('middle', 2))
    expect(track.samples.map((sample) => sample.id)).toEqual([
      'earlier',
      'middle',
      'later',
    ])
  })

  it('keeps adjacent frame buckets as separate samples', () => {
    let track = trackFixture()
    track = insertOrReplaceTrackSample(track, sampleFixture('first', 1))
    track = insertOrReplaceTrackSample(
      track,
      sampleFixture('next', 1 + 1 / 30),
    )
    expect(track.samples).toHaveLength(2)
  })

  it('rejects a reused sample ID in a different frame', () => {
    let track = trackFixture()
    track = insertOrReplaceTrackSample(track, sampleFixture('stable-id', 1))
    const unchanged = insertOrReplaceTrackSample(
      track,
      sampleFixture('stable-id', 1 + 1 / 30, 50),
    )
    expect(unchanged).toBe(track)
  })

  it('updates one sample position without changing its timing', () => {
    const sample = sampleFixture('sample-1', 1.25)
    const track = insertOrReplaceTrackSample(trackFixture(), sample)
    const updated = updateTrackSamplePosition(track, sample.id, { x: 50, y: 60 })
    expect(updated.samples[0]).toEqual({
      ...sample,
      nativePosition: { x: 50, y: 60 },
    })
  })

  it('deletes a sample while preserving the empty track', () => {
    const sample = sampleFixture('sample-1', 1)
    const track = insertOrReplaceTrackSample(trackFixture(), sample)
    expect(deleteTrackSample(track, sample.id)).toEqual({
      ...trackFixture(),
      samples: [],
    })
  })

  it('deletes and finds tracks by stable ID without affecting peers', () => {
    const ball = trackFixture()
    const hand = createTrack('track-2', 'Hand', '#f00')!
    const remaining = deleteTrack([ball, hand], ball.id)
    expect(remaining).toEqual([hand])
    expect(findTrack(remaining, hand.id)).toBe(hand)
    expect(findTrack(remaining, ball.id)).toBeNull()
  })

  it('reports invalid data and conflicting samples for the same frame', () => {
    const first = sampleFixture('duplicate', 1)
    const invalid: Track = {
      id: '',
      name: '',
      color: '',
      samples: [
        first,
        {
          ...first,
          nativePosition: { x: Number.NaN, y: 4 },
        },
      ],
    }
    expect(validateTrack(invalid).map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'empty-id',
        'empty-name',
        'empty-color',
        'non-finite-position',
        'duplicate-sample-id',
        'duplicate-frame-reference',
      ]),
    )
  })

  it('rejects invalid frame references, non-finite time, and time-anchor mismatch', () => {
    const invalidFrame = {
      scheme: 'timestamp-bucket-v1' as const,
      bucketIndex: -1,
      bucketDuration: 0,
      anchorTime: Number.NaN,
    }
    expect(
      createTrackSample('sample-1', invalidFrame, { x: 1, y: 2 }),
    ).toBeNull()

    const sample = sampleFixture('sample-2', 2)
    const errors = validateTrack({
      ...trackFixture(),
      samples: [{ ...sample, time: Number.POSITIVE_INFINITY }],
    }).map((error) => error.code)
    expect(errors).toContain('non-finite-time')

    expect(
      validateTrack({
        ...trackFixture(),
        samples: [{ ...sample, time: 2.5 }],
      }).map((error) => error.code),
    ).toContain('time-anchor-mismatch')
  })
})
