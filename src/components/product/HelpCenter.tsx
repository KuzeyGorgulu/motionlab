import { useState } from 'react'

import { EXPERIMENT_EXAMPLES, SHORTCUT_GROUPS } from '../../product/content'
import {
  MOTIONLAB_GITHUB_URL,
  MOTIONLAB_LIVE_URL,
  MOTIONLAB_RELEASE,
} from '../../product/version'
import { ProductDialog } from './ProductDialog'

export type HelpTopic = 'overview' | 'shortcuts' | 'examples' | 'privacy' | 'about'

const TOPICS: ReadonlyArray<{ id: HelpTopic; label: string }> = [
  { id: 'overview', label: 'Help' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'examples', label: 'Examples' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'about', label: 'About' },
]

interface HelpCenterProps {
  initialTopic: HelpTopic
  sampleError: string | null
  sampleLoading: boolean
  onClose: () => void
  onOpenOnboarding: () => void
  onTrySample: () => Promise<boolean>
}

function HelpOverview({ onOpenOnboarding }: { onOpenOnboarding: () => void }) {
  return (
    <section className="help-section" aria-labelledby="help-overview-title">
      <h2 id="help-overview-title">From video to report</h2>
      <p>Use the visible Getting started panel in the workspace for the next task in your current experiment.</p>
      <ol className="help-workflow">
        {['Import', 'Calibrate', 'Track', 'Analyze', 'Fit', 'Report'].map((step) => <li key={step}>{step}</li>)}
      </ol>
      <button className="button button--secondary" onClick={onOpenOnboarding} type="button">
        Reopen getting-started tour
      </button>
      <div className="help-callout">
        <strong>Need a first experiment?</strong>
        <span>Open Examples for a bundled constant-speed sample and compact experiment ideas.</span>
      </div>
    </section>
  )
}

function KeyboardShortcuts() {
  return (
    <section className="help-section" aria-labelledby="keyboard-shortcuts-title">
      <h2 id="keyboard-shortcuts-title">Keyboard Shortcuts</h2>
      <p>Shortcuts are ignored while focus is in a button, field, menu, or link.</p>
      <div className="shortcut-groups">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <dl className="shortcut-list shortcut-list--dialog">
              {group.items.map((item) => (
                <div key={item.keys}>
                  <dt><kbd>{item.keys}</kbd></dt>
                  <dd>{item.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  )
}

function Examples({
  sampleError,
  sampleLoading,
  onTrySample,
}: Pick<HelpCenterProps, 'sampleError' | 'sampleLoading' | 'onTrySample'>) {
  return (
    <section className="help-section" aria-labelledby="examples-title">
      <h2 id="examples-title">Example Experiments</h2>
      <p>These ideas use MotionLab’s existing measurement and analysis tools; they do not require a special analysis mode.</p>
      <div className="example-list">
        {EXPERIMENT_EXAMPLES.map((example) => (
          <article className={example.bundled ? 'example-card example-card--sample' : 'example-card'} key={example.id}>
            <header>
              <h3>{example.title}</h3>
              {example.bundled && <span>Bundled sample</span>}
            </header>
            <p>{example.demonstrates}</p>
            <dl>
              <div><dt>Try</dt><dd>{example.workflow}</dd></div>
              <div><dt>Inspect</dt><dd>{example.inspect}</dd></div>
            </dl>
            {example.bundled && (
              <button
                className="button button--primary"
                disabled={sampleLoading}
                onClick={() => void onTrySample()}
                type="button"
              >
                {sampleLoading ? 'Loading sample…' : 'Open sample experiment'}
              </button>
            )}
          </article>
        ))}
      </div>
      {sampleError !== null && <p className="inline-error" role="alert">{sampleError}</p>}
    </section>
  )
}

function Privacy() {
  return (
    <section className="help-section" aria-labelledby="privacy-title">
      <h2 id="privacy-title">Privacy</h2>
      <p>MotionLab is local-first and does not require an account.</p>
      <ul className="help-fact-list">
        <li>Selected videos are decoded and processed locally by this browser.</li>
        <li><code>.motionlab</code> files contain project and analysis data, not the original video.</li>
        <li>Reopened projects require you to select the source video again.</li>
        <li>Standalone HTML reports contain report content and SVG graphs, but never the source video.</li>
        <li>MotionLab includes no account system, telemetry, analytics, or application backend.</li>
      </ul>
      <p className="product-dialog__note">
        If you use a hosted copy, its hosting provider may keep standard requests for page assets.
        MotionLab does not send your selected video or experiment data with those requests.
      </p>
    </section>
  )
}

function About() {
  return (
    <section className="help-section about-motionlab" aria-labelledby="about-title">
      <h2 id="about-title">About MotionLab</h2>
      <p className="about-motionlab__version">MotionLab {MOTIONLAB_RELEASE}</p>
      <p>
        An open-source, local-first scientific workspace for turning motion in ordinary videos into inspectable measurements, graphs, model fits, diagnostics, and experiment reports.
      </p>
      <div className="about-motionlab__links">
        <a href={MOTIONLAB_GITHUB_URL} rel="noreferrer" target="_blank">GitHub repository</a>
        <a href={MOTIONLAB_LIVE_URL} rel="noreferrer" target="_blank">Live demo</a>
      </div>
      <p className="product-dialog__note">Released under the MIT License. Scientific results remain dependent on calibration, camera geometry, timing, tracking quality, and model suitability.</p>
      <div className="about-motionlab__credit">
        <span>A</span>
        <img alt="Qzeybei" src="/qzeybei-logo.png" />
        <span>production</span>
      </div>
    </section>
  )
}

export function HelpCenter({
  initialTopic,
  sampleError,
  sampleLoading,
  onClose,
  onOpenOnboarding,
  onTrySample,
}: HelpCenterProps) {
  const [topic, setTopic] = useState<HelpTopic>(initialTopic)
  const title = topic === 'shortcuts'
    ? 'Keyboard Shortcuts'
    : topic === 'examples'
      ? 'Examples'
      : topic === 'privacy'
        ? 'Privacy'
        : topic === 'about'
          ? 'About MotionLab'
          : 'Help'

  return (
    <ProductDialog className="product-dialog--help" onClose={onClose} title={title}>
      <div className="help-layout">
        <nav aria-label="Help topics" className="help-nav">
          {TOPICS.map((item) => (
            <button
              aria-current={topic === item.id ? 'page' : undefined}
              key={item.id}
              onClick={() => setTopic(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="help-content">
          {topic === 'overview' && <HelpOverview onOpenOnboarding={onOpenOnboarding} />}
          {topic === 'shortcuts' && <KeyboardShortcuts />}
          {topic === 'examples' && (
            <Examples
              onTrySample={async () => {
                const opened = await onTrySample()
                if (opened) onClose()
                return opened
              }}
              sampleError={sampleError}
              sampleLoading={sampleLoading}
            />
          )}
          {topic === 'privacy' && <Privacy />}
          {topic === 'about' && <About />}
        </div>
      </div>
    </ProductDialog>
  )
}
