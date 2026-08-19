import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type RefObject,
} from 'react'

import { VideoFrameExtractor } from '../assistedTracking/frameExtraction'
import { adaptiveSearchPolicyFor } from '../assistedTracking/adaptiveSearch'
import {
  ASSISTED_GEOMETRY_LIMITS,
  assistedTrackingGeometryFor,
} from '../assistedTracking/geometry'
import { motionSearchHint } from '../assistedTracking/motionGuidance'
import {
  recoveryAttemptFor,
  recoveryExhaustedReason,
  recoveryGeometryFor,
  registerRecoveryMiss,
} from '../assistedTracking/recovery'
import {
  assistedSessionReducer,
  createAssistedSession,
} from '../assistedTracking/session'
import { createBrowserAssistedTracker } from '../assistedTracking/tracker'
import { applyTrackedDisplacement } from '../assistedTracking/templateTracker'
import type {
  AssistedFrameDiagnostic,
  AssistedSessionState,
  AssistedTracker,
  TrackingMatch,
} from '../assistedTracking/types'
import { seekToPresentedFrame } from '../assistedTracking/videoFrame'
import { createTrackSample } from '../tracking/model'
import type { Track, TrackSample } from '../tracking/types'
import type { VideoMetadata } from '../types/video'
import {
  createFrameReference,
  frameReferenceKey,
  isSameFrameReference,
} from '../video/frameReference'
import { getFrameStepSeconds } from '../video/timing'

interface AssistedTrackingOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  metadata: VideoMetadata | null
  activeTrack: Track | null
  isPlaying: boolean
  pause: () => void
  insertSampleBatch: (samples: readonly TrackSample[]) => boolean
}

export interface AssistedTrackingController {
  session: AssistedSessionState
  averageProcessingMs: number | null
  beginSeedSelection: () => boolean
  seedFromSample: (sample: TrackSample) => Promise<void>
  start: () => void
  stop: () => void
  stopForExternalInteraction: (reason: string) => void
  cancelSeedSelection: () => void
  acceptSuggestions: () => boolean
  discardSuggestions: () => void
}

function elapsedSince(startedAt: number | null, fallback: number): number {
  return startedAt === null
    ? fallback
    : Math.max(fallback, performance.now() - startedAt)
}

function diagnosticMatchPosition(
  match: TrackingMatch,
  previousSample: TrackSample,
  expectedTemplateCenter: { x: number; y: number },
): { x: number; y: number } | null {
  if (match.status === 'invalid-frame') return null
  const center = match.diagnostics?.bestCandidateCenter
  if (center === undefined) return null
  return applyTrackedDisplacement(previousSample.nativePosition, {
    x: center.x - expectedTemplateCenter.x,
    y: center.y - expectedTemplateCenter.y,
  })
}

function searchBounds(region: {
  origin: { x: number; y: number }
  width: number
  height: number
}) {
  return {
    x: region.origin.x,
    y: region.origin.y,
    width: region.width,
    height: region.height,
  }
}

function preferredRecoverableMiss(
  primary: Extract<TrackingMatch, { status: 'low-confidence' }>,
  fallback: Extract<TrackingMatch, { status: 'low-confidence' }>,
) {
  if (fallback.confidence !== primary.confidence) {
    return fallback.confidence > primary.confidence ? fallback : primary
  }
  return (fallback.score ?? Number.POSITIVE_INFINITY) <
      (primary.score ?? Number.POSITIVE_INFINITY)
    ? fallback
    : primary
}

export function useAssistedTracking({
  videoRef,
  metadata,
  activeTrack,
  isPlaying,
  pause,
  insertSampleBatch,
}: AssistedTrackingOptions): AssistedTrackingController {
  const [session, dispatch] = useReducer(
    assistedSessionReducer,
    undefined,
    createAssistedSession,
  )
  const sessionRef = useRef(session)
  sessionRef.current = session
  const trackerRef = useRef<AssistedTracker | null>(null)
  const extractorRef = useRef<VideoFrameExtractor | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const nextSessionId = useRef(1)
  const runStartedAtRef = useRef<number | null>(null)
  const previousTrackId = useRef(activeTrack?.id ?? null)

  const tracker = useCallback(() => {
    trackerRef.current ??= createBrowserAssistedTracker()
    return trackerRef.current
  }, [])

  const extractor = useCallback(() => {
    extractorRef.current ??= new VideoFrameExtractor()
    return extractorRef.current
  }, [])

  const abortWork = useCallback((resetTracker: boolean) => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    runStartedAtRef.current = null
    if (resetTracker) trackerRef.current?.reset()
  }, [])

  const resetSession = useCallback(() => {
    abortWork(true)
    const sessionId = nextSessionId.current++
    dispatch({ type: 'reset', sessionId })
  }, [abortWork])

  const beginSeedSelection = useCallback((): boolean => {
    if (activeTrack === null || sessionRef.current.status === 'running') return false
    abortWork(true)
    const sessionId = nextSessionId.current++
    dispatch({ type: 'begin-seed', sessionId, trackId: activeTrack.id })
    return true
  }, [abortWork, activeTrack])

  const seedFromSample = useCallback(async (sample: TrackSample) => {
    const video = videoRef.current
    const trackId = activeTrack?.id ?? null
    if (video === null || metadata === null || trackId === null) return

    abortWork(true)
    const selecting = sessionRef.current
    const sessionId =
      selecting.status === 'seed-selecting' && selecting.trackId === trackId
        ? selecting.sessionId
        : nextSessionId.current++
    if (selecting.status !== 'seed-selecting' || selecting.trackId !== trackId) {
      dispatch({ type: 'begin-seed', sessionId, trackId })
    }

    const generation = generationRef.current
    const abortController = new AbortController()
    abortRef.current = abortController
    pause()
    const seekResult = await seekToPresentedFrame(
      video,
      sample.time,
      metadata.duration,
      abortController.signal,
    )
    if (generation !== generationRef.current) return
    if (!seekResult.ok) {
      if (seekResult.cancelled) return
      dispatch({
        type: 'fail',
        sessionId,
        reason: seekResult.reason,
        elapsedMs: 0,
      })
      return
    }

    const nativeSize = { width: video.videoWidth, height: video.videoHeight }
    const geometry = assistedTrackingGeometryFor(nativeSize)
    if (geometry === null) {
      dispatch({
        type: 'fail',
        sessionId,
        reason: 'The video has invalid assisted-tracking geometry.',
        elapsedMs: 0,
      })
      return
    }
    const extracted = extractor().extractTemplate(
      video,
      sample.nativePosition,
      geometry,
    )
    if (!extracted.ok) {
      dispatch({
        type: 'fail',
        sessionId,
        reason: extracted.reason,
        elapsedMs: 0,
      })
      return
    }
    const initialized = await tracker().initialize(extracted.region)
    if (generation !== generationRef.current) return
    abortRef.current = null
    if (!initialized.ok) {
      dispatch({
        type: 'fail',
        sessionId,
        reason: initialized.reason,
        elapsedMs: 0,
      })
      return
    }
    dispatch({
      type: 'seeded',
      sessionId,
      seed: { sample, geometry, nativeSize },
    })
  }, [abortWork, activeTrack?.id, extractor, metadata, pause, tracker, videoRef])

  const runForward = useCallback(async (
    runSession: AssistedSessionState,
    runTrack: Track,
  ) => {
    const video = videoRef.current
    const duration = metadata?.duration ?? null
    if (video === null || duration === null || runSession.seed === null) return

    const sessionId = runSession.sessionId
    const generation = generationRef.current
    const abortController = new AbortController()
    abortRef.current = abortController
    const startedAt = performance.now() - runSession.elapsedMs
    runStartedAtRef.current = startedAt
    dispatch({ type: 'start', sessionId })

    const seedFrame = runSession.seed.sample.frame
    const protectedFrames = new Set(
      runTrack.samples
        .filter((sample) => !isSameFrameReference(sample.frame, seedFrame))
        .map((sample) => frameReferenceKey(sample.frame)),
    )
    const proposedFrames = new Set(
      runSession.suggestions.map((item) => frameReferenceKey(item.sample.frame)),
    )
    let previousSample =
      runSession.suggestions.at(-1)?.sample ?? runSession.seed.sample
    let lastProcessedTime = previousSample.time
    let lastProcessedFrame = previousSample.frame
    let consecutiveMisses = 0
    const motionObservations = [
      runSession.seed.sample,
      ...runSession.suggestions.map((suggestion) => suggestion.sample),
    ].slice(-2).map((sample) => ({
      position: sample.nativePosition,
      time: sample.time,
    }))
    const step = getFrameStepSeconds()

    while (!abortController.signal.aborted && generation === generationRef.current) {
      const requestedTime = lastProcessedTime + step
      const elapsedMs = elapsedSince(startedAt, runSession.elapsedMs)
      if (requestedTime > duration - step * 0.25) {
        dispatch({
          type: 'complete',
          sessionId,
          reason: 'Reached the end of the video.',
          elapsedMs,
        })
        abortRef.current = null
        runStartedAtRef.current = null
        return
      }

      const requestedFrame = createFrameReference(requestedTime)
      const requestedKey = frameReferenceKey(requestedFrame)
      if (isSameFrameReference(requestedFrame, lastProcessedFrame)) {
        dispatch({
          type: 'fail',
          sessionId,
          reason: 'The next timestamp maps to the same frame identity.',
          elapsedMs,
        })
        return
      }
      if (protectedFrames.has(requestedKey)) {
        dispatch({
          type: 'stop',
          sessionId,
          reason: 'Stopped before an existing confirmed sample.',
          elapsedMs,
          canResume: false,
        })
        return
      }

      const seekResult = await seekToPresentedFrame(
        video,
        requestedTime,
        duration,
        abortController.signal,
      )
      if (generation !== generationRef.current) return
      if (!seekResult.ok) {
        if (seekResult.cancelled) return
        dispatch({
          type: 'fail',
          sessionId,
          reason: seekResult.reason,
          elapsedMs: elapsedSince(startedAt, elapsedMs),
        })
        return
      }

      const frame = createFrameReference(seekResult.mediaTime)
      const frameKey = frameReferenceKey(frame)
      if (
        isSameFrameReference(frame, lastProcessedFrame) ||
        proposedFrames.has(frameKey)
      ) {
        dispatch({
          type: 'fail',
          sessionId,
          reason: 'The decoded timestamp repeated an assisted frame identity.',
          elapsedMs: elapsedSince(startedAt, elapsedMs),
        })
        return
      }
      if (protectedFrames.has(frameKey)) {
        dispatch({
          type: 'stop',
          sessionId,
          reason: 'Stopped before an existing confirmed sample.',
          elapsedMs: elapsedSince(startedAt, elapsedMs),
          canResume: false,
        })
        return
      }

      lastProcessedTime = seekResult.mediaTime
      lastProcessedFrame = frame

      const recoveryAttempt = recoveryAttemptFor(consecutiveMisses)
      const searchHint = motionSearchHint(
        motionObservations,
        seekResult.mediaTime,
        runSession.seed.nativeSize,
        ASSISTED_GEOMETRY_LIMITS.maximumRecoveryNativeSearchRadius,
      )
      const adaptivePolicy = searchHint === null
        ? null
        : adaptiveSearchPolicyFor(
            runSession.seed.geometry,
            searchHint.predictedDisplacement,
          )
      const primaryGeometry = adaptivePolicy === null
        ? null
        : recoveryGeometryFor(
            adaptivePolicy.primaryGeometry,
            consecutiveMisses,
          )
      const fallbackGeometry = adaptivePolicy === null
        ? null
        : recoveryGeometryFor(
            adaptivePolicy.fallbackGeometry,
            consecutiveMisses,
          )
      if (
        recoveryAttempt === null ||
        searchHint === null ||
        primaryGeometry === null ||
        fallbackGeometry === null
      ) {
        dispatch({
          type: 'fail',
          sessionId,
          reason: 'The assisted motion or recovery-search geometry is invalid.',
          elapsedMs: elapsedSince(startedAt, elapsedMs),
        })
        return
      }

      const primaryExtraction = extractor().extractSearch(
        video,
        previousSample.nativePosition,
        searchHint.searchCenter,
        primaryGeometry,
        recoveryAttempt,
        searchHint.usedMotionGuidance ? 'predicted' : 'corridor',
      )
      if (!primaryExtraction.ok) {
        dispatch({
          type: 'fail',
          sessionId,
          reason: primaryExtraction.reason,
          elapsedMs: elapsedSince(startedAt, elapsedMs),
        })
        return
      }
      const primaryMatch = await tracker().locate(primaryExtraction.region)
      if (generation !== generationRef.current || abortController.signal.aborted) return
      let match = primaryMatch
      let selectedRegion = primaryExtraction.region
      let selectedGeometry = primaryGeometry
      let searchPass: AssistedFrameDiagnostic['searchPass'] = 'primary'
      let fallbackBounds: AssistedFrameDiagnostic['fallbackSearchBounds'] = null
      let fallbackConfidence: number | null = null

      if (primaryMatch.status === 'low-confidence') {
        const fallbackExtraction = extractor().extractSearch(
          video,
          previousSample.nativePosition,
          searchHint.searchCenter,
          fallbackGeometry,
          recoveryAttempt,
          'corridor',
        )
        if (!fallbackExtraction.ok) {
          dispatch({
            type: 'fail',
            sessionId,
            reason: fallbackExtraction.reason,
            elapsedMs: elapsedSince(startedAt, elapsedMs),
          })
          return
        }
        fallbackBounds = searchBounds(fallbackExtraction.region)
        const fallbackMatch = await tracker().locate(fallbackExtraction.region)
        if (
          generation !== generationRef.current ||
          abortController.signal.aborted
        ) {
          return
        }
        fallbackConfidence = fallbackMatch.status === 'invalid-frame'
          ? null
          : fallbackMatch.confidence
        if (
          fallbackMatch.status === 'low-confidence' &&
          primaryMatch.status === 'low-confidence'
        ) {
          match = preferredRecoverableMiss(primaryMatch, fallbackMatch)
          if (match === fallbackMatch) {
            selectedRegion = fallbackExtraction.region
            selectedGeometry = fallbackGeometry
            searchPass = 'fallback'
          }
        } else {
          match = fallbackMatch
          selectedRegion = fallbackExtraction.region
          selectedGeometry = fallbackGeometry
          searchPass = 'fallback'
        }
      }

      const diagnosticBase = {
        frameKey,
        time: seekResult.mediaTime,
        predictedPosition: { ...searchHint.searchCenter },
        previousAcceptedPosition: { ...previousSample.nativePosition },
        recentDisplacement: searchHint.recentDisplacement === null
          ? null
          : { ...searchHint.recentDisplacement },
        recentVelocity: searchHint.recentVelocity === null
          ? null
          : { ...searchHint.recentVelocity },
        searchRadius: selectedGeometry.nativeSearchRadius,
        primarySearchBounds: searchBounds(primaryExtraction.region),
        fallbackSearchBounds: fallbackBounds,
        primaryConfidence: primaryMatch.status === 'invalid-frame'
          ? null
          : primaryMatch.confidence,
        fallbackConfidence,
        searchPass,
        bestMatchPosition: diagnosticMatchPosition(
          match,
          previousSample,
          selectedRegion.expectedTemplateCenter,
        ),
        confidence: match.status === 'invalid-frame' ? null : match.confidence,
        candidateClusterCount:
          match.status === 'invalid-frame'
            ? null
            : match.diagnostics?.clusterCount ?? null,
        recoveryAttempt,
        templateSource: match.templateSource ?? null,
        templateUpdateEligible:
          match.status === 'match' && match.templateUpdateEligible === true,
        accepted: false,
        resultReason: match.status === 'match' ? null : match.reason,
      } satisfies Omit<AssistedFrameDiagnostic, 'stopReason'>

      if (match.status === 'invalid-frame') {
        const diagnostic: AssistedFrameDiagnostic = {
          ...diagnosticBase,
          stopReason: match.reason,
        }
        dispatch({
          type: 'fail',
          sessionId,
          reason: match.reason,
          elapsedMs: elapsedSince(startedAt, elapsedMs),
          processedFrame: true,
          latestConfidence: null,
          diagnostic,
        })
        return
      }

      if (match.status === 'low-confidence') {
        const miss = registerRecoveryMiss(consecutiveMisses)
        if (miss === null) {
          dispatch({
            type: 'fail',
            sessionId,
            reason: 'The assisted recovery state is invalid.',
            elapsedMs: elapsedSince(startedAt, elapsedMs),
          })
          return
        }
        if (miss.exhausted) {
          const reason = recoveryExhaustedReason(miss.consecutiveMisses)
          dispatch({
            type: 'fail',
            sessionId,
            reason,
            elapsedMs: elapsedSince(startedAt, elapsedMs),
            processedFrame: true,
            latestConfidence: match.confidence,
            consecutiveMisses: miss.consecutiveMisses,
            diagnostic: { ...diagnosticBase, stopReason: reason },
          })
          abortRef.current = null
          runStartedAtRef.current = null
          return
        }
        consecutiveMisses = miss.consecutiveMisses
        dispatch({
          type: 'record-miss',
          sessionId,
          elapsedMs: elapsedSince(startedAt, elapsedMs),
          latestConfidence: match.confidence,
          usedMotionGuidance: searchHint.usedMotionGuidance,
          diagnostic: { ...diagnosticBase, stopReason: null },
        })
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        )
        continue
      }

      const nextAnchor = applyTrackedDisplacement(
        previousSample.nativePosition,
        match.displacement,
      )
      const sample = nextAnchor === null ? null : createTrackSample(
        `assisted-${sessionId}-${frame.bucketIndex}`,
        frame,
        nextAnchor,
      )
      if (sample === null) {
        dispatch({
          type: 'fail',
          sessionId,
          reason: 'The tracker returned an invalid native-video position.',
          elapsedMs: elapsedSince(startedAt, elapsedMs),
        })
        return
      }
      tracker().commitTemplateUpdate()
      proposedFrames.add(frameKey)
      previousSample = sample
      consecutiveMisses = 0
      motionObservations.push({
        position: sample.nativePosition,
        time: sample.time,
      })
      if (motionObservations.length > 2) motionObservations.shift()
      dispatch({
        type: 'record-match',
        sessionId,
        suggestion: {
          sample,
          confidence: match.confidence,
          usedMotionGuidance: searchHint.usedMotionGuidance,
        },
        elapsedMs: elapsedSince(startedAt, elapsedMs),
        diagnostic: {
          ...diagnosticBase,
          bestMatchPosition: { ...sample.nativePosition },
          accepted: true,
          stopReason: null,
        },
      })
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
  }, [extractor, metadata?.duration, tracker, videoRef])

  const start = useCallback(() => {
    const current = sessionRef.current
    if (
      activeTrack === null ||
      current.trackId !== activeTrack.id ||
      current.seed === null ||
      (current.status !== 'seeded' &&
        !(current.status === 'stopped' && current.canResume))
    ) {
      return
    }
    pause()
    abortWork(false)
    void runForward(current, activeTrack)
  }, [abortWork, activeTrack, pause, runForward])

  const stopWithReason = useCallback((reason: string, canResume: boolean) => {
    const current = sessionRef.current
    if (current.status !== 'running') return
    const elapsedMs = elapsedSince(runStartedAtRef.current, current.elapsedMs)
    abortWork(false)
    dispatch({
      type: 'stop',
      sessionId: current.sessionId,
      reason,
      elapsedMs,
      canResume,
    })
  }, [abortWork])

  const stop = useCallback(() => {
    stopWithReason('Stopped by user.', true)
  }, [stopWithReason])

  const stopForExternalInteraction = useCallback((reason: string) => {
    const current = sessionRef.current
    if (current.status === 'running') stopWithReason(reason, false)
    else if (current.status === 'seed-selecting') resetSession()
  }, [resetSession, stopWithReason])

  const acceptSuggestions = useCallback((): boolean => {
    const current = sessionRef.current
    if (current.status === 'running' || current.suggestions.length === 0) return false
    const inserted = insertSampleBatch(
      current.suggestions.map((suggestion) => suggestion.sample),
    )
    if (!inserted) {
      dispatch({
        type: 'accept-failed',
        sessionId: current.sessionId,
        reason: 'Suggestions conflict with confirmed samples. Discard or reseed.',
      })
      return false
    }
    resetSession()
    return true
  }, [insertSampleBatch, resetSession])

  useEffect(() => {
    const nextTrackId = activeTrack?.id ?? null
    if (previousTrackId.current === nextTrackId) return
    previousTrackId.current = nextTrackId
    abortWork(true)
    dispatch({
      type: 'active-track-changed',
      sessionId: nextSessionId.current++,
    })
  }, [abortWork, activeTrack?.id])

  useEffect(() => {
    if (isPlaying) stopForExternalInteraction('Stopped because playback started.')
  }, [isPlaying, stopForExternalInteraction])

  useEffect(() => () => {
    abortWork(false)
    trackerRef.current?.dispose()
    trackerRef.current = null
  }, [abortWork])

  return {
    session,
    averageProcessingMs:
      session.framesProcessed === 0
        ? null
        : session.elapsedMs / session.framesProcessed,
    beginSeedSelection,
    seedFromSample,
    start,
    stop,
    stopForExternalInteraction,
    cancelSeedSelection: resetSession,
    acceptSuggestions,
    discardSuggestions: resetSession,
  }
}
