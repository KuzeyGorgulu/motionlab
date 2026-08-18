import { useMemo } from 'react'

import { selectGraphSeries } from '../../analysis/series'
import type {
  GraphSeriesKey,
  TrackKinematics,
} from '../../analysis/types'
import type { Track } from '../../tracking/types'
import { KinematicsGraph } from './KinematicsGraph'

interface AnalysisPanelProps {
  track: Track | null
  analysis: TrackKinematics | null
  activeSampleId: string | null
  expanded: boolean
  seriesKey: GraphSeriesKey
  onSeriesChange: (seriesKey: GraphSeriesKey) => void
  onSeekSample: (time: number) => void
  onToggleExpanded: () => void
}

const SERIES: Array<{ key: GraphSeriesKey; label: string }> = [
  { key: 'position-x', label: 'x(t)' },
  { key: 'position-y', label: 'y(t)' },
  { key: 'speed', label: 'Speed' },
  { key: 'acceleration', label: '|a|' },
]

export function AnalysisPanel({
  track,
  analysis,
  activeSampleId,
  expanded,
  seriesKey,
  onSeriesChange,
  onSeekSample,
  onToggleExpanded,
}: AnalysisPanelProps) {
  const series = useMemo(
    () => (analysis === null ? null : selectGraphSeries(analysis, seriesKey)),
    [analysis, seriesKey],
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
              {analysis.samples.length} valid samples · {analysis.positionUnit}
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
              <div className="kinematics-series-tabs" aria-label="Graph series">
                {SERIES.map((option) => (
                  <button
                    aria-pressed={seriesKey === option.key}
                    className={seriesKey === option.key ? 'kinematics-series-tab kinematics-series-tab--active' : 'kinematics-series-tab'}
                    key={option.key}
                    onClick={() => onSeriesChange(option.key)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {series !== null && (
                <KinematicsGraph
                  activeSampleId={activeSampleId}
                  color={track.color}
                  onSeekSample={onSeekSample}
                  series={series}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
