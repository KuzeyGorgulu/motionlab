import {
  useMemo,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import {
  createChartLayout,
  isTimeWithinDomain,
  markerRadiusForSampleCount,
  mediaTimeToSvgX,
  svgXToMediaTime,
} from '../../analysis/chart'
import { formatAnalysisNumber } from '../../analysis/format'
import type {
  ChartPoint,
  MarkerShape,
  TimeDomain,
  VisualizationGroup,
} from '../../analysis/types'
import { useElementSize } from '../../hooks/useElementSize'
import { formatTimestamp } from '../../video/timing'

interface KinematicsGraphProps {
  group: VisualizationGroup
  activeSampleId: string | null
  color: string
  currentTime: number
  onSeekTime: (time: number) => void
}

const FALLBACK_WIDTH = 900
const FALLBACK_HEIGHT = 280
const GRID_STEPS = 4
const SECONDARY_COLOR = '#7aa7ff'
const MAGNITUDE_COLOR = '#f0b86c'

function colorForSeries(index: number, trackColor: string): string {
  if (index === 0) return trackColor
  return index === 1 ? SECONDARY_COLOR : MAGNITUDE_COLOR
}

function Marker({
  point,
  shape,
  size,
  fill,
  active,
}: {
  point: ChartPoint
  shape: MarkerShape
  size: number
  fill: string
  active: boolean
}) {
  return (
    <>
      <circle
        className="kinematics-graph__point-hit"
        cx={point.x}
        cy={point.y}
        r={Math.max(10, size + 4)}
      />
      {shape === 'circle' && (
        <circle
          className="kinematics-graph__marker-shape"
          cx={point.x}
          cy={point.y}
          fill={fill}
          r={size}
        />
      )}
      {shape === 'square' && (
        <rect
          className="kinematics-graph__marker-shape"
          fill={fill}
          height={size * 2}
          width={size * 2}
          x={point.x - size}
          y={point.y - size}
        />
      )}
      {shape === 'diamond' && (
        <path
          className="kinematics-graph__marker-shape"
          d={`M ${point.x} ${point.y - size} L ${point.x + size} ${point.y} L ${point.x} ${point.y + size} L ${point.x - size} ${point.y} Z`}
          fill={fill}
        />
      )}
      {active && (
        <circle
          className="kinematics-graph__active-ring"
          cx={point.x}
          cy={point.y}
          r={size + 4}
        />
      )}
    </>
  )
}

export function KinematicsGraph({
  group,
  activeSampleId,
  color,
  currentTime,
  onSeekTime,
}: KinematicsGraphProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [cursorTime, setCursorTime] = useState<number | null>(null)
  const measuredSize = useElementSize(plotRef)
  const width = measuredSize.width > 0 ? measuredSize.width : FALLBACK_WIDTH
  const height = measuredSize.height > 0 ? measuredSize.height : FALLBACK_HEIGHT
  const layout = useMemo(
    () => createChartLayout(group.series, group.timeline, width, height),
    [group.series, group.timeline, height, width],
  )

  useEffect(() => {
    setCursorTime(null)
  }, [group])

  if (layout === null) {
    return (
      <div className="kinematics-graph">
        <div className="kinematics-graph__empty">
          <strong>No available {group.label.toLowerCase()} samples</strong>
          <span>
            Missing derivative values remain unavailable and are not plotted as zero.
          </span>
          <small>Video time {formatTimestamp(currentTime)}</small>
        </div>
      </div>
    )
  }

  const timeDomain: TimeDomain = {
    min: layout.timeMin,
    max: layout.timeMax,
    sourceMin: layout.sourceTimeMin,
    sourceMax: layout.sourceTimeMax,
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
  const playheadInDomain = isTimeWithinDomain(currentTime, timeDomain)
  const playheadX = playheadInDomain
    ? mediaTimeToSvgX(currentTime, timeDomain, layout.plot)
    : null
  const cursorX = cursorTime === null
    ? null
    : mediaTimeToSvgX(cursorTime, timeDomain, layout.plot)
  const sampleCount = Math.max(0, ...group.series.map((series) => series.points.length))
  const markerSize = markerRadiusForSampleCount(sampleCount)

  type GraphPointerEvent =
    | ReactPointerEvent<SVGSVGElement>
    | ReactMouseEvent<SVGSVGElement>

  const pointerPosition = (event: GraphPointerEvent) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return null
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * width,
      y: ((event.clientY - bounds.top) / bounds.height) * height,
    }
  }

  const timeAtPointer = (event: GraphPointerEvent) => {
    const position = pointerPosition(event)
    if (
      position === null ||
      position.x < layout.plot.left ||
      position.x > layout.plot.right ||
      position.y < layout.plot.top ||
      position.y > layout.plot.bottom
    ) {
      return null
    }
    return svgXToMediaTime(position.x, timeDomain, layout.plot)
  }

  return (
    <div className="kinematics-graph">
      <div className="kinematics-graph__plot" ref={plotRef}>
        <svg
          aria-label={`${group.label} components against media time in ${group.unit}. ${group.series.map((series) => series.label).join(', ')}.`}
          onClick={(event) => {
            const time = timeAtPointer(event)
            if (time !== null) onSeekTime(time)
          }}
          onPointerLeave={() => setCursorTime(null)}
          onPointerMove={(event) => setCursorTime(timeAtPointer(event))}
          role="group"
          viewBox={`0 0 ${width} ${height}`}
        >
          <rect
            className="kinematics-graph__interaction-area"
            height={layout.plot.bottom - layout.plot.top}
            width={layout.plot.right - layout.plot.left}
            x={layout.plot.left}
            y={layout.plot.top}
          />
          <g aria-hidden="true">
            {horizontalGrid.map(({ y, value }, index) => (
              <g key={index}>
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
            {verticalGrid.map(({ x, time }, index) => (
              <g key={index}>
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
              {group.axisLabel} ({group.unit})
            </text>
            {playheadX !== null && (
              <>
                <line
                  className="kinematics-graph__playhead"
                  x1={playheadX}
                  x2={playheadX}
                  y1={layout.plot.top}
                  y2={layout.plot.bottom}
                />
                <path
                  className="kinematics-graph__playhead-cap"
                  d={`M ${playheadX - 5} ${layout.plot.top} L ${playheadX + 5} ${layout.plot.top} L ${playheadX} ${layout.plot.top + 7} Z`}
                />
              </>
            )}
            {cursorX !== null && (
              <line
                className="kinematics-graph__cursor"
                x1={cursorX}
                x2={cursorX}
                y1={layout.plot.top}
                y2={layout.plot.bottom}
              />
            )}
          </g>
          {group.series.map((series, seriesIndex) => {
            const seriesLayout = layout.series.find((item) => item.key === series.key)
            const seriesColor = colorForSeries(seriesIndex, color)
            return seriesLayout?.points.map((point) => {
              const active = point.sampleId === activeSampleId
              const activate = () => onSeekTime(point.time)
              return (
                <g
                  aria-label={`${series.label} ${formatAnalysisNumber(point.value)} ${group.unit} at ${formatTimestamp(point.time)}. Seek video.`}
                  className={active ? 'kinematics-graph__point kinematics-graph__point--active' : 'kinematics-graph__point'}
                  key={`${series.key}-${point.sampleId}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    activate()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.stopPropagation()
                      activate()
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <Marker
                    active={active}
                    fill={seriesColor}
                    point={point}
                    shape={series.marker}
                    size={active ? markerSize + 1 : markerSize}
                  />
                  <title>
                    {series.label} · {formatAnalysisNumber(point.value)} {group.unit} · {formatTimestamp(point.time)}
                  </title>
                </g>
              )
            })
          })}
        </svg>
      </div>
      <div className="kinematics-graph__legend">
        <div className="kinematics-graph__series-legend" aria-label="Series legend">
          {group.series.map((series, index) => (
            <span key={series.key}>
              <i
                aria-hidden="true"
                className={`kinematics-graph__legend-marker kinematics-graph__legend-marker--${series.marker}`}
                style={{ backgroundColor: colorForSeries(index, color) }}
              />
              {series.label}
            </span>
          ))}
        </div>
        <div className="kinematics-graph__sync-readout">
          <span className="kinematics-graph__video-time">
            Video {formatTimestamp(currentTime)}{playheadInDomain ? '' : ' · outside graph range'}
          </span>
          <span className="kinematics-graph__cursor-time">
            Cursor {cursorTime === null ? '—' : formatTimestamp(cursorTime)}
          </span>
        </div>
        <span className="kinematics-graph__method-note">
          Samples only · no interpolation
        </span>
      </div>
    </div>
  )
}
