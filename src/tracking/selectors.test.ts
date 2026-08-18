import { describe, expect, it } from 'vitest'

import { createCalibration } from '../calibration/model'
import { createFrameReference } from '../video/frameReference'
import { createTrack, createTrackSample, insertOrReplaceTrackSample } from './model'
import {
  currentFrameTrackSample,
  deriveWorldTrackSamples,
  partitionTrackSamples,
  visibleTrackSamples,
} from './selectors'
import type { Track } from './types'

function populatedTrack(): Track {
  let track = createTrack('track-1', 'Ball', '#4ecdc4')!
  for (const [id, time, x] of [
    ['third', 3, 30],
    ['first', 1, 10],
    ['second', 2, 20],
  ] as const) {
    track = insertOrReplaceTrackSample(
      track,
      createTrackSample(id, createFrameReference(time), { x, y: 0 })!,
    )
  }
  return track
}

describe('track selectors', () => {
  it('finds the current sample by frame identity, not timestamp equality', () => {
    const track = populatedTrack()
    expect(currentFrameTrackSample(track, createFrameReference(2.000001))?.id).toBe(
      'second',
    )
  })

  it('partitions ordered past, current, and future samples', () => {
    const partition = partitionTrackSamples(
      populatedTrack(),
      createFrameReference(2),
      2,
    )
    expect(partition.past.map((sample) => sample.id)).toEqual(['first'])
    expect(partition.current?.id).toBe('second')
    expect(partition.future.map((sample) => sample.id)).toEqual(['third'])
  })

  it('supports all, past, and current trajectory visibility', () => {
    const track = populatedTrack()
    const frame = createFrameReference(2)
    expect(visibleTrackSamples(track, frame, 2, 'all').map((item) => item.id)).toEqual([
      'first',
      'second',
      'third',
    ])
    expect(visibleTrackSamples(track, frame, 2, 'past').map((item) => item.id)).toEqual([
      'first',
      'second',
    ])
    expect(visibleTrackSamples(track, frame, 2, 'current').map((item) => item.id)).toEqual([
      'second',
    ])
  })

  it('derives ordered world positions without persisting them', () => {
    const track = populatedTrack()
    const calibration = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 1,
      unit: 'm',
    })
    if (!calibration.ok) throw new Error('fixture calibration should be valid')

    const derived = deriveWorldTrackSamples(track, calibration.calibration)
    expect(derived.map((sample) => sample.worldPosition.x)).toEqual([1, 2, 3])
    expect(track.samples.every((sample) => !('worldPosition' in sample))).toBe(true)
  })

  it('reflects calibration changes while native trajectory stays unchanged', () => {
    const track = populatedTrack()
    const oneMeter = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 1,
      unit: 'm',
    })
    const twoMeters = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 2,
      unit: 'm',
    })
    if (!oneMeter.ok || !twoMeters.ok) throw new Error('fixtures should be valid')

    const before = track.samples.map((sample) => sample.nativePosition)
    expect(deriveWorldTrackSamples(track, oneMeter.calibration)[0]?.worldPosition.x).toBe(1)
    expect(deriveWorldTrackSamples(track, twoMeters.calibration)[0]?.worldPosition.x).toBe(2)
    expect(track.samples.map((sample) => sample.nativePosition)).toEqual(before)
  })
})
