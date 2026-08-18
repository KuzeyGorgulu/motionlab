import { useMemo } from 'react'

import { selectVisualizationGroup } from '../../analysis/series'
import type {
  TrackKinematics,
  VisualizationMode,
} from '../../analysis/types'
import type { Track } from '../../tracking/types'
import { KinematicsGraph } from './KinematicsGraph'

interface AnalysisPanelProps {
  track: Track | null
  analysis: TrackKinematics | null
  activeSampleId: string | null
  currentTime: number
  expanded: boolean
  mode: VisualizationMode
  onModeChange: (mode: VisualizationMode) => void
  onSeekTime: (time: number) => void
  onToggleExpanded: () => void
}

const MODES: Array<{ key: VisualizationMode; label: string }> = [
  { key: 'position', label: 'Position' },
  { key: 'velocity', label: 'Velocity' },
  { key: 'acceleration', label: 'Acceleration' },
]

export function AnalysisPanel({
  track,
  analysis,
  activeSampleId,
  currentTime,
  expanded,
  mode,
  onModeChange,
  onSeekTime,
  onToggleExpanded,
}: AnalysisPanelProps) {
  const group = useMemo(
    () => (analysis === null ? null : selectVisualizationGroup(analysis, mode)),
    [analysis, mode],
  )
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
              {analysis.samples.length} valid samples · {group?.unit}
            </small>
          )}
        </div>
        <span
          className={analysis?.space === 'world' ? 'analysis-space analysis-space--world' : 'analysis-space'}
        >
          {analysis?.space ?? 'idle'}
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
          {track === null || analysis === null ? (
            <div className="analysis-dock__empty">
              Create and select a track to plot position and motion.
            </div>
          ) : track.samples.length === 0 ? (
            <div className="analysis-dock__empty">
              Mark the first sample to begin graphing this track.
            </div>
          ) : (
            <>
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
              {group !== null && (
                <KinematicsGraph
                  activeSampleId={activeSampleId}
                  color={track.color}
                  currentTime={currentTime}
                  group={group}
                  onSeekTime={onSeekTime}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
