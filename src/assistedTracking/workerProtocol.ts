import type {
  PixelRegion,
  SearchPixelRegion,
  TrackerInitializationResult,
  TrackingMatch,
} from './types'

export type TrackerWorkerRequest =
  | { type: 'initialize'; requestId: number; template: PixelRegion }
  | { type: 'locate'; requestId: number; searchRegion: SearchPixelRegion }
  | { type: 'commit-template' }
  | { type: 'reset' }

export type TrackerWorkerResponse =
  | {
      type: 'initialized'
      requestId: number
      result: TrackerInitializationResult
    }
  | { type: 'located'; requestId: number; result: TrackingMatch }
