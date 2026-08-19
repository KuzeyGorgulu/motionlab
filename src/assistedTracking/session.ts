import type {
  AssistedFrameDiagnostic,
  AssistedSeed,
  AssistedSessionState,
  AssistedSuggestion,
} from './types'

export const MAX_ASSISTED_FRAME_DIAGNOSTICS = 120

export type AssistedSessionAction =
  | { type: 'begin-seed'; sessionId: number; trackId: string }
  | { type: 'seeded'; sessionId: number; seed: AssistedSeed }
  | { type: 'start'; sessionId: number }
  | {
      type: 'record-match'
      sessionId: number
      suggestion: AssistedSuggestion
      elapsedMs: number
      diagnostic?: AssistedFrameDiagnostic
    }
  | {
      type: 'record-miss'
      sessionId: number
      elapsedMs: number
      latestConfidence: number | null
      usedMotionGuidance: boolean
      diagnostic: AssistedFrameDiagnostic
    }
  | {
      type: 'stop'
      sessionId: number
      reason: string
      elapsedMs: number
      canResume: boolean
    }
  | {
      type: 'fail'
      sessionId: number
      reason: string
      elapsedMs: number
      processedFrame?: boolean
      latestConfidence?: number | null
      consecutiveMisses?: number
      diagnostic?: AssistedFrameDiagnostic
    }
  | { type: 'complete'; sessionId: number; reason: string; elapsedMs: number }
  | { type: 'accept-failed'; sessionId: number; reason: string }
  | { type: 'reset'; sessionId: number }
  | { type: 'video-replaced'; sessionId: number }
  | { type: 'active-track-changed'; sessionId: number }

export function createAssistedSession(sessionId = 0): AssistedSessionState {
  return {
    sessionId,
    status: 'idle',
    trackId: null,
    seed: null,
    suggestions: [],
    framesProcessed: 0,
    latestConfidence: null,
    latestUsedMotionGuidance: null,
    consecutiveMisses: 0,
    diagnostics: [],
    failureReason: null,
    elapsedMs: 0,
    canResume: false,
  }
}

function appendDiagnostic(
  diagnostics: readonly AssistedFrameDiagnostic[],
  diagnostic: AssistedFrameDiagnostic | undefined,
): AssistedFrameDiagnostic[] {
  if (diagnostic === undefined) return [...diagnostics]
  return [...diagnostics, diagnostic].slice(-MAX_ASSISTED_FRAME_DIAGNOSTICS)
}

function isCurrentSession(
  state: AssistedSessionState,
  action: AssistedSessionAction,
): boolean {
  return action.type === 'begin-seed' || action.type === 'reset' ||
    action.type === 'video-replaced' || action.type === 'active-track-changed'
    ? true
    : action.sessionId === state.sessionId
}

export function assistedSessionReducer(
  state: AssistedSessionState,
  action: AssistedSessionAction,
): AssistedSessionState {
  if (!isCurrentSession(state, action)) return state

  switch (action.type) {
    case 'begin-seed':
      return {
        ...createAssistedSession(action.sessionId),
        status: 'seed-selecting',
        trackId: action.trackId,
      }
    case 'seeded':
      if (state.status !== 'seed-selecting') return state
      return {
        ...state,
        status: 'seeded',
        seed: action.seed,
        failureReason: null,
      }
    case 'start':
      if (
        state.seed === null ||
        (state.status !== 'seeded' &&
          !(state.status === 'stopped' && state.canResume))
      ) {
        return state
      }
      return {
        ...state,
        status: 'running',
        failureReason: null,
        canResume: false,
        consecutiveMisses: 0,
      }
    case 'record-match':
      if (state.status !== 'running') return state
      return {
        ...state,
        suggestions: [...state.suggestions, action.suggestion],
        framesProcessed: state.framesProcessed + 1,
        latestConfidence: action.suggestion.confidence,
        latestUsedMotionGuidance: action.suggestion.usedMotionGuidance,
        consecutiveMisses: 0,
        diagnostics: appendDiagnostic(state.diagnostics, action.diagnostic),
        elapsedMs: action.elapsedMs,
      }
    case 'record-miss':
      if (state.status !== 'running') return state
      return {
        ...state,
        framesProcessed: state.framesProcessed + 1,
        latestConfidence: action.latestConfidence,
        latestUsedMotionGuidance: action.usedMotionGuidance,
        consecutiveMisses: state.consecutiveMisses + 1,
        diagnostics: appendDiagnostic(state.diagnostics, action.diagnostic),
        elapsedMs: action.elapsedMs,
      }
    case 'stop':
      if (state.status !== 'running') return state
      return {
        ...state,
        status: 'stopped',
        failureReason: action.reason,
        elapsedMs: action.elapsedMs,
        canResume: action.canResume,
      }
    case 'fail':
      if (state.status !== 'running' && state.status !== 'seed-selecting') {
        return state
      }
      return {
        ...state,
        status: 'failed',
        failureReason: action.reason,
        elapsedMs: action.elapsedMs,
        framesProcessed:
          state.framesProcessed + (action.processedFrame === true ? 1 : 0),
        latestConfidence:
          action.latestConfidence === undefined
            ? state.latestConfidence
            : action.latestConfidence,
        consecutiveMisses:
          action.consecutiveMisses ?? state.consecutiveMisses,
        diagnostics: appendDiagnostic(state.diagnostics, action.diagnostic),
        canResume: false,
      }
    case 'complete':
      if (state.status !== 'running') return state
      return {
        ...state,
        status: 'completed',
        failureReason: action.reason,
        elapsedMs: action.elapsedMs,
        canResume: false,
      }
    case 'accept-failed':
      if (state.status === 'running' || state.status === 'idle') return state
      return {
        ...state,
        status: 'failed',
        failureReason: action.reason,
        canResume: false,
      }
    case 'reset':
    case 'video-replaced':
    case 'active-track-changed':
      return createAssistedSession(action.sessionId)
  }
}
