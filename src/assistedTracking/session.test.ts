import { describe, expect, it } from 'vitest'

import { createTrackSample } from '../tracking/model'
import { createFrameReference } from '../video/frameReference'
import { assistedSessionReducer, createAssistedSession } from './session'
import { recoveryExhaustedReason } from './recovery'
import type { AssistedFrameDiagnostic } from './types'

const seed = {
  sample: createTrackSample(
    'seed',
    createFrameReference(1),
    { x: 10, y: 20 },
  )!,
  geometry: {
    templateSize: 33,
    coarseScale: 3,
    coarseRadius: 36,
    coarseStep: 1,
    nativeSearchRadius: 108,
    refinementRadius: 6,
  },
  nativeSize: { width: 1920, height: 1080 },
}
const suggestion = {
  sample: createTrackSample(
    'assisted-1',
    createFrameReference(1 + 1 / 30),
    { x: 12, y: 21 },
  )!,
  confidence: 0.91,
  usedMotionGuidance: true,
}
const reacquiredSuggestion = {
  ...suggestion,
  sample: createTrackSample(
    'assisted-2',
    createFrameReference(1 + 2 / 30),
    { x: 14, y: 22 },
  )!,
}

function diagnostic(
  time: number,
  recoveryAttempt: number,
  searchRadius: number,
  accepted = false,
): AssistedFrameDiagnostic {
  return {
    frameKey: `frame-${time}`,
    time,
    predictedPosition: { x: 12, y: 21 },
    previousAcceptedPosition: { x: 10, y: 20 },
    recentDisplacement: { x: 2, y: 1 },
    recentVelocity: { x: 60, y: 30 },
    searchRadius,
    primarySearchBounds: { x: 0, y: 0, width: 100, height: 100 },
    fallbackSearchBounds: null,
    primaryConfidence: accepted ? 0.91 : 0.42,
    fallbackConfidence: null,
    searchPass: 'primary',
    bestMatchPosition: accepted ? { x: 14, y: 22 } : null,
    confidence: accepted ? 0.91 : 0.42,
    candidateClusterCount: 2,
    recoveryAttempt,
    templateSource: 'current',
    templateUpdateEligible: accepted,
    accepted,
    resultReason: accepted ? null : 'The match confidence is too low.',
    stopReason: null,
  }
}

function runningSession() {
  let state = assistedSessionReducer(createAssistedSession(), {
    type: 'begin-seed',
    sessionId: 1,
    trackId: 'track-1',
  })
  state = assistedSessionReducer(state, { type: 'seeded', sessionId: 1, seed })
  return assistedSessionReducer(state, { type: 'start', sessionId: 1 })
}

describe('assisted tracking session', () => {
  it('moves from seed selection to seeded and running', () => {
    const state = runningSession()
    expect(state.status).toBe('running')
    expect(state.seed).toEqual(seed)
    expect(state.trackId).toBe('track-1')
  })

  it('records progress then stops with resumable suggestions', () => {
    let state = runningSession()
    state = assistedSessionReducer(state, {
      type: 'record-match',
      sessionId: 1,
      suggestion,
      elapsedMs: 18,
    })
    state = assistedSessionReducer(state, {
      type: 'stop',
      sessionId: 1,
      reason: 'Stopped by user.',
      elapsedMs: 20,
      canResume: true,
    })
    expect(state.status).toBe('stopped')
    expect(state.suggestions).toEqual([suggestion])
    expect(state.framesProcessed).toBe(1)
    expect(state.latestUsedMotionGuidance).toBe(true)
    expect(state.canResume).toBe(true)
  })

  it('exposes a low-confidence failure without adding a suggestion', () => {
    const state = assistedSessionReducer(runningSession(), {
      type: 'fail',
      sessionId: 1,
      reason: 'Several candidates look equally plausible.',
      elapsedMs: 24,
      processedFrame: true,
      latestConfidence: 0.42,
    })
    expect(state.status).toBe('failed')
    expect(state.failureReason).toMatch(/equally plausible/i)
    expect(state.suggestions).toEqual([])
    expect(state.framesProcessed).toBe(1)
    expect(state.latestConfidence).toBe(0.42)
  })

  it('survives one missed frame, leaves a gap, and resets on reacquisition', () => {
    let state = assistedSessionReducer(runningSession(), {
      type: 'record-miss',
      sessionId: 1,
      elapsedMs: 20,
      latestConfidence: 0.42,
      usedMotionGuidance: true,
      diagnostic: diagnostic(1 + 1 / 30, 0, 108),
    })
    expect(state.status).toBe('running')
    expect(state.suggestions).toEqual([])
    expect(state.consecutiveMisses).toBe(1)

    state = assistedSessionReducer(state, {
      type: 'record-match',
      sessionId: 1,
      suggestion: reacquiredSuggestion,
      elapsedMs: 42,
      diagnostic: diagnostic(1 + 2 / 30, 1, 147, true),
    })
    expect(state.status).toBe('running')
    expect(state.suggestions).toEqual([reacquiredSuggestion])
    expect(state.suggestions[0]?.sample.time).toBeCloseTo(1 + 2 / 30)
    expect(state.consecutiveMisses).toBe(0)
    expect(state.framesProcessed).toBe(2)
    expect(state.diagnostics.map((item) => item.accepted)).toEqual([false, true])
  })

  it('expands through multiple misses and returns to normal after recovery', () => {
    let state = runningSession()
    state = assistedSessionReducer(state, {
      type: 'record-miss',
      sessionId: 1,
      elapsedMs: 20,
      latestConfidence: 0.4,
      usedMotionGuidance: true,
      diagnostic: diagnostic(1 + 1 / 30, 0, 108),
    })
    state = assistedSessionReducer(state, {
      type: 'record-miss',
      sessionId: 1,
      elapsedMs: 40,
      latestConfidence: 0.45,
      usedMotionGuidance: true,
      diagnostic: diagnostic(1 + 2 / 30, 1, 147),
    })
    state = assistedSessionReducer(state, {
      type: 'record-match',
      sessionId: 1,
      suggestion: {
        ...reacquiredSuggestion,
        sample: createTrackSample(
          'assisted-3',
          createFrameReference(1 + 3 / 30),
          { x: 16, y: 23 },
        )!,
      },
      elapsedMs: 60,
      diagnostic: diagnostic(1 + 3 / 30, 2, 186, true),
    })

    expect(state.status).toBe('running')
    expect(state.consecutiveMisses).toBe(0)
    expect(state.diagnostics.map((item) => item.searchRadius)).toEqual([
      108,
      147,
      186,
    ])
  })

  it('stops cleanly when the fourth consecutive miss exhausts recovery', () => {
    let state = runningSession()
    const radii = [108, 147, 186]
    for (let index = 0; index < radii.length; index += 1) {
      state = assistedSessionReducer(state, {
        type: 'record-miss',
        sessionId: 1,
        elapsedMs: (index + 1) * 20,
        latestConfidence: 0.4,
        usedMotionGuidance: true,
        diagnostic: diagnostic(1 + (index + 1) / 30, index, radii[index]!),
      })
    }
    const reason = recoveryExhaustedReason(4)
    state = assistedSessionReducer(state, {
      type: 'fail',
      sessionId: 1,
      reason,
      elapsedMs: 80,
      processedFrame: true,
      latestConfidence: 0.3,
      consecutiveMisses: 4,
      diagnostic: {
        ...diagnostic(1 + 4 / 30, 3, 216),
        stopReason: reason,
      },
    })

    expect(state.status).toBe('failed')
    expect(state.failureReason).toBe(reason)
    expect(state.suggestions).toEqual([])
    expect(state.framesProcessed).toBe(4)
    expect(state.consecutiveMisses).toBe(4)
    expect(state.diagnostics.at(-1)?.stopReason).toBe(reason)
  })

  it('supports non-resumable cancellation', () => {
    const state = assistedSessionReducer(runningSession(), {
      type: 'stop',
      sessionId: 1,
      reason: 'Playback started.',
      elapsedMs: 10,
      canResume: false,
    })
    expect(state.status).toBe('stopped')
    expect(state.canResume).toBe(false)
  })

  it('ignores stale asynchronous results from an older session', () => {
    const current = assistedSessionReducer(runningSession(), {
      type: 'reset',
      sessionId: 2,
    })
    const stale = assistedSessionReducer(current, {
      type: 'record-match',
      sessionId: 1,
      suggestion,
      elapsedMs: 100,
    })
    expect(stale).toBe(current)
  })

  it('ignores a late recovery miss after cancellation resets the session', () => {
    const current = assistedSessionReducer(runningSession(), {
      type: 'reset',
      sessionId: 2,
    })
    const stale = assistedSessionReducer(current, {
      type: 'record-miss',
      sessionId: 1,
      elapsedMs: 100,
      latestConfidence: 0.4,
      usedMotionGuidance: true,
      diagnostic: diagnostic(1 + 1 / 30, 0, 108),
    })
    expect(stale).toBe(current)
    expect(stale.diagnostics).toEqual([])
  })

  it('clears observation guidance when a new seed session begins', () => {
    let state = assistedSessionReducer(runningSession(), {
      type: 'record-match',
      sessionId: 1,
      suggestion,
      elapsedMs: 18,
    })
    expect(state.latestUsedMotionGuidance).toBe(true)
    state = assistedSessionReducer(state, {
      type: 'begin-seed',
      sessionId: 2,
      trackId: 'track-1',
    })
    expect(state.status).toBe('seed-selecting')
    expect(state.seed).toBeNull()
    expect(state.suggestions).toEqual([])
    expect(state.latestUsedMotionGuidance).toBeNull()
    expect(state.consecutiveMisses).toBe(0)
    expect(state.diagnostics).toEqual([])
  })

  it('resets transient state for video replacement and active-track changes', () => {
    const videoReset = assistedSessionReducer(runningSession(), {
      type: 'video-replaced',
      sessionId: 2,
    })
    const trackReset = assistedSessionReducer(runningSession(), {
      type: 'active-track-changed',
      sessionId: 3,
    })
    expect(videoReset).toEqual(createAssistedSession(2))
    expect(trackReset).toEqual(createAssistedSession(3))
    expect(videoReset.latestUsedMotionGuidance).toBeNull()
    expect(trackReset.latestUsedMotionGuidance).toBeNull()
    expect(videoReset.consecutiveMisses).toBe(0)
    expect(trackReset.diagnostics).toEqual([])
  })
})
