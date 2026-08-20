import { useCallback, useEffect, useRef, useState } from 'react'

import { EmptyWorkspace } from './components/EmptyWorkspace'
import { ShieldIcon } from './components/Icons'
import { HelpCenter, type HelpTopic } from './components/product/HelpCenter'
import { OnboardingDialog } from './components/product/OnboardingDialog'
import { ProjectRelinkWorkspace } from './components/project/ProjectRelinkWorkspace'
import { VideoWorkspace } from './components/video/VideoWorkspace'
import { useLocalVideoSource } from './hooks/useLocalVideoSource'
import {
  rememberOnboardingComplete,
  shouldShowOnboarding,
} from './product/preferences'
import { loadBundledSample } from './product/sample'
import { parseMotionLabProject } from './project/schema'
import type { MotionLabProjectV1 } from './project/types'

function firstRunOnboardingRequired(): boolean {
  try {
    return shouldShowOnboarding(window.localStorage)
  } catch {
    return true
  }
}

function keyboardTargetIsInteractive(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target.closest('button, input, select, textarea, a, summary') !== null
  )
}

export default function App() {
  const { source, importError, loadVideo, clearVideo } = useLocalVideoSource()
  const [assistedTrackingNoticeAcknowledged, setAssistedTrackingNoticeAcknowledged] =
    useState(false)
  const [projectToRelink, setProjectToRelink] =
    useState<MotionLabProjectV1 | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [sampleError, setSampleError] = useState<string | null>(null)
  const [sampleLoading, setSampleLoading] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(firstRunOnboardingRequired)
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null)
  const hasProjectDataRef = useRef(false)

  const confirmDiscard = useCallback(() =>
    !hasProjectDataRef.current || window.confirm(
      'This will replace the current experiment and discard unsaved work. Continue?',
    ), [])

  const handleProjectDataPresenceChange = useCallback((hasData: boolean) => {
    hasProjectDataRef.current = hasData
  }, [])

  const handleOpenProject = useCallback(async (file: File) => {
    setSampleError(null)
    let contents: string
    try {
      contents = await file.text()
    } catch {
      setProjectError(
        'The project file could not be read. Existing work is safe; choose another .motionlab file.',
      )
      return
    }
    const parsed = parseMotionLabProject(contents)
    if (!parsed.ok) {
      setProjectError(parsed.message)
      return
    }
    if (!confirmDiscard()) return
    setProjectError(null)
    setProjectToRelink(parsed.project)
    hasProjectDataRef.current = false
    clearVideo()
  }, [clearVideo, confirmDiscard])

  const handleSelectVideo = useCallback((file: File) => {
    if (
      source !== null &&
      projectToRelink === null &&
      !confirmDiscard()
    ) {
      return
    }
    setSampleError(null)
    loadVideo(file)
  }, [confirmDiscard, loadVideo, projectToRelink, source])

  const handleRemoveVideo = useCallback(() => {
    if (projectToRelink === null && !confirmDiscard()) return
    hasProjectDataRef.current = false
    clearVideo()
  }, [clearVideo, confirmDiscard, projectToRelink])

  const dismissOnboarding = useCallback(() => {
    try {
      rememberOnboardingComplete(window.localStorage)
    } catch {
      // The tour remains dismissible even when browser storage is blocked.
    }
    setShowOnboarding(false)
  }, [])

  const openOnboarding = useCallback(() => {
    setHelpTopic(null)
    setShowOnboarding(true)
  }, [])

  const handleTrySample = useCallback(async (): Promise<boolean> => {
    setSampleLoading(true)
    setSampleError(null)
    const sample = await loadBundledSample()
    setSampleLoading(false)
    if (!sample.ok) {
      setSampleError(sample.message)
      return false
    }
    if (!confirmDiscard()) return false

    setProjectError(null)
    setProjectToRelink(sample.project)
    hasProjectDataRef.current = false
    clearVideo()
    if (!loadVideo(sample.video)) {
      setProjectToRelink(null)
      setSampleError('The sample video could not be opened in this browser. Import your own video to continue.')
      return false
    }
    return true
  }, [clearVideo, confirmDiscard, loadVideo])

  useEffect(() => {
    const handleShortcutHelp = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key !== '?' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        keyboardTargetIsInteractive(event.target) ||
        document.querySelector('dialog[open]') !== null
      ) {
        return
      }
      event.preventDefault()
      setHelpTopic('shortcuts')
    }
    window.addEventListener('keydown', handleShortcutHelp)
    return () => window.removeEventListener('keydown', handleShortcutHelp)
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="MotionLab home">
          <span className="brand-mark" aria-hidden="true">
            <i className="brand-mark__x" />
            <i className="brand-mark__y" />
            <i className="brand-mark__point" />
          </span>
          <span>Motion<span>Lab</span></span>
          <small>Video mechanics</small>
        </div>
        <div className="app-header__actions">
          <div className="local-status">
            <ShieldIcon />
            <span><strong>Local session</strong> · Video stays on this device</span>
          </div>
          <button
            className="header-help"
            onClick={() => setHelpTopic('overview')}
            type="button"
          >
            Help <kbd>?</kbd>
          </button>
        </div>
      </header>

      {source === null && projectToRelink !== null ? (
        <ProjectRelinkWorkspace
          error={projectError ?? importError}
          onOpenProject={(file) => void handleOpenProject(file)}
          onSelectVideo={handleSelectVideo}
          project={projectToRelink}
        />
      ) : source === null ? (
        <EmptyWorkspace
          importError={importError}
          onOpenProject={(file) => void handleOpenProject(file)}
          onSelectVideo={handleSelectVideo}
          onTrySample={() => void handleTrySample()}
          projectError={projectError ?? sampleError}
          sampleLoading={sampleLoading}
        />
      ) : (
        <VideoWorkspace
          assistedTrackingNoticeAcknowledged={assistedTrackingNoticeAcknowledged}
          importError={importError}
          initialProject={projectToRelink}
          key={source.url}
          onAcknowledgeAssistedTrackingNotice={() => {
            setAssistedTrackingNoticeAcknowledged(true)
          }}
          onOpenProject={(file) => void handleOpenProject(file)}
          onProjectDataPresenceChange={handleProjectDataPresenceChange}
          onProjectRelinkComplete={() => setProjectToRelink(null)}
          onRemoveVideo={handleRemoveVideo}
          onSelectVideo={handleSelectVideo}
          projectError={projectError}
          source={source}
        />
      )}
      {showOnboarding && <OnboardingDialog onDismiss={dismissOnboarding} />}
      {helpTopic !== null && (
        <HelpCenter
          initialTopic={helpTopic}
          onClose={() => setHelpTopic(null)}
          onOpenOnboarding={openOnboarding}
          onTrySample={handleTrySample}
          sampleError={sampleError}
          sampleLoading={sampleLoading}
        />
      )}
    </div>
  )
}
