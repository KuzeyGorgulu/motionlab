import type {
  AnalysisSource,
  AnalysisSpace,
  AnalysisView,
  MotionModelType,
  ResidualVisualizationMode,
  SmoothingWindowSize,
  TrackKinematics,
  VisualizationGroup,
  VisualizationMode,
} from '../../analysis/types'
import type { Track } from '../../tracking/types'
import { KinematicsGraph } from './KinematicsGraph'

interface AnalysisPanelProps {
  track: Track | null
  analysis: TrackKinematics | null
  analysisSpace: AnalysisSpace | null
  analysisError: string | null
  analysisSource: AnalysisSource
  group: VisualizationGroup | null
  model: MotionModelType
  modelFitError: string | null
  activeSampleId: string | null
  currentTime: number
  expanded: boolean
  view: AnalysisView
  mode: VisualizationMode
  residualMode: ResidualVisualizationMode
  onAnalysisSourceChange: (source: AnalysisSource['type']) => void
  onModelChange: (model: MotionModelType) => void
  onModeChange: (mode: VisualizationMode) => void
  onResidualModeChange: (mode: ResidualVisualizationMode) => void
  onSeekTime: (time: number) => void
  onToggleExpanded: () => void
  onViewChange: (view: AnalysisView) => void
  onWindowChange: (windowSize: SmoothingWindowSize) => void
}

const MODES: Array<{ key: VisualizationMode; label: string }> = [
  { key: 'position', label: 'Position' },
  { key: 'velocity', label: 'Velocity' },
  { key: 'acceleration', label: 'Acceleration' },
]

const RESIDUAL_MODES: Array<{ key: ResidualVisualizationMode; label: string }> = [
  { key: 'residual-magnitude', label: 'Magnitude' },
  { key: 'residual-x', label: 'Residual X' },
  { key: 'residual-y', label: 'Residual Y' },
]

const MODELS: Array<{ key: MotionModelType; label: string }> = [
  { key: 'none', label: 'None' },
  { key: 'constant-velocity', label: 'Constant velocity' },
  { key: 'constant-acceleration', label: 'Constant acceleration' },
]

const WINDOWS: SmoothingWindowSize[] = [5, 7, 9]

export function AnalysisPanel({
  track,
  analysis,
  analysisSpace,
  analysisError,
  analysisSource,
  group,
  model,
  modelFitError,
  activeSampleId,
  currentTime,
  expanded,
  view,
  mode,
  residualMode,
  onAnalysisSourceChange,
  onModelChange,
  onModeChange,
  onResidualModeChange,
  onSeekTime,
  onToggleExpanded,
  onViewChange,
  onWindowChange,
}: AnalysisPanelProps) {
  const panelBodyId = 'motion-analysis-panel-body'

  return (
    <section
      className={expanded ? 'analysis-dock analysis-dock--expanded' : 'analysis-dock'}
      aria-label="Motion analysis"
    >
      <header className="analysis-dock__header">
        <div className="analysis-dock__identity">
          <span className="analysis-dock__eyebrow">Analysis</span>
          <strong>{track?.name ?? 'No active track'}</strong>
          {analysis !== null && (
            <small>
              {analysis.samples.length} valid samples · {group?.unit ?? analysis.positionUnit}
            </small>
          )}
        </div>
        <span
          className={analysisSpace === 'world' ? 'analysis-space analysis-space--world' : 'analysis-space'}
        >
          {analysisSpace ?? 'idle'}
        </span>
        <button
          aria-controls={panelBodyId}
          aria-expanded={expanded}
          className="analysis-dock__toggle"
          onClick={onToggleExpanded}
          type="button"
        >
          <span aria-hidden="true">{expanded ? '▾' : '▴'}</span>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </header>

      {expanded && (
        <div className="analysis-dock__body" id={panelBodyId}>
          {track === null ? (
            <div className="analysis-dock__empty">
              <strong>No motion data yet</strong>
              <span>Create a track in Tracking, then mark the object across several video positions.</span>
            </div>
          ) : track.samples.length === 0 ? (
            <div className="analysis-dock__empty">
              <strong>No measurements to graph</strong>
              <span>Choose Mark point in Tracking and place the object on the paused video.</span>
            </div>
          ) : (
            <>
              <div className="analysis-controls">
                <div className="analysis-view-tabs" aria-label="Analysis view" role="group">
                  {(['motion', 'residuals'] as const).map((option) => (
                    <button
                      aria-pressed={view === option}
                      className={view === option ? 'analysis-view-tab analysis-view-tab--active' : 'analysis-view-tab'}
                      key={option}
                      onClick={() => onViewChange(option)}
                      type="button"
                    >
                      {option === 'motion' ? 'Motion' : 'Residuals'}
                    </button>
                  ))}
                </div>
                {view === 'motion' ? (
                  <div className="kinematics-series-tabs" aria-label="Visualization quantity">
                    {MODES.map((option) => (
                      <button
                        aria-pressed={mode === option.key}
                        className={mode === option.key ? 'kinematics-series-tab kinematics-series-tab--active' : 'kinematics-series-tab'}
                        key={option.key}
                        onClick={() => onModeChange(option.key)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="kinematics-series-tabs" aria-label="Residual quantity">
                    {RESIDUAL_MODES.map((option) => (
                      <button
                        aria-pressed={residualMode === option.key}
                        className={residualMode === option.key ? 'kinematics-series-tab kinematics-series-tab--active' : 'kinematics-series-tab'}
                        key={option.key}
                        onClick={() => onResidualModeChange(option.key)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="analysis-controls__row">
                  <div className="analysis-control-group" aria-label="Analysis data source" role="group">
                    <span>Data</span>
                    {(['raw', 'smoothed'] as const).map((source) => (
                      <button
                        aria-pressed={analysisSource.type === source}
                        key={source}
                        onClick={() => onAnalysisSourceChange(source)}
                        title={source === 'raw'
                          ? 'Use the confirmed measurements exactly as recorded'
                          : 'Reduce measurement noise without changing recorded points'}
                        type="button"
                      >
                        {source === 'raw' ? 'Raw' : 'Smoothed'}
                      </button>
                    ))}
                  </div>
                  {analysisSource.type === 'smoothed' && (
                    <div className="analysis-control-group" aria-label="Smoothing window" role="group">
                      <span>Window</span>
                      {WINDOWS.map((windowSize) => (
                        <button
                          aria-pressed={analysisSource.windowSize === windowSize}
                          key={windowSize}
                          onClick={() => onWindowChange(windowSize)}
                          title={`Use ${windowSize} nearby measurements for local smoothing`}
                          type="button"
                        >
                          {windowSize}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="analysis-control-group analysis-control-group--model" aria-label="Motion model" role="group">
                    <span>Model</span>
                    {MODELS.map((option) => (
                      <button
                        aria-pressed={model === option.key}
                        key={option.key}
                        onClick={() => onModelChange(option.key)}
                        title={option.key === 'none'
                          ? 'Show measurements without a fitted motion model'
                          : option.key === 'constant-velocity'
                            ? 'Fit motion with steady velocity over time'
                            : 'Fit motion with steady acceleration over time'}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {analysisSource.type === 'smoothed' && (
                  <p className="analysis-controls__note">
                    Smoothing fits a local quadratic to measured samples. Raw observations are never changed.
                  </p>
                )}
              </div>
              {analysisError !== null ? (
                <div className="kinematics-graph">
                  <div className="kinematics-graph__empty" role="status">
                    <strong>Smoothed analysis unavailable</strong>
                    <span>{analysisError}</span>
                    <small>Switch to Raw to inspect the confirmed observations.</small>
                  </div>
                </div>
              ) : view === 'residuals' && model === 'none' ? (
                <div className="kinematics-graph">
                  <div className="kinematics-graph__empty" role="status">
                    <strong>Select a motion model</strong>
                    <span>Choose constant velocity or constant acceleration to inspect fit residuals.</span>
                    <small>Residuals compare the selected fit source with its model prediction.</small>
                  </div>
                </div>
              ) : view === 'residuals' && group === null ? (
                <div className="kinematics-graph">
                  <div className="kinematics-graph__empty" role="status">
                    <strong>Fit diagnostics unavailable</strong>
                    <span>{modelFitError ?? 'The selected model could not be evaluated safely.'}</span>
                    <small>Raw tracking and motion analysis remain available.</small>
                  </div>
                </div>
              ) : group !== null ? (
                <KinematicsGraph
                  activeSampleId={activeSampleId}
                  color={track.color}
                  currentTime={currentTime}
                  group={group}
                  onSeekTime={onSeekTime}
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  )
}
