import type { AssistedSessionState } from '../../assistedTracking/types'

interface AssistedTrackingControlsProps {
  session: AssistedSessionState
  averageProcessingMs: number | null
  hasCurrentSample: boolean
  onAccept: () => void
  onBeginSeed: () => void
  onCancelSeed: () => void
  onDiscard: () => void
  onStart: () => void
  onStop: () => void
}

const STATUS_LABELS: Record<AssistedSessionState['status'], string> = {
  idle: 'Idle',
  'seed-selecting': 'Select target on video',
  seeded: 'Seeded',
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Stopped — uncertain',
  completed: 'Completed',
}

export function AssistedTrackingControls({
  session,
  averageProcessingMs,
  hasCurrentSample,
  onAccept,
  onBeginSeed,
  onCancelSeed,
  onDiscard,
  onStart,
  onStop,
}: AssistedTrackingControlsProps) {
  const canStart =
    session.status === 'seeded' ||
    (session.status === 'stopped' && session.canResume)
  const canSeed =
    session.status !== 'running' && session.suggestions.length === 0
  const canResolve = session.status !== 'idle' && session.status !== 'running'

  return (
    <section className="assisted-tracking" aria-labelledby="assisted-tracking-title">
      <div className="assisted-tracking__heading">
        <strong id="assisted-tracking-title">Assisted tracking</strong>
        <span>Experimental</span>
      </div>
      <p>Forward-only local template matching. Skips uncertainty instead of guessing.</p>

      <div className="assisted-tracking__status" aria-live="polite">
        <span>Status</span>
        <strong>{STATUS_LABELS[session.status]}</strong>
        <span>Direction</span>
        <strong>Forward</strong>
      </div>

      <div className="assisted-tracking__actions">
        {session.status === 'seed-selecting' ? (
          <button onClick={onCancelSeed} type="button">Cancel seed</button>
        ) : (
          <button disabled={!canSeed} onClick={onBeginSeed} type="button">
            {hasCurrentSample ? 'Seed current sample' : 'Seed target'}
          </button>
        )}
        {session.status === 'running' ? (
          <button className="calibration-action calibration-action--danger" onClick={onStop} type="button">
            Stop
          </button>
        ) : (
          <button disabled={!canStart} onClick={onStart} type="button">Start</button>
        )}
      </div>

      {(session.framesProcessed > 0 || session.latestConfidence !== null) && (
        <dl className="assisted-tracking__metrics">
          <div>
            <dt>Confidence</dt>
            <dd>{session.latestConfidence?.toFixed(2) ?? '—'}</dd>
          </div>
          <div>
            <dt>Processed</dt>
            <dd>{session.framesProcessed} frames</dd>
          </div>
          <div>
            <dt>Elapsed</dt>
            <dd>{(session.elapsedMs / 1000).toFixed(2)} s</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd>{averageProcessingMs === null ? '—' : `${averageProcessingMs.toFixed(1)} ms/frame`}</dd>
          </div>
        </dl>
      )}

      {session.failureReason !== null && (
        <p
          className={session.status === 'failed' ? 'assisted-tracking__message assisted-tracking__message--failure' : 'assisted-tracking__message'}
          role={session.status === 'failed' ? 'alert' : 'status'}
        >
          {session.failureReason}
        </p>
      )}

      {canResolve && (
        <div className="assisted-tracking__resolve">
          <button
            disabled={session.suggestions.length === 0}
            onClick={onAccept}
            type="button"
          >
            Accept suggestions ({session.suggestions.length})
          </button>
          <button onClick={onDiscard} type="button">Discard</button>
        </div>
      )}
    </section>
  )
}
