import { useState } from 'react'

import { ProductDialog } from './ProductDialog'

const ONBOARDING_STEPS = [
  {
    title: 'Welcome to MotionLab',
    label: 'Welcome',
    body: (
      <>
        <p id="onboarding-description">
          MotionLab turns motion in a local video into inspectable measurements,
          graphs, model fits, residual diagnostics, and experiment reports.
        </p>
        <div className="onboarding-highlight">
          <strong>Your video stays local</strong>
          <span>MotionLab processes selected videos in this browser. No account, upload, or API key is required.</span>
        </div>
      </>
    ),
  },
  {
    title: 'A clear experiment workflow',
    label: 'Workflow',
    body: (
      <>
        <p>Move through the experiment at your own pace. Calibration is optional; uncalibrated analysis remains available in pixels.</p>
        <ol className="onboarding-workflow" aria-label="MotionLab workflow">
          {['Import', 'Calibrate', 'Track', 'Analyze', 'Fit', 'Report'].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="product-dialog__note">Tracking observations stay editable, and derived results update from those confirmed points.</p>
      </>
    ),
  },
  {
    title: 'Controls stay close to the work',
    label: 'Controls',
    body: (
      <>
        <ul className="onboarding-list">
          <li><strong>Timeline and transport</strong><span>Play, seek, and step through the video approximately one frame at a time.</span></li>
          <li><strong>Annotations</strong><span>Use Point, Line, and Angle tools for frame-associated measurements.</span></li>
          <li><strong>Tracking</strong><span>Create a track, then mark the same physical point across video positions.</span></li>
          <li><strong>Keyboard</strong><span>Press <kbd>?</kbd> at any time to review the available shortcuts.</span></li>
        </ul>
      </>
    ),
  },
  {
    title: 'Projects store analysis, not video',
    label: 'Local files',
    body: (
      <>
        <p>
          A <code>.motionlab</code> project stores annotations, calibration, confirmed tracks,
          workspace settings, and report preferences. It never embeds the original video.
        </p>
        <div className="onboarding-highlight">
          <strong>Plan to relink</strong>
          <span>When you reopen a saved project, select its source video again so MotionLab can restore the workspace locally.</span>
        </div>
        <p className="product-dialog__note">You can reopen this guide later from Help.</p>
      </>
    ),
  },
] as const

interface OnboardingDialogProps {
  onDismiss: () => void
}

export function OnboardingDialog({ onDismiss }: OnboardingDialogProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = ONBOARDING_STEPS[stepIndex]!
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1

  return (
    <ProductDialog
      className="product-dialog--onboarding"
      descriptionId={stepIndex === 0 ? 'onboarding-description' : undefined}
      footer={(
        <>
          <button className="button button--secondary" onClick={onDismiss} type="button">Skip</button>
          <div className="product-dialog__footer-actions">
            {stepIndex > 0 && (
              <button
                className="button button--secondary"
                onClick={() => setStepIndex((current) => current - 1)}
                type="button"
              >
                Back
              </button>
            )}
            <button
              className="button button--primary"
              data-dialog-initial-focus
              onClick={() => {
                if (isLastStep) onDismiss()
                else setStepIndex((current) => current + 1)
              }}
              type="button"
            >
              {isLastStep ? 'Start exploring' : 'Next'}
            </button>
          </div>
        </>
      )}
      onClose={onDismiss}
      title={step.title}
    >
      <div className="onboarding-progress" aria-label={`Step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`}>
        {ONBOARDING_STEPS.map((item, index) => (
          <span
            className={index === stepIndex ? 'onboarding-progress__step onboarding-progress__step--active' : 'onboarding-progress__step'}
            key={item.label}
          >
            <i aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
      <div className="onboarding-content" key={step.label}>{step.body}</div>
    </ProductDialog>
  )
}
