import { useCallback, useEffect, useRef } from 'react'

import type { AnnotationTool } from '../../annotations/types'
import { useAnnotationWorkspace } from '../../hooks/useAnnotationWorkspace'
import { useVideoController } from '../../hooks/useVideoController'
import type { LocalVideoSource } from '../../types/video'
import { AnnotationInspector } from '../annotations/AnnotationInspector'
import { AnnotationToolbar } from '../annotations/AnnotationToolbar'
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
  const annotations = useAnnotationWorkspace(controller.currentTime)
  const controlsEnabled = controller.metadata !== null && controller.mediaError === null

  const handleToolChange = useCallback(
    (tool: AnnotationTool) => {
      if (tool !== 'select') {
        controller.pause()
      }
      annotations.setActiveTool(tool)
    },
    [annotations.setActiveTool, controller.pause],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableOrInteractive(event.target)) {
        return
      }

      const commandKey = event.ctrlKey || event.metaKey
      if (commandKey && !event.altKey && event.code === 'KeyZ') {
        event.preventDefault()
        if (event.shiftKey) annotations.redo()
        else annotations.undo()
        return
      }
      if (commandKey && !event.altKey && event.code === 'KeyY') {
        event.preventDefault()
        annotations.redo()
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (event.code === 'Escape') {
        event.preventDefault()
        annotations.cancelInteraction()
      } else if (
        (event.code === 'Delete' || event.code === 'Backspace') &&
        annotations.selectedId !== null
      ) {
        event.preventDefault()
        annotations.deleteSelected()
      } else if (event.code === 'KeyV' && controlsEnabled) {
        handleToolChange('select')
      } else if (event.code === 'KeyP' && controlsEnabled) {
        handleToolChange('point')
      } else if (event.code === 'KeyL' && controlsEnabled) {
        handleToolChange('line')
      } else if (event.code === 'KeyA' && controlsEnabled) {
        handleToolChange('angle')
      } else if (event.code === 'Space') {
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
  }, [
    annotations.cancelInteraction,
    annotations.deleteSelected,
    annotations.redo,
    annotations.selectedId,
    annotations.undo,
    controller.step,
    controller.togglePlayback,
    controlsEnabled,
    handleToolChange,
  ])

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
          <AnnotationToolbar
            activeTool={annotations.activeTool}
            canRedo={annotations.canRedo}
            canUndo={annotations.canUndo}
            enabled={controlsEnabled}
            onRedo={annotations.redo}
            onToolChange={handleToolChange}
            onUndo={annotations.undo}
          />
          <VideoStage
            annotationLayer={{
              activeTool: annotations.activeTool,
              annotations: annotations.renderedAnnotations,
              draft: annotations.draft,
              onPointerCancel: annotations.pointerCancel,
              onPointerDown: (point, hitTolerance) => {
                if (annotations.activeTool !== 'select') controller.pause()
                return annotations.pointerDown(point, hitTolerance)
              },
              onPointerMove: annotations.pointerMove,
              onPointerUp: annotations.pointerUp,
              selectedId: annotations.selectedId,
            }}
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
        <VideoInspector metadata={controller.metadata} source={source}>
          <AnnotationInspector
            annotations={annotations.currentAnnotations}
            onDelete={annotations.deleteAnnotation}
            onSelect={(id) => {
              annotations.setActiveTool('select')
              annotations.selectAnnotation(id)
            }}
            selectedId={annotations.selectedId}
          />
        </VideoInspector>
      </div>
    </main>
  )
}
