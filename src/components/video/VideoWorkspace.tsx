import { useEffect, useRef } from 'react'

import { useVideoController } from '../../hooks/useVideoController'
import type { LocalVideoSource } from '../../types/video'
import { FilmIcon, TrashIcon } from '../Icons'
import { TransportControls } from './TransportControls'
import { VideoImportButton } from './VideoImportButton'
import { VideoInspector } from './VideoInspector'
import { VideoStage } from './VideoStage'

interface VideoWorkspaceProps {
  source: LocalVideoSource
  importError: string | null
  onSelectVideo: (file: File) => void
  onRemoveVideo: () => void
}

function isEditableOrInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(target.tagName)
  )
}

export function VideoWorkspace({
  source,
  importError,
  onSelectVideo,
  onRemoveVideo,
}: VideoWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controller = useVideoController(videoRef)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableOrInteractive(event.target) || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        void controller.togglePlayback()
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault()
        controller.step(-1)
      } else if (event.code === 'ArrowRight') {
        event.preventDefault()
        controller.step(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [controller.step, controller.togglePlayback])

  const controlsEnabled = controller.metadata !== null && controller.mediaError === null

  return (
    <main className="workspace">
      <header className="workspace-bar">
        <div className="source-identity">
          <span className="source-identity__icon"><FilmIcon /></span>
          <div>
            <span className="source-identity__label">Local source</span>
            <strong title={source.name}>{source.name}</strong>
          </div>
        </div>
        <div className="workspace-bar__actions">
          {importError !== null && <span className="toolbar-error" role="alert">{importError}</span>}
          <VideoImportButton compact label="Change video" onSelect={onSelectVideo} />
          <button
            className="button button--danger"
            onClick={onRemoveVideo}
            type="button"
          >
            <TrashIcon />
            Remove
          </button>
        </div>
      </header>

      <div className="workspace__body">
        <div className="analysis-area">
          <VideoStage
            mediaError={controller.mediaError}
            mediaEvents={controller.mediaEvents}
            metadata={controller.metadata}
            sourceUrl={source.url}
            videoName={source.name}
            videoRef={videoRef}
          />
          <TransportControls
            controlsEnabled={controlsEnabled}
            currentTime={controller.currentTime}
            duration={controller.metadata?.duration ?? null}
            isPlaying={controller.isPlaying}
            onPlaybackRateChange={controller.changePlaybackRate}
            onSeek={controller.seek}
            onStep={controller.step}
            onTogglePlayback={controller.togglePlayback}
            playbackRate={controller.playbackRate}
            timelineEnabled={controlsEnabled && controller.hasUsableDuration}
          />
        </div>
        <VideoInspector metadata={controller.metadata} source={source} />
      </div>
    </main>
  )
}
