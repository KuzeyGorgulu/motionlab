import { useCallback, useRef, useState } from 'react'

import { EmptyWorkspace } from './components/EmptyWorkspace'
import { ShieldIcon } from './components/Icons'
import { ProjectRelinkWorkspace } from './components/project/ProjectRelinkWorkspace'
import { VideoWorkspace } from './components/video/VideoWorkspace'
import { useLocalVideoSource } from './hooks/useLocalVideoSource'
import { parseMotionLabProject } from './project/schema'
import type { MotionLabProjectV1 } from './project/types'

export default function App() {
  const { source, importError, loadVideo, clearVideo } = useLocalVideoSource()
  const [assistedTrackingNoticeAcknowledged, setAssistedTrackingNoticeAcknowledged] =
    useState(false)
  const [projectToRelink, setProjectToRelink] =
    useState<MotionLabProjectV1 | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const hasProjectDataRef = useRef(false)

  const confirmDiscard = useCallback(() =>
    !hasProjectDataRef.current || window.confirm(
      'This will replace the current experiment and discard unsaved work. Continue?',
    ), [])

  const handleProjectDataPresenceChange = useCallback((hasData: boolean) => {
    hasProjectDataRef.current = hasData
  }, [])

  const handleOpenProject = useCallback(async (file: File) => {
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
    loadVideo(file)
  }, [confirmDiscard, loadVideo, projectToRelink, source])

  const handleRemoveVideo = useCallback(() => {
    if (projectToRelink === null && !confirmDiscard()) return
    hasProjectDataRef.current = false
    clearVideo()
  }, [clearVideo, confirmDiscard, projectToRelink])

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
        <div className="local-status">
          <ShieldIcon />
          <span><strong>Local session</strong> · Video stays on this device</span>
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
          projectError={projectError}
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
    </div>
  )
}
