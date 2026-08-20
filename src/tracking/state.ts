import {
  deleteTrack,
  deleteTrackSample,
  findTrack,
  insertTrackSamplesBatch,
  insertOrReplaceTrackSample,
  renameTrack,
  updateTrackSamplePosition,
  validateTrack,
} from './model'
import type {
  Track,
  TrackSample,
  TrackingHistory,
  TrackingSnapshot,
} from './types'
import type { Point } from '../video/geometry'

export type TrackingAction =
  | { type: 'create-track'; track: Track }
  | { type: 'set-active-track'; id: string | null }
  | { type: 'rename-track'; id: string; name: string }
  | { type: 'delete-track'; id: string }
  | { type: 'upsert-sample'; trackId: string; sample: TrackSample }
  | { type: 'insert-samples-batch'; trackId: string; samples: TrackSample[] }
  | {
      type: 'update-sample-position'
      trackId: string
      sampleId: string
      nativePosition: Point
    }
  | { type: 'delete-sample'; trackId: string; sampleId: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'video-replaced' }

const HISTORY_LIMIT = 100

export function createTrackingHistory(
  snapshot: TrackingSnapshot = { tracks: [], activeTrackId: null },
): TrackingHistory {
  return {
    past: [],
    present: { tracks: [...snapshot.tracks], activeTrackId: snapshot.activeTrackId },
    future: [],
  }
}

function commit(
  history: TrackingHistory,
  present: TrackingSnapshot,
): TrackingHistory {
  if (present === history.present) return history
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
  }
}

function updateTrack(
  snapshot: TrackingSnapshot,
  trackId: string,
  update: (track: Track) => Track,
): TrackingSnapshot {
  let changed = false
  const tracks = snapshot.tracks.map((track) => {
    if (track.id !== trackId) return track
    const next = update(track)
    changed = next !== track
    return next
  })
  return changed ? { ...snapshot, tracks } : snapshot
}

export function trackingHistoryReducer(
  history: TrackingHistory,
  action: TrackingAction,
): TrackingHistory {
  switch (action.type) {
    case 'create-track': {
      if (
        validateTrack(action.track).length > 0 ||
        findTrack(history.present.tracks, action.track.id) !== null
      ) {
        return history
      }
      return commit(history, {
        tracks: [...history.present.tracks, action.track],
        activeTrackId: action.track.id,
      })
    }
    case 'set-active-track': {
      const activeTrackId =
        findTrack(history.present.tracks, action.id) === null ? null : action.id
      if (activeTrackId === history.present.activeTrackId) return history
      return {
        ...history,
        present: { ...history.present, activeTrackId },
      }
    }
    case 'rename-track':
      return commit(
        history,
        updateTrack(history.present, action.id, (track) =>
          renameTrack(track, action.name),
        ),
      )
    case 'delete-track': {
      const deletedIndex = history.present.tracks.findIndex(
        (track) => track.id === action.id,
      )
      if (deletedIndex < 0) return history
      const tracks = deleteTrack(history.present.tracks, action.id)
      const activeTrackId =
        history.present.activeTrackId === action.id
          ? (tracks[Math.min(deletedIndex, tracks.length - 1)]?.id ?? null)
          : history.present.activeTrackId
      return commit(history, { tracks, activeTrackId })
    }
    case 'upsert-sample':
      return commit(
        history,
        updateTrack(history.present, action.trackId, (track) =>
          insertOrReplaceTrackSample(track, action.sample),
        ),
      )
    case 'insert-samples-batch':
      return commit(
        history,
        updateTrack(history.present, action.trackId, (track) => {
          const result = insertTrackSamplesBatch(track, action.samples)
          return result.ok ? result.track : track
        }),
      )
    case 'update-sample-position':
      return commit(
        history,
        updateTrack(history.present, action.trackId, (track) =>
          updateTrackSamplePosition(track, action.sampleId, action.nativePosition),
        ),
      )
    case 'delete-sample':
      return commit(
        history,
        updateTrack(history.present, action.trackId, (track) =>
          deleteTrackSample(track, action.sampleId),
        ),
      )
    case 'undo': {
      const previous = history.past.at(-1)
      if (previous === undefined) return history
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      }
    }
    case 'redo': {
      const next = history.future[0]
      if (next === undefined) return history
      return {
        past: [...history.past, history.present].slice(-HISTORY_LIMIT),
        present: next,
        future: history.future.slice(1),
      }
    }
    case 'video-replaced':
      return createTrackingHistory()
  }
}
