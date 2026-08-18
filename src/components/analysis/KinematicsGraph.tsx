import { useMemo, useRef } from 'react'

import { createChartLayout } from '../../analysis/chart'
import { formatAnalysisNumber } from '../../analysis/format'
import type { GraphSeries } from '../../analysis/types'
import { useElementSize } from '../../hooks/useElementSize'
import { formatTimestamp } from '../../video/timing'

interface KinematicsGraphProps {
  series: GraphSeries
  activeSampleId: string | null
  color: string
  onSeekSample: (time: number) => void
}

const FALLBACK_WIDTH = 900
const FALLBACK_HEIGHT = 280
const GRID_STEPS = 4

export function KinematicsGraph({
  series,
  activeSampleId,
  color,
  onSeekSample,
}: KinematicsGraphProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const measuredSize = useElementSize(plotRef)
  const width = measuredSize.width > 0 ? measuredSize.width : FALLBACK_WIDTH
  const height = measuredSize.height > 0 ? measuredSize.height : FALLBACK_HEIGHT
  const layout = useMemo(
    () => createChartLayout(series.points, width, height),
    [height, series.points, width],
  )

  if (layout === null) {
    return (
      <div className="kinematics-graph">
        <div className="kinematics-graph__empty">
          No valid {series.label.toLowerCase()} samples are available yet.
        </div>
      </div>
    )
  }

  const horizontalGrid = Array.from({ length: GRID_STEPS + 1 }, (_, index) => {
    const ratio = index / GRID_STEPS
    const y = layout.plot.top + ratio * (layout.plot.bottom - layout.plot.top)
    const value = layout.valueMax - ratio * (layout.valueMax - layout.valueMin)
    return { y, value }
  })
  const verticalGrid = Array.from({ length: GRID_STEPS + 1 }, (_, index) => {
    const ratio = index / GRID_STEPS
    const x = layout.plot.left + ratio * (layout.plot.right - layout.plot.left)
    const time = layout.timeMin + ratio * (layout.timeMax - layout.timeMin)
    return { x, time }
  })
  const zeroY =
    layout.valueMin <= 0 && layout.valueMax >= 0
      ? layout.plot.bottom -
        ((0 - layout.valueMin) / (layout.valueMax - layout.valueMin)) *
          (layout.plot.bottom - layout.plot.top)
      : null

  return (
    <div className="kinematics-graph">
      <div className="kinematics-graph__plot" ref={plotRef}>
        <svg
          aria-label={`${series.label} against media time in ${series.unit}`}
          role="group"
          viewBox={`0 0 ${width} ${height}`}
        >
          {horizontalGrid.map(({ y, value }) => (
            <g key={y}>
              <line
                className="kinematics-graph__grid"
                x1={layout.plot.left}
                x2={layout.plot.right}
                y1={y}
                y2={y}
              />
              <text
                className="kinematics-graph__label"
                textAnchor="end"
                x={layout.plot.left - 10}
                y={y + 4}
              >
                {formatAnalysisNumber(value)}
              </text>
            </g>
          ))}
          {verticalGrid.map(({ x, time }) => (
            <g key={x}>
              <line
                className="kinematics-graph__grid"
                x1={x}
                x2={x}
                y1={layout.plot.top}
                y2={layout.plot.bottom}
              />
              <text
                className="kinematics-graph__label"
                textAnchor="middle"
                x={x}
                y={layout.plot.bottom + 20}
              >
                {formatAnalysisNumber(Math.max(0, time))}
              </text>
            </g>
          ))}
          {zeroY !== null && (
            <line
              className="kinematics-graph__zero"
              x1={layout.plot.left}
              x2={layout.plot.right}
              y1={zeroY}
              y2={zeroY}
            />
          )}
          <line
            className="kinematics-graph__axis"
            x1={layout.plot.left}
            x2={layout.plot.right}
            y1={layout.plot.bottom}
            y2={layout.plot.bottom}
          />
          <line
            className="kinematics-graph__axis"
            x1={layout.plot.left}
            x2={layout.plot.left}
            y1={layout.plot.top}
            y2={layout.plot.bottom}
          />
          <text
            className="kinematics-graph__axis-title"
            textAnchor="middle"
            x={width / 2}
            y={height - 10}
          >
            Time (s)
          </text>
          <text
            className="kinematics-graph__axis-title"
            textAnchor="middle"
            transform={`translate(17 ${(layout.plot.top + layout.plot.bottom) / 2}) rotate(-90)`}
          >
            {series.axisLabel} ({series.unit})
          </text>
          {layout.points.map((point) => {
            const active = point.sampleId === activeSampleId
            const signClass = point.value < 0
              ? ' kinematics-graph__point--negative'
              : point.value > 0
                ? ' kinematics-graph__point--positive'
                : ' kinematics-graph__point--zero'
            const activate = () => onSeekSample(point.time)
            return (
              <circle
                aria-label={`${series.label} ${formatAnalysisNumber(point.value)} ${series.unit} at ${formatTimestamp(point.time)}. Seek video.`}
                className={`kinematics-graph__point${signClass}${active ? ' kinematics-graph__point--active' : ''}`}
                cx={point.x}
                cy={point.y}
                fill={point.value < 0 ? '#e2a06e' : point.value > 0 ? color : '#aab7bf'}
                key={point.sampleId}
                onClick={activate}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    activate()
                  }
                }}
                r={active ? 6.5 : 5}
                role="button"
                tabIndex={0}
              >
                <title>
                  {formatTimestamp(point.time)} · {formatAnalysisNumber(point.value)} {series.unit}
                </title>
              </circle>
            )
          })}
        </svg>
      </div>
      <div className="kinematics-graph__legend">
        <span>{series.label} ({series.unit}) · exact media timestamps</span>
        <span>
          {layout.valueMin < 0 ? 'Orange marks negative values · ' : ''}
          Discrete samples · differentiation amplifies noise · select a point to seek
        </span>
      </div>
    </div>
  )
}
