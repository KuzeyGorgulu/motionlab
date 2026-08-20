import type { Track } from '../../tracking/types'
import { deriveWorkflowGuidance } from '../../ux/workflowGuidance'

interface GettingStartedPanelProps {
  hasCalibration: boolean
  tracks: readonly Track[]
  activeTrackId: string | null
}

export function GettingStartedPanel({
  hasCalibration,
  tracks,
  activeTrackId,
}: GettingStartedPanelProps) {
  const guidance = deriveWorkflowGuidance({
    videoLoaded: true,
    hasCalibration,
    tracks,
    activeTrackId,
  })

  return (
    <section
      className={`inspector__section getting-started${guidance.analysisReady ? ' getting-started--ready' : ''}`}
      aria-labelledby="getting-started-title"
    >
      <div className="inspector__heading-row">
        <h2 id="getting-started-title">Getting started</h2>
        <span>{guidance.completedRequiredSteps}/3</span>
      </div>
      <div className="getting-started__task" aria-live="polite">
        <strong>{guidance.currentTask.title}</strong>
        <span>{guidance.currentTask.description}</span>
      </div>
      <ol className="getting-started__steps">
        {guidance.steps.map((step, index) => (
          <li
            className={`getting-started__step getting-started__step--${step.status}`}
            key={step.id}
            aria-current={step.status === 'current' ? 'step' : undefined}
          >
            <span className="getting-started__number" aria-hidden="true">
              {step.status === 'complete' ? '✓' : index + 1}
            </span>
            <span className="getting-started__copy">
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </span>
            <span className="getting-started__status">{step.statusLabel}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
