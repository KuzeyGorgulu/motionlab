import assistedTrackingDemo from '../../../docs/assets/assisted-tracking-demo.gif'
import { MOTIONLAB_GITHUB_URL } from '../../product/version'

import './LandingPage.css'

const workflowSteps = [
  {
    title: 'Load a video',
    description: 'Choose an ordinary video from your device. It stays in your browser.',
  },
  {
    title: 'Calibrate the scene',
    description: 'Set a known distance, origin, and axis direction to establish real-world coordinates.',
  },
  {
    title: 'Track an object',
    description: 'Mark positions manually or use local Assisted Tracking to propose the next point.',
  },
  {
    title: 'Analyze its motion',
    description: 'Inspect kinematics, fit motion models, review residuals, and export your results.',
  },
]

const capabilities = [
  'Manual tracking',
  'Assisted tracking',
  'Spatial calibration',
  'Position and displacement analysis',
  'Velocity and speed',
  'Acceleration',
  'Motion model fitting',
  'Residual analysis',
  'CSV / JSON scientific data export',
  'SVG graph export',
]

const principles = ['Local-first', 'Runs in the browser', 'No uploads', 'No account required', 'Open source']

interface LandingPageProps {
  assistedTrackingDemoUrl?: string
}

export function LandingPage({ assistedTrackingDemoUrl = assistedTrackingDemo }: LandingPageProps) {
  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="MotionLab home">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-mark__x" />
            <span className="brand-mark__y" />
            <span className="brand-mark__point" />
          </span>
          <span>
            Motion<span>Lab</span>
          </span>
        </a>

        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#capabilities">Capabilities</a>
          <a className="landing-nav__cta" href="/app">
            Open MotionLab
          </a>
        </nav>
      </header>

      <main id="main-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy">
            <p className="landing-eyebrow">MotionLab · Video motion analysis</p>
            <h1 id="landing-title">Turn ordinary videos into measurable physics experiments.</h1>
            <p className="landing-lede">
              MotionLab is a local-first browser tool for turning ordinary videos into measurable physics experiments.
            </p>
            <p className="landing-supporting-copy">
              Track objects and analyze position, velocity, acceleration, motion models, and residuals directly in your
              browser.
            </p>

            <div className="landing-actions">
              <a className="landing-button landing-button--primary" href="/app">
                Open MotionLab
              </a>
              <a
                className="landing-button landing-button--secondary"
                href={MOTIONLAB_GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                View on GitHub
              </a>
            </div>

            <ul className="landing-principles" aria-label="MotionLab product principles">
              {principles.map((principle) => (
                <li key={principle}>{principle}</li>
              ))}
            </ul>
          </div>

          <figure className="landing-demo">
            <div className="landing-demo__frame">
              <img
                src={assistedTrackingDemoUrl}
                alt="MotionLab Assisted Tracking following a target across video frames"
              />
            </div>
            <figcaption>
              <span>Assisted Tracking</span>
              Seed a target once, then review frame-by-frame suggestions generated locally in your browser.
            </figcaption>
          </figure>
        </section>

        <section className="landing-section landing-workflow" id="how-it-works" aria-labelledby="workflow-title">
          <div className="landing-section__intro">
            <p className="landing-section__label">How it works</p>
            <h2 id="workflow-title">From video to evidence in four steps.</h2>
          </div>

          <ol className="landing-step-list">
            {workflowSteps.map((step, index) => (
              <li key={step.title}>
                <span className="landing-step-list__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section landing-capabilities" id="capabilities" aria-labelledby="capabilities-title">
          <div className="landing-section__intro">
            <p className="landing-section__label">Capabilities</p>
            <h2 id="capabilities-title">A focused toolkit for motion and kinematics.</h2>
            <p>
              Keep observations inspectable from the first marked point through fitted models and scientific exports.
            </p>
          </div>

          <ul className="landing-capability-list">
            {capabilities.map((capability) => (
              <li key={capability}>
                <span aria-hidden="true" />
                {capability}
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-final-cta" aria-labelledby="final-cta-title">
          <div>
            <p className="landing-section__label">Ready when you are</p>
            <h2 id="final-cta-title">Your video stays yours.</h2>
            <p>Open MotionLab, load a local video, and start measuring. No account or upload required.</p>
          </div>
          <a className="landing-button landing-button--primary" href="/app">
            Open MotionLab
          </a>
        </section>
      </main>

      <footer className="landing-footer">
        <span>MotionLab</span>
        <div className="landing-footer__meta">
          <span>Open-source, local-first video motion analysis.</span>
          <span className="landing-footer__credit">
            <span>A</span>
            <img alt="Qzeybei" src="/qzeybei-logo.png" />
            <span>production</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
