import type { TrackSample } from '../tracking/types'
import type { Point, Size } from '../video/geometry'

export interface GrayImage {
  width: number
  height: number
  pixels: Uint8Array
}

export interface PixelRegion {
  width: number
  height: number
  origin: Point
  pixels: Uint8ClampedArray
}

export interface SearchPixelRegion extends PixelRegion {
  expectedTemplateCenter: Point
  searchCenter: Point
  geometry: AssistedTrackingGeometry
  recoveryAttempt: number
  includeObservationCenter: boolean
}

export interface AssistedTrackingGeometry {
  templateSize: number
  coarseScale: number
  coarseRadius: number
  coarseStep: number
  nativeSearchRadius: number
  refinementRadius: number
}

export interface MatchDiagnostics {
  refinedCandidateCount: number
  retainedRepresentativeCount: number
  clusterCount: number
  bestClusterCandidateCount: number
  clusterRadius: number
  bestClusterScore: number
  secondClusterScore: number | null
  bestSecondClusterSeparation: number | null
  ambiguityMargin: number | null
  motionTieBreakUsed: false
  bestCandidateCenter: Point
}

export type AssistedTemplateSource = 'current' | 'seed'
export type AssistedSearchPass = 'primary' | 'fallback'

export interface AssistedSearchBounds {
  x: number
  y: number
  width: number
  height: number
}

export type TemplateMatch =
  | {
      status: 'match'
      matchedCenter: Point
      confidence: number
      score: number
      diagnostics?: MatchDiagnostics
    }
  | {
      status: 'low-confidence'
      confidence: number
      score: number | null
      reason: string
      diagnostics?: MatchDiagnostics
    }
  | {
      status: 'invalid-frame'
      reason: string
    }

export type TrackingMatch =
  | {
      status: 'match'
      displacement: Point
      confidence: number
      score: number
      diagnostics?: MatchDiagnostics
      templateSource?: AssistedTemplateSource
      templateUpdateEligible?: boolean
    }
  | {
      status: 'low-confidence'
      confidence: number
      score: number | null
      reason: string
      diagnostics?: MatchDiagnostics
      templateSource?: AssistedTemplateSource
    }
  | {
      status: 'invalid-frame'
      reason: string
      templateSource?: AssistedTemplateSource
    }

export type TrackerInitializationResult =
  | { ok: true }
  | { ok: false; reason: string }

export interface AssistedTracker {
  initialize(template: PixelRegion): Promise<TrackerInitializationResult>
  locate(searchRegion: SearchPixelRegion): Promise<TrackingMatch>
  commitTemplateUpdate(): void
  reset(): void
  dispose(): void
}

export interface AssistedSeed {
  sample: TrackSample
  geometry: AssistedTrackingGeometry
  nativeSize: Size
}

export interface AssistedSuggestion {
  sample: TrackSample
  confidence: number
  usedMotionGuidance: boolean
}

export interface AssistedFrameDiagnostic {
  frameKey: string
  time: number
  predictedPosition: Point
  previousAcceptedPosition: Point
  recentDisplacement: Point | null
  recentVelocity: Point | null
  searchRadius: number
  primarySearchBounds: AssistedSearchBounds
  fallbackSearchBounds: AssistedSearchBounds | null
  primaryConfidence: number | null
  fallbackConfidence: number | null
  searchPass: AssistedSearchPass
  bestMatchPosition: Point | null
  confidence: number | null
  candidateClusterCount: number | null
  recoveryAttempt: number
  templateSource: AssistedTemplateSource | null
  templateUpdateEligible: boolean
  accepted: boolean
  resultReason: string | null
  stopReason: string | null
}

export type AssistedSessionStatus =
  | 'idle'
  | 'seed-selecting'
  | 'seeded'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'completed'

export interface AssistedSessionState {
  sessionId: number
  status: AssistedSessionStatus
  trackId: string | null
  seed: AssistedSeed | null
  suggestions: AssistedSuggestion[]
  framesProcessed: number
  latestConfidence: number | null
  latestUsedMotionGuidance: boolean | null
  consecutiveMisses: number
  diagnostics: AssistedFrameDiagnostic[]
  failureReason: string | null
  elapsedMs: number
  canResume: boolean
}
