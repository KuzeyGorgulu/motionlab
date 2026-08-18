import { useCallback, useEffect, useRef } from 'react'

import type { AnnotationTool } from '../../annotations/types'
import { useAnnotationWorkspace } from '../../hooks/useAnnotationWorkspace'
import { useCalibrationWorkspace } from '../../hooks/useCalibrationWorkspace'
import { useTrackingWorkspace } from '../../hooks/useTrackingWorkspace'
import { useVideoController } from '../../hooks/useVideoController'
import type { LocalVideoSource } from '../../types/video'
import { AnnotationInspector } from '../annotations/AnnotationInspector'
import { AnnotationToolbar } from '../annotations/AnnotationToolbar'
import { CalibrationPanel } from '../calibration/CalibrationPanel'
import { FilmIcon, TrashIcon } from '../Icons'
import { TrackingPanel } from '../tracking/TrackingPanel'
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
  const calibration = useCalibrationWorkspace(controller.currentTime)
  const tracking = useTrackingWorkspace(controller.currentTime)
  const controlsEnabled = controller.metadata !== null && controller.mediaError === null

  const handleToolChange = useCallback(
    (tool: AnnotationTool) => {
      calibration.cancelInteraction()
      tracking.cancelInteraction()
      if (tool !== 'select') {
        controller.pause()
      }
      annotations.setActiveTool(tool)
    },
    [
      annotations.setActiveTool,
      calibration.cancelInteraction,
      controller.pause,
      tracking.cancelInteraction,
    ],
  )

  const prepareCalibrationInteraction = useCallback(() => {
    controller.pause()
    tracking.cancelInteraction()
    annotations.setActiveTool('select')
    annotations.cancelInteraction()
  }, [
    annotations.cancelInteraction,
    annotations.setActiveTool,
    controller.pause,
    tracking.cancelInteraction,
  ])

  const prepareTrackingInteraction = useCallback(() => {
    controller.pause()
    calibration.cancelInteraction()
    annotations.setActiveTool('select')
    annotations.cancelInteraction()
  }, [
    annotations.cancelInteraction,
    annotations.setActiveTool,
    calibration.cancelInteraction,
    controller.pause,
  ])

  const handleTrackMark = useCallback(() => {
    if (tracking.mode === 'mark') {
      tracking.cancelInteraction()
      return
    }
    if (tracking.activeTrack === null) return
    prepareTrackingInteraction()
    tracking.beginMark()
  }, [
    prepareTrackingInteraction,
    tracking.activeTrack,
    tracking.beginMark,
    tracking.cancelInteraction,
    tracking.mode,
  ])

  const handleTrackEdit = useCallback(() => {
    if (tracking.mode === 'edit') {
      tracking.cancelInteraction()
      return
    }
    prepareTrackingInteraction()
    tracking.beginEdit()
  }, [prepareTrackingInteraction, tracking.beginEdit, tracking.cancelInteraction, tracking.mode])

  const handleTogglePlayback = useCallback(async () => {
    if (calibration.mode !== 'idle') calibration.cancelInteraction()
    if (tracking.mode !== 'idle') tracking.cancelInteraction()
    await controller.togglePlayback()
  }, [
    calibration.cancelInteraction,
    calibration.mode,
    controller.togglePlayback,
    tracking.cancelInteraction,
    tracking.mode,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableOrInteractive(event.target)) {
        return
      }

      const commandKey = event.ctrlKey || event.metaKey
      if (commandKey && !event.altKey && event.code === 'KeyZ') {
        event.preventDefault()
        if (calibration.mode === 'idle') {
          if (tracking.mode !== 'idle') {
            if (event.shiftKey) tracking.redo()
            else tracking.undo()
          } else if (event.shiftKey) annotations.redo()
          else annotations.undo()
        }
        return
      }
      if (commandKey && !event.altKey && event.code === 'KeyY') {
        event.preventDefault()
        if (calibration.mode === 'idle') {
          if (tracking.mode !== 'idle') tracking.redo()
          else annotations.redo()
        }
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (event.code === 'Escape') {
        event.preventDefault()
        if (calibration.mode !== 'idle') calibration.cancelInteraction()
        else if (tracking.mode !== 'idle') tracking.cancelInteraction()
        else annotations.cancelInteraction()
      } else if (
        (event.code === 'Delete' || event.code === 'Backspace') &&
        tracking.mode !== 'idle' &&
        tracking.currentSample !== null &&
        calibration.mode === 'idle'
      ) {
        event.preventDefault()
        tracking.deleteCurrentSample()
      } else if (
        (event.code === 'Delete' || event.code === 'Backspace') &&
        annotations.selectedId !== null &&
        calibration.mode === 'idle' &&
        tracking.mode === 'idle'
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
      } else if (event.code === 'KeyT' && controlsEnabled) {
        handleTrackMark()
      } else if (event.code === 'Space') {
        event.preventDefault()
        handleTogglePlayback()
      } else if (event.code === 'ArrowLeft' && calibration.mode === 'idle') {
        event.preventDefault()
        controller.step(-1)
      } else if (event.code === 'ArrowRight' && calibration.mode === 'idle') {
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
    calibration.cancelInteraction,
    calibration.mode,
    controller.step,
    controlsEnabled,
    handleTogglePlayback,
    handleTrackMark,
    handleToolChange,
    tracking.cancelInteraction,
    tracking.currentSample,
    tracking.deleteCurrentSample,
    tracking.mode,
    tracking.redo,
    tracking.undo,
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
            canRedo={annotations.canRedo && calibration.mode === 'idle' && tracking.mode === 'idle'}
            canUndo={annotations.canUndo && calibration.mode === 'idle' && tracking.mode === 'idle'}
            enabled={controlsEnabled}
            onRedo={annotations.redo}
            onTrackMark={handleTrackMark}
            onToolChange={handleToolChange}
            onUndo={annotations.undo}
            trackingEnabled={tracking.activeTrack !== null}
            trackingMode={tracking.mode}
          />
          <VideoStage
            annotationLayer={{
              activeTool: annotations.activeTool,
              annotations: annotations.renderedAnnotations,
              calibration: calibration.calibration,
              calibrationDraft: calibration.overlayDraft,
              tracks: tracking.tracks,
              activeTrackId: tracking.activeTrackId,
              trackingMode: tracking.mode,
              trailMode: tracking.trailMode,
              trackingDragPreview: tracking.dragPreview,
              currentTime: controller.currentTime,
              draft: annotations.draft,
              onPointerCancel: () => {
                if (calibration.mode !== 'idle') return
                if (tracking.mode !== 'idle') tracking.pointerCancel()
                else annotations.pointerCancel()
              },
              onPointerDown: (point, hitTolerance) => {
                if (calibration.mode !== 'idle') {
                  controller.pause()
                  calibration.pointerDown(point)
                  return false
                }
                if (tracking.mode !== 'idle') {
                  controller.pause()
                  const result = tracking.pointerDown(point, hitTolerance)
                  if (result.marked && tracking.advanceAfterMark) controller.step(1)
                  return result.capturePointer
                }
                if (annotations.activeTool !== 'select') controller.pause()
                return annotations.pointerDown(point, hitTolerance)
              },
              onPointerMove: (point) => {
                if (calibration.mode !== 'idle') calibration.pointerMove(point)
                else if (tracking.mode !== 'idle') tracking.pointerMove(point)
                else annotations.pointerMove(point)
              },
              onPointerUp: (point) => {
                if (calibration.mode !== 'idle') return
                if (tracking.mode !== 'idle') tracking.pointerUp(point)
                else annotations.pointerUp(point)
              },
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
            onTogglePlayback={handleTogglePlayback}
            playbackRate={controller.playbackRate}
            timelineEnabled={controlsEnabled && controller.hasUsableDuration}
          />
        </div>
        <VideoInspector metadata={controller.metadata} source={source}>
          <CalibrationPanel
            calibration={calibration.calibration}
            error={calibration.error}
            knownDistanceInput={calibration.knownDistanceInput}
            mode={calibration.mode}
            onBeginOrigin={() => {
              prepareCalibrationInteraction()
              calibration.beginOrigin()
            }}
            onBeginScale={() => {
              prepareCalibrationInteraction()
              calibration.beginScale()
            }}
            onBeginXAxis={() => {
              prepareCalibrationInteraction()
              calibration.beginXAxis()
            }}
            onCancel={calibration.cancelInteraction}
            onConfirmScale={calibration.confirmScale}
            onKnownDistanceChange={calibration.setKnownDistanceInput}
            onReset={calibration.reset}
            onUnitChange={calibration.setUnit}
            onUpdateMeasurement={calibration.updateMeasurement}
            selectedReferenceCount={calibration.overlayDraft?.referencePoints.length ?? 0}
            unit={calibration.unit}
          />
          <TrackingPanel
            activeTrack={tracking.activeTrack}
            advanceAfterMark={tracking.advanceAfterMark}
            calibration={calibration.calibration}
            canRedo={tracking.canRedo}
            canUndo={tracking.canUndo}
            currentSample={tracking.currentSample}
            mode={tracking.mode}
            onAdvanceAfterMarkChange={tracking.setAdvanceAfterMark}
            onBeginEdit={handleTrackEdit}
            onBeginMark={handleTrackMark}
            onCancelInteraction={tracking.cancelInteraction}
            onCreateTrack={tracking.createTrack}
            onDeleteCurrentSample={tracking.deleteCurrentSample}
            onDeleteTrack={tracking.deleteTrack}
            onRedo={tracking.redo}
            onRenameTrack={tracking.renameTrack}
            onSeekSample={(time) => {
              controller.pause()
              controller.seek(time)
            }}
            onSelectTrack={tracking.selectTrack}
            onTrailModeChange={tracking.setTrailMode}
            onUndo={tracking.undo}
            tracks={tracking.tracks}
            trailMode={tracking.trailMode}
          />
          <AnnotationInspector
            annotations={annotations.currentAnnotations}
            calibration={calibration.calibration}
            onDelete={(id) => {
              calibration.cancelInteraction()
              tracking.cancelInteraction()
              annotations.deleteAnnotation(id)
            }}
            onSelect={(id) => {
              handleToolChange('select')
              annotations.selectAnnotation(id)
            }}
            selectedId={annotations.selectedId}
          />
        </VideoInspector>
      </div>
    </main>
  )
}
