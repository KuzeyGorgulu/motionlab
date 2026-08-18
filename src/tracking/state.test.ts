import { describe, expect, it } from 'vitest'

import { createFrameReference } from '../video/frameReference'
import { createTrack, createTrackSample } from './model'
import { createTrackingHistory, trackingHistoryReducer } from './state'

const ball = createTrack('track-1', 'Ball', '#4ecdc4')!
const hand = createTrack('track-2', 'Hand', '#ffb454')!
const sample = createTrackSample(
  'sample-1',
  createFrameReference(1),
  { x: 10, y: 20 },
)!

describe('tracking history reducer', () => {
  it('creates multiple independent tracks and selects the newest', () => {
    let history = trackingHistoryReducer(createTrackingHistory(), {
      type: 'create-track',
      track: ball,
    })
    history = trackingHistoryReducer(history, { type: 'create-track', track: hand })
    expect(history.present.tracks).toEqual([ball, hand])
    expect(history.present.activeTrackId).toBe(hand.id)
  })

  it('renames only the requested track', () => {
    let history = createTrackingHistory()
    history = trackingHistoryReducer(history, { type: 'create-track', track: ball })
    history = trackingHistoryReducer(history, { type: 'create-track', track: hand })
    history = trackingHistoryReducer(history, {
      type: 'rename-track',
      id: ball.id,
      name: 'Red Ball',
    })
    expect(history.present.tracks.map((track) => track.name)).toEqual([
      'Red Ball',
      'Hand',
    ])
  })

  it('deletes one track and preserves the other track and active selection', () => {
    let history = createTrackingHistory()
    history = trackingHistoryReducer(history, { type: 'create-track', track: ball })
    history = trackingHistoryReducer(history, { type: 'create-track', track: hand })
    history = trackingHistoryReducer(history, { type: 'delete-track', id: hand.id })
    expect(history.present.tracks).toEqual([ball])
    expect(history.present.activeTrackId).toBe(ball.id)
  })

  it('adds then replaces a same-frame sample as separate undoable mutations', () => {
    let history = trackingHistoryReducer(createTrackingHistory(), {
      type: 'create-track',
      track: ball,
    })
    history = trackingHistoryReducer(history, {
      type: 'upsert-sample',
      trackId: ball.id,
      sample,
    })
    history = trackingHistoryReducer(history, {
      type: 'upsert-sample',
      trackId: ball.id,
      sample: { ...sample, id: 'sample-2', nativePosition: { x: 40, y: 50 } },
    })
    expect(history.present.tracks[0]?.samples).toHaveLength(1)
    expect(history.present.tracks[0]?.samples[0]?.nativePosition).toEqual({ x: 40, y: 50 })

    history = trackingHistoryReducer(history, { type: 'undo' })
    expect(history.present.tracks[0]?.samples[0]?.nativePosition).toEqual({ x: 10, y: 20 })
    history = trackingHistoryReducer(history, { type: 'redo' })
    expect(history.present.tracks[0]?.samples[0]?.nativePosition).toEqual({ x: 40, y: 50 })
  })

  it('moves one sample in one history step', () => {
    let history = trackingHistoryReducer(createTrackingHistory(), {
      type: 'create-track',
      track: ball,
    })
    history = trackingHistoryReducer(history, { type: 'upsert-sample', trackId: ball.id, sample })
    const pastCount = history.past.length
    history = trackingHistoryReducer(history, {
      type: 'update-sample-position',
      trackId: ball.id,
      sampleId: sample.id,
      nativePosition: { x: 80, y: 90 },
    })
    expect(history.past).toHaveLength(pastCount + 1)
    expect(history.present.tracks[0]?.samples[0]?.nativePosition).toEqual({ x: 80, y: 90 })
  })

  it('deletes the current sample but preserves its track', () => {
    let history = trackingHistoryReducer(createTrackingHistory(), {
      type: 'create-track',
      track: ball,
    })
    history = trackingHistoryReducer(history, { type: 'upsert-sample', trackId: ball.id, sample })
    history = trackingHistoryReducer(history, {
      type: 'delete-sample',
      trackId: ball.id,
      sampleId: sample.id,
    })
    expect(history.present.tracks).toHaveLength(1)
    expect(history.present.tracks[0]?.samples).toEqual([])
  })

  it('does not put active-track selection into mutation history', () => {
    let history = trackingHistoryReducer(createTrackingHistory(), {
      type: 'create-track',
      track: ball,
    })
    history = trackingHistoryReducer(history, { type: 'create-track', track: hand })
    const pastCount = history.past.length
    history = trackingHistoryReducer(history, { type: 'set-active-track', id: ball.id })
    expect(history.past).toHaveLength(pastCount)
    expect(history.present.activeTrackId).toBe(ball.id)
  })

  it('clears all video-scoped tracking state on video replacement', () => {
    let history = trackingHistoryReducer(createTrackingHistory(), {
      type: 'create-track',
      track: ball,
    })
    history = trackingHistoryReducer(history, { type: 'video-replaced' })
    expect(history).toEqual(createTrackingHistory())
  })
})
