import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

import { deriveTrackKinematics } from '../../analysis/kinematics'
import { deriveFitDiagnostics } from '../../analysis/fitDiagnostics'
import { fitMotionModel } from '../../analysis/modelFit'
import {
  INITIAL_ANALYSIS_PANEL_STATE,
  reduceAnalysisPanelState,
} from '../../analysis/panelState'
import {
  selectResidualVisualizationGroup,
  selectVisualizationGroup,
} from '../../analysis/series'
import { deriveSmoothedTrackKinematics } from '../../analysis/smoothing'
import type { MotionModelFitResult } from '../../analysis/types'
import type { AnnotationTool } from '../../annotations/types'
import { useAssistedTracking } from '../../hooks/useAssistedTracking'
import { useAnnotationWorkspace } from '../../hooks/useAnnotationWorkspace'
import { useCalibrationWorkspace } from '../../hooks/useCalibrationWorkspace'
import { useTrackingWorkspace } from '../../hooks/useTrackingWorkspace'
import { useVideoController } from '../../hooks/useVideoController'
import {
  downloadTextFile,
  exportFilenameForVideo,
} from '../../export/download'
import { createGraphSvg } from '../../export/graphSvg'
import { createExperimentReportHtml } from '../../export/reportHtml'
import {
  createScientificCsv,
  createScientificJson,
} from '../../export/scientificData'
import {
  createMotionLabProject,
  projectFilenameForVideo,
  serializeMotionLabProject,
} from '../../project/serialize'
import type { MotionLabProjectV1 } from '../../project/types'
import { compareRelinkedVideo } from '../../project/videoRelink'
import { buildExperimentReport } from '../../report/builder'
import {
  createDefaultReportProjectState,
  hasMeaningfulReportState,
} from '../../report/projectState'
import type { ReportTrackAnalysisInput } from '../../report/types'
import type { LocalVideoSource } from '../../types/video'
import { AnnotationInspector } from '../annotations/AnnotationInspector'
import { AnnotationToolbar } from '../annotations/AnnotationToolbar'
import { AnalysisPanel } from '../analysis/AnalysisPanel'
import { KinematicsPanel } from '../analysis/KinematicsPanel'
import { CalibrationPanel } from '../calibration/CalibrationPanel'
import { GettingStartedPanel } from '../guidance/GettingStartedPanel'
import { ShortcutHelp } from '../guidance/ShortcutHelp'
import { FilmIcon, TrashIcon } from '../Icons'
import { VideoRelinkWarning } from '../project/VideoRelinkWarning'
import { WorkspaceFileActions } from '../project/WorkspaceFileActions'
import { ReportWorkspace } from '../report/ReportWorkspace'
import { AssistedTrackingNotice } from '../tracking/AssistedTrackingNotice'
import { TrackingPanel } from '../tracking/TrackingPanel'
import { TransportControls } from './TransportControls'
import { VideoImportButton } from './VideoImportButton'
import { VideoInspector } from './VideoInspector'
import { VideoStage } from './VideoStage'

interface VideoWorkspaceProps {
  source: LocalVideoSource
  importError: string | null
  initialProject: MotionLabProjectV1 | null
  projectError: string | null
  assistedTrackingNoticeAcknowledged: boolean
  onAcknowledgeAssistedTrackingNotice: () => void
  onOpenProject: (file: File) => void
  onProjectDataPresenceChange: (hasData: boolean) => void
  onProjectRelinkComplete: () => void
  onSelectVideo: (file: File) => void
  onRemoveVideo: () => void
}

const MOTIONLAB_VERSION = '0.1.0'

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
  initialProject,
  projectError,
  assistedTrackingNoticeAcknowledged,
  onAcknowledgeAssistedTrackingNotice,
  onOpenProject,
  onProjectDataPresenceChange,
  onProjectRelinkComplete,
  onSelectVideo,
  onRemoveVideo,
}: VideoWorkspaceProps) {
  const restoredProject = useRef(initialProject).current
  const videoRef = useRef<HTMLVideoElement>(null)
  const controller = useVideoController(videoRef)
  const annotations = useAnnotationWorkspace(
    controller.currentTime,
    restoredProject?.annotations,
  )
  const calibration = useCalibrationWorkspace(
    controller.currentTime,
    restoredProject?.calibration,
  )
  const tracking = useTrackingWorkspace(
    controller.currentTime,
    restoredProject === null
      ? undefined
      : {
          snapshot: {
            tracks: restoredProject.tracks,
            activeTrackId: restoredProject.workspace.activeTrackId,
          },
          trailMode: restoredProject.workspace.trailMode,
          advanceAfterMark: restoredProject.workspace.advanceAfterMark,
        },
  )
  const assisted = useAssistedTracking({
    videoRef,
    metadata: controller.metadata,
    activeTrack: tracking.activeTrack,
    isPlaying: controller.isPlaying,
    pause: controller.pause,
    insertSampleBatch: tracking.insertSampleBatch,
  })
  const [analysisPanel, dispatchAnalysisPanel] = useReducer(
    reduceAnalysisPanelState,
    restoredProject === null
      ? INITIAL_ANALYSIS_PANEL_STATE
      : {
          expanded: restoredProject.workspace.analysisExpanded,
          view: 'motion',
          mode: restoredProject.workspace.analysisMode,
          residualMode: 'residual-magnitude',
          source: { type: 'raw' },
          model: 'none',
        },
  )
  const [workspaceView, setWorkspaceView] = useState<'analysis' | 'report'>('analysis')
  const [reportState, setReportState] = useState(
    () => restoredProject?.report ?? createDefaultReportProjectState(),
  )
  const [reportGeneratedAt, setReportGeneratedAt] = useState(
    () => new Date().toISOString(),
  )
  const [showAssistedTrackingNotice, setShowAssistedTrackingNotice] =
    useState(false)
  const [operationMessage, setOperationMessage] = useState<{
    kind: 'error' | 'status'
    text: string
  } | null>(null)
  const restoredMediaTimeApplied = useRef(false)
  const controlsEnabled = controller.metadata !== null && controller.mediaError === null
  const rawTrackAnalysis = useMemo(
    () => tracking.activeTrack === null
      ? null
      : deriveTrackKinematics(tracking.activeTrack, calibration.calibration),
    [calibration.calibration, tracking.activeTrack],
  )
  const smoothingResult = useMemo(
    () => tracking.activeTrack === null || analysisPanel.source.type === 'raw'
      ? null
      : deriveSmoothedTrackKinematics(
          tracking.activeTrack,
          calibration.calibration,
          analysisPanel.source.windowSize,
        ),
    [analysisPanel.source, calibration.calibration, tracking.activeTrack],
  )
  const trackAnalysis = analysisPanel.source.type === 'raw'
    ? rawTrackAnalysis
    : smoothingResult?.ok
      ? smoothingResult.analysis
      : null
  const analysisError = analysisPanel.source.type === 'smoothed' && smoothingResult !== null && !smoothingResult.ok
    ? smoothingResult.message
    : null
  const modelFitResult = useMemo<MotionModelFitResult | null>(() => {
    if (analysisPanel.model === 'none') return null
    if (trackAnalysis === null) {
      return {
        ok: false,
        message: analysisError ?? 'Model fitting requires available analysis samples.',
      }
    }
    return fitMotionModel(
      trackAnalysis,
      analysisPanel.model,
      analysisPanel.source.type,
    )
  }, [analysisError, analysisPanel.model, analysisPanel.source.type, trackAnalysis])
  const fitDiagnostics = useMemo(
    () => trackAnalysis === null || modelFitResult === null || !modelFitResult.ok
      ? null
      : deriveFitDiagnostics(trackAnalysis, modelFitResult.fit),
    [modelFitResult, trackAnalysis],
  )
  const visualizationGroup = useMemo(
    () => analysisPanel.view === 'residuals'
      ? fitDiagnostics === null
        ? null
        : selectResidualVisualizationGroup(
            fitDiagnostics,
            analysisPanel.residualMode,
          )
      : trackAnalysis === null
        ? null
        : selectVisualizationGroup(trackAnalysis, analysisPanel.mode, {
            analysisSource: analysisPanel.source.type,
            rawAnalysis: rawTrackAnalysis,
            modelFit: modelFitResult?.ok ? modelFitResult.fit : null,
          }),
    [
      analysisPanel.mode,
      analysisPanel.residualMode,
      analysisPanel.source.type,
      analysisPanel.view,
      fitDiagnostics,
      modelFitResult,
      rawTrackAnalysis,
      trackAnalysis,
    ],
  )
  const reportTrackAnalyses = useMemo<ReportTrackAnalysisInput[]>(
    () => tracking.tracks.map((track) => {
      const rawAnalysis = deriveTrackKinematics(track, calibration.calibration)
      const selectedAnalysis = analysisPanel.source.type === 'raw'
        ? rawAnalysis
        : (() => {
            const result = deriveSmoothedTrackKinematics(
              track,
              calibration.calibration,
              analysisPanel.source.windowSize,
            )
            return result.ok ? result.analysis : null
          })()
      const fitResult = analysisPanel.model === 'none' || selectedAnalysis === null
        ? null
        : fitMotionModel(
            selectedAnalysis,
            analysisPanel.model,
            analysisPanel.source.type,
          )
      const fit = fitResult?.ok ? fitResult.fit : null
      return {
        track,
        rawAnalysis,
        analysis: selectedAnalysis,
        fit,
        diagnostics:
          selectedAnalysis === null || fit === null
            ? null
            : deriveFitDiagnostics(selectedAnalysis, fit),
      }
    }),
    [
      analysisPanel.model,
      analysisPanel.source,
      calibration.calibration,
      tracking.tracks,
    ],
  )
  const buildCurrentReport = useCallback(
    (generatedAt: string) => buildExperimentReport({
      reportState,
      video: {
        filename: source.name,
        duration: controller.metadata?.duration ?? null,
        width: controller.metadata?.width ?? null,
        height: controller.metadata?.height ?? null,
      },
      calibration: calibration.calibration,
      analysisSource: analysisPanel.source,
      trackAnalyses: reportTrackAnalyses,
      generatedAt,
      motionLabVersion: MOTIONLAB_VERSION,
    }),
    [
      analysisPanel.source,
      calibration.calibration,
      controller.metadata,
      reportState,
      reportTrackAnalyses,
      source.name,
    ],
  )
  const experimentReport = useMemo(
    () => buildCurrentReport(reportGeneratedAt),
    [buildCurrentReport, reportGeneratedAt],
  )
  const relinkComparison = useMemo(
    () => initialProject === null || controller.metadata === null
      ? null
      : compareRelinkedVideo(
          initialProject.video,
          source,
          controller.metadata,
        ),
    [controller.metadata, initialProject, source],
  )
  const hasProjectData =
    annotations.annotations.length > 0 ||
    calibration.calibration !== null ||
    tracking.tracks.length > 0 ||
    hasMeaningfulReportState(reportState)

  useEffect(() => {
    onProjectDataPresenceChange(hasProjectData)
    return () => onProjectDataPresenceChange(false)
  }, [hasProjectData, onProjectDataPresenceChange])

  useEffect(() => {
    if (
      restoredProject === null ||
      controller.metadata === null ||
      restoredMediaTimeApplied.current
    ) {
      return
    }
    restoredMediaTimeApplied.current = true
    controller.seek(restoredProject.workspace.mediaTime)
  }, [controller.metadata, controller.seek, restoredProject])

  useEffect(() => {
    if (relinkComparison?.matches) onProjectRelinkComplete()
  }, [onProjectRelinkComplete, relinkComparison])

  const currentProject = useCallback(() => {
    if (controller.metadata === null) return null
    return createMotionLabProject({
      videoName: source.name,
      metadata: controller.metadata,
      annotations: annotations.annotations,
      calibration: calibration.calibration,
      tracks: tracking.tracks,
      activeTrackId: tracking.activeTrackId,
      trailMode: tracking.trailMode,
      advanceAfterMark: tracking.advanceAfterMark,
      analysisMode: analysisPanel.mode,
      analysisExpanded: analysisPanel.expanded,
      mediaTime: controller.currentTime,
      report: reportState,
    })
  }, [
    analysisPanel.expanded,
    analysisPanel.mode,
    annotations.annotations,
    calibration.calibration,
    controller.currentTime,
    controller.metadata,
    reportState,
    source.name,
    tracking.activeTrackId,
    tracking.advanceAfterMark,
    tracking.tracks,
    tracking.trailMode,
  ])

  const reportOperationError = useCallback((text: string) => {
    setOperationMessage({ kind: 'error', text })
  }, [])

  const handleSaveProject = useCallback(() => {
    const project = currentProject()
    if (project === null) {
      reportOperationError('Video metadata is not ready yet. Wait for the video to load, then save again.')
      return
    }
    const serialized = serializeMotionLabProject(project)
    if (!serialized.ok) {
      reportOperationError(serialized.message)
      return
    }
    try {
      downloadTextFile(
        serialized.text,
        projectFilenameForVideo(source.name),
        'application/json;charset=utf-8',
      )
      setOperationMessage({ kind: 'status', text: 'Project saved locally.' })
    } catch {
      reportOperationError('The project download could not be created. Existing work is safe; try again.')
    }
  }, [currentProject, reportOperationError, source.name])

  const handleExportCsv = useCallback(() => {
    const result = createScientificCsv(tracking.tracks, calibration.calibration)
    if (!result.ok) {
      reportOperationError(result.message)
      return
    }
    try {
      downloadTextFile(
        result.value,
        exportFilenameForVideo(source.name, 'track-data', 'csv'),
        'text/csv;charset=utf-8',
      )
      setOperationMessage({
        kind: 'status',
        text: `Exported ${result.rowCount} track sample${result.rowCount === 1 ? '' : 's'} to CSV.`,
      })
    } catch {
      reportOperationError('CSV export could not be generated. Existing work is safe; try again.')
    }
  }, [calibration.calibration, reportOperationError, source.name, tracking.tracks])

  const handleExportJson = useCallback(() => {
    const project = currentProject()
    if (project === null) {
      reportOperationError('Video metadata is not ready yet. Wait for the video to load, then export again.')
      return
    }
    const result = createScientificJson(
      project.video,
      project.annotations,
      project.tracks,
      project.calibration,
    )
    if (!result.ok) {
      reportOperationError(result.message)
      return
    }
    try {
      downloadTextFile(
        result.value,
        exportFilenameForVideo(source.name, 'scientific-data', 'json'),
        'application/json;charset=utf-8',
      )
      setOperationMessage({
        kind: 'status',
        text: `Exported ${result.rowCount} track sample${result.rowCount === 1 ? '' : 's'} to JSON.`,
      })
    } catch {
      reportOperationError('JSON data export could not be generated. Existing work is safe; try again.')
    }
  }, [currentProject, reportOperationError, source.name])

  const handleExportGraph = useCallback(() => {
    if (tracking.activeTrack === null || visualizationGroup === null) {
      reportOperationError('Select a track with graph data before exporting the current graph.')
      return
    }
    const result = createGraphSvg(
      visualizationGroup,
      tracking.activeTrack.name,
      tracking.activeTrack.color,
    )
    if (!result.ok) {
      reportOperationError(result.message)
      return
    }
    try {
      downloadTextFile(
        result.svg,
        exportFilenameForVideo(
          source.name,
          `${tracking.activeTrack.name}-${analysisPanel.view === 'residuals'
            ? analysisPanel.residualMode
            : analysisPanel.mode}`,
          'svg',
        ),
        'image/svg+xml;charset=utf-8',
      )
      setOperationMessage({ kind: 'status', text: 'Exported the current graph as SVG.' })
    } catch {
      reportOperationError('The graph SVG could not be generated. Existing work is safe; try again.')
    }
  }, [
    analysisPanel.mode,
    analysisPanel.residualMode,
    analysisPanel.view,
    reportOperationError,
    source.name,
    tracking.activeTrack,
    visualizationGroup,
  ])

  const handleExportReport = useCallback(() => {
    const generatedAt = new Date().toISOString()
    const result = createExperimentReportHtml(buildCurrentReport(generatedAt))
    if (!result.ok) {
      reportOperationError(result.message)
      return
    }
    try {
      downloadTextFile(
        result.html,
        exportFilenameForVideo(source.name, 'experiment-report', 'html'),
        'text/html;charset=utf-8',
      )
      setReportGeneratedAt(generatedAt)
      setOperationMessage({ kind: 'status', text: 'Exported the experiment report as standalone HTML.' })
    } catch {
      reportOperationError('The report HTML could not be generated. Existing work is safe; try again.')
    }
  }, [buildCurrentReport, reportOperationError, source.name])

  const handleSeekSample = useCallback((time: number) => {
    assisted.stopForExternalInteraction('Stopped because the video was manually sought.')
    controller.pause()
    controller.seek(time)
  }, [assisted.stopForExternalInteraction, controller.pause, controller.seek])

  const handleManualStep = useCallback((direction: -1 | 1) => {
    assisted.stopForExternalInteraction('Stopped because the video was stepped manually.')
    controller.step(direction)
  }, [assisted.stopForExternalInteraction, controller.step])

  const handleToolChange = useCallback(
    (tool: AnnotationTool) => {
      assisted.stopForExternalInteraction('Stopped because another canvas tool started.')
      calibration.cancelInteraction()
      tracking.cancelInteraction()
      if (tool !== 'select') {
        controller.pause()
      }
      annotations.setActiveTool(tool)
    },
    [
      annotations.setActiveTool,
      assisted.stopForExternalInteraction,
      calibration.cancelInteraction,
      controller.pause,
      tracking.cancelInteraction,
    ],
  )

  const prepareCalibrationInteraction = useCallback(() => {
    assisted.stopForExternalInteraction('Stopped because calibration capture started.')
    controller.pause()
    tracking.cancelInteraction()
    annotations.setActiveTool('select')
    annotations.cancelInteraction()
  }, [
    annotations.cancelInteraction,
    annotations.setActiveTool,
    assisted.stopForExternalInteraction,
    controller.pause,
    tracking.cancelInteraction,
  ])

  const prepareTrackingInteraction = useCallback(() => {
    assisted.stopForExternalInteraction('Stopped because manual tracking started.')
    controller.pause()
    calibration.cancelInteraction()
    annotations.setActiveTool('select')
    annotations.cancelInteraction()
  }, [
    annotations.cancelInteraction,
    annotations.setActiveTool,
    assisted.stopForExternalInteraction,
    calibration.cancelInteraction,
    controller.pause,
  ])

  const handleTrackMark = useCallback(() => {
    if (assisted.session.status !== 'idle') return
    if (tracking.mode === 'mark') {
      tracking.cancelInteraction()
      return
    }
    if (tracking.activeTrack === null) return
    prepareTrackingInteraction()
    tracking.beginMark()
  }, [
    prepareTrackingInteraction,
    assisted.session.status,
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

  const beginAssistedSeed = useCallback(() => {
    if (tracking.activeTrack === null) return
    controller.pause()
    calibration.cancelInteraction()
    annotations.setActiveTool('select')
    annotations.cancelInteraction()
    tracking.cancelInteraction()

    if (tracking.currentSample !== null) {
      void assisted.seedFromSample(tracking.currentSample)
      return
    }
    if (assisted.beginSeedSelection()) tracking.beginSeed()
  }, [
    annotations.cancelInteraction,
    annotations.setActiveTool,
    assisted.beginSeedSelection,
    assisted.seedFromSample,
    calibration.cancelInteraction,
    controller.pause,
    tracking.activeTrack,
    tracking.beginSeed,
    tracking.cancelInteraction,
    tracking.currentSample,
  ])

  const handleBeginAssistedSeed = useCallback(() => {
    if (!assistedTrackingNoticeAcknowledged) {
      setShowAssistedTrackingNotice(true)
      return
    }
    beginAssistedSeed()
  }, [assistedTrackingNoticeAcknowledged, beginAssistedSeed])

  const handleContinueAssistedTrackingNotice = useCallback(() => {
    onAcknowledgeAssistedTrackingNotice()
    setShowAssistedTrackingNotice(false)
    beginAssistedSeed()
  }, [beginAssistedSeed, onAcknowledgeAssistedTrackingNotice])

  const handleCancelAssistedSeed = useCallback(() => {
    tracking.cancelInteraction()
    assisted.cancelSeedSelection()
  }, [assisted.cancelSeedSelection, tracking.cancelInteraction])

  const handleStartAssisted = useCallback(() => {
    controller.pause()
    calibration.cancelInteraction()
    annotations.setActiveTool('select')
    annotations.cancelInteraction()
    tracking.cancelInteraction()
    assisted.start()
  }, [
    annotations.cancelInteraction,
    annotations.setActiveTool,
    assisted.start,
    calibration.cancelInteraction,
    controller.pause,
    tracking.cancelInteraction,
  ])

  const handleTogglePlayback = useCallback(async () => {
    assisted.stopForExternalInteraction('Stopped because playback started.')
    if (calibration.mode !== 'idle') calibration.cancelInteraction()
    if (tracking.mode !== 'idle') tracking.cancelInteraction()
    await controller.togglePlayback()
  }, [
    calibration.cancelInteraction,
    calibration.mode,
    assisted.stopForExternalInteraction,
    controller.togglePlayback,
    tracking.cancelInteraction,
    tracking.mode,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (workspaceView === 'report') return
      if (isEditableOrInteractive(event.target)) {
        return
      }

      const commandKey = event.ctrlKey || event.metaKey
      if (commandKey && !event.altKey && event.code === 'KeyZ') {
        event.preventDefault()
        if (calibration.mode === 'idle' && assisted.session.status === 'idle') {
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
        if (calibration.mode === 'idle' && assisted.session.status === 'idle') {
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
        if (assisted.session.status === 'running') assisted.stop()
        else if (tracking.mode === 'seed') handleCancelAssistedSeed()
        else if (calibration.mode !== 'idle') calibration.cancelInteraction()
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
        handleManualStep(-1)
      } else if (event.code === 'ArrowRight' && calibration.mode === 'idle') {
        event.preventDefault()
        handleManualStep(1)
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
    assisted.session.status,
    assisted.stop,
    calibration.cancelInteraction,
    calibration.mode,
    controlsEnabled,
    handleTogglePlayback,
    handleCancelAssistedSeed,
    handleManualStep,
    handleTrackMark,
    handleToolChange,
    tracking.cancelInteraction,
    tracking.currentSample,
    tracking.deleteCurrentSample,
    tracking.mode,
    tracking.redo,
    tracking.undo,
    workspaceView,
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
        <div className="workspace-view-switcher" aria-label="Workspace view" role="group">
          <button
            aria-pressed={workspaceView === 'analysis'}
            onClick={() => setWorkspaceView('analysis')}
            type="button"
          >
            Analysis
          </button>
          <button
            aria-pressed={workspaceView === 'report'}
            disabled={controller.metadata === null}
            onClick={() => {
              assisted.stopForExternalInteraction('Stopped because the report workspace opened.')
              controller.pause()
              setReportGeneratedAt(new Date().toISOString())
              setWorkspaceView('report')
            }}
            type="button"
          >
            Report
          </button>
        </div>
        <div className="workspace-bar__actions">
          {(projectError !== null || importError !== null || operationMessage !== null) && (
            <span
              className={operationMessage?.kind === 'status' && projectError === null && importError === null
                ? 'toolbar-status'
                : 'toolbar-error'}
              role={operationMessage?.kind === 'status' && projectError === null && importError === null
                ? 'status'
                : 'alert'}
            >
              {projectError ?? importError ?? operationMessage?.text}
            </span>
          )}
          <WorkspaceFileActions
            canExportGraph={tracking.activeTrack !== null && visualizationGroup !== null}
            canSave={controller.metadata !== null}
            onExportCsv={handleExportCsv}
            onExportGraph={handleExportGraph}
            onExportJson={handleExportJson}
            onOpenProject={onOpenProject}
            onSaveProject={handleSaveProject}
          />
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

      {relinkComparison !== null && !relinkComparison.matches && (
        <VideoRelinkWarning
          differences={relinkComparison.differences}
          onAccept={onProjectRelinkComplete}
          onSelectVideo={onSelectVideo}
        />
      )}

      {workspaceView === 'analysis' ? (
      <div className="workspace__body">
        <div className="analysis-area">
          <AnnotationToolbar
            activeTool={annotations.activeTool}
            canRedo={annotations.canRedo && calibration.mode === 'idle' && tracking.mode === 'idle' && assisted.session.status === 'idle'}
            canUndo={annotations.canUndo && calibration.mode === 'idle' && tracking.mode === 'idle' && assisted.session.status === 'idle'}
            enabled={controlsEnabled}
            onRedo={annotations.redo}
            onTrackMark={handleTrackMark}
            onToolChange={handleToolChange}
            onUndo={annotations.undo}
            trackingEnabled={tracking.activeTrack !== null && assisted.session.status === 'idle'}
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
              assistedSeedPosition: assisted.session.seed?.sample.nativePosition ?? null,
              assistedSuggestions: assisted.session.suggestions,
              assistedColor: tracking.activeTrack?.color ?? null,
              currentTime: controller.currentTime,
              draft: annotations.draft,
              onPointerCancel: () => {
                if (calibration.mode !== 'idle') return
                if (tracking.mode === 'seed') handleCancelAssistedSeed()
                else if (tracking.mode !== 'idle') tracking.pointerCancel()
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
                  if (tracking.mode === 'seed') {
                    const sample = tracking.confirmSeed(point)
                    tracking.cancelInteraction()
                    if (sample === null) assisted.cancelSeedSelection()
                    else void assisted.seedFromSample(sample)
                    return false
                  }
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
            onSeek={handleSeekSample}
            onStep={handleManualStep}
            onTogglePlayback={handleTogglePlayback}
            playbackRate={controller.playbackRate}
            timelineEnabled={controlsEnabled && controller.hasUsableDuration}
          />
        </div>
        <AnalysisPanel
          activeSampleId={tracking.currentSample?.id ?? null}
          analysis={trackAnalysis}
          analysisError={analysisError}
          analysisSpace={trackAnalysis?.space ?? rawTrackAnalysis?.space ?? null}
          analysisSource={analysisPanel.source}
          currentTime={controller.currentTime}
          expanded={analysisPanel.expanded}
          group={visualizationGroup}
          model={analysisPanel.model}
          modelFitError={modelFitResult !== null && !modelFitResult.ok ? modelFitResult.message : null}
          mode={analysisPanel.mode}
          onAnalysisSourceChange={(source) => {
            dispatchAnalysisPanel({ type: 'select-source', source })
          }}
          onModelChange={(model) => {
            dispatchAnalysisPanel({ type: 'select-model', model })
          }}
          onModeChange={(mode) => {
            dispatchAnalysisPanel({ type: 'select-mode', mode })
          }}
          onResidualModeChange={(mode) => {
            dispatchAnalysisPanel({ type: 'select-residual-mode', mode })
          }}
          onSeekTime={handleSeekSample}
          onToggleExpanded={() => {
            dispatchAnalysisPanel({ type: 'toggle-expanded' })
          }}
          onViewChange={(view) => {
            dispatchAnalysisPanel({ type: 'select-view', view })
          }}
          onWindowChange={(windowSize) => {
            dispatchAnalysisPanel({ type: 'select-window', windowSize })
          }}
          residualMode={analysisPanel.residualMode}
          track={tracking.activeTrack}
          view={analysisPanel.view}
        />
        <VideoInspector metadata={controller.metadata} source={source}>
          <GettingStartedPanel
            activeTrackId={tracking.activeTrackId}
            hasCalibration={calibration.calibration !== null}
            tracks={tracking.tracks}
          />
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
            assistedAverageProcessingMs={assisted.averageProcessingMs}
            assistedSession={assisted.session}
            advanceAfterMark={tracking.advanceAfterMark}
            calibration={calibration.calibration}
            canRedo={tracking.canRedo && assisted.session.status === 'idle'}
            canUndo={tracking.canUndo && assisted.session.status === 'idle'}
            currentSample={tracking.currentSample}
            mode={tracking.mode}
            onAdvanceAfterMarkChange={tracking.setAdvanceAfterMark}
            onAcceptAssisted={() => {
              assisted.acceptSuggestions()
            }}
            onBeginAssistedSeed={handleBeginAssistedSeed}
            onBeginEdit={handleTrackEdit}
            onBeginMark={handleTrackMark}
            onCancelInteraction={tracking.cancelInteraction}
            onCreateTrack={tracking.createTrack}
            onDeleteCurrentSample={tracking.deleteCurrentSample}
            onDeleteTrack={(id) => {
              if (id === tracking.activeTrackId) assisted.discardSuggestions()
              tracking.deleteTrack(id)
            }}
            onDiscardAssisted={assisted.discardSuggestions}
            onRedo={tracking.redo}
            onRenameTrack={tracking.renameTrack}
            onSeekSample={handleSeekSample}
            onSelectTrack={(id) => {
              if (id !== tracking.activeTrackId) assisted.discardSuggestions()
              tracking.selectTrack(id)
            }}
            onCancelAssistedSeed={handleCancelAssistedSeed}
            onStartAssisted={handleStartAssisted}
            onStopAssisted={assisted.stop}
            onTrailModeChange={tracking.setTrailMode}
            onUndo={tracking.undo}
            tracks={tracking.tracks}
            trailMode={tracking.trailMode}
          />
          <KinematicsPanel
            analysis={trackAnalysis}
            analysisSource={analysisPanel.source}
            currentSample={tracking.currentSample}
            diagnostics={fitDiagnostics}
            model={analysisPanel.model}
            modelFitResult={modelFitResult}
            onSeekSample={handleSeekSample}
            track={tracking.activeTrack}
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
          <ShortcutHelp />
        </VideoInspector>
      </div>
      ) : (
        <ReportWorkspace
          onBack={() => setWorkspaceView('analysis')}
          onExportHtml={handleExportReport}
          onReportStateChange={setReportState}
          report={experimentReport}
          reportState={reportState}
          tracks={tracking.tracks}
        />
      )}
      {showAssistedTrackingNotice && (
        <AssistedTrackingNotice
          onCancel={() => setShowAssistedTrackingNotice(false)}
          onContinue={handleContinueAssistedTrackingNotice}
        />
      )}
    </main>
  )
}
