import type {
  AnalysisTimePoint,
  ChartLayout,
  ChartPlot,
  GraphDataPoint,
  TimeDomain,
  VisualizationSeries,
} from './types'

const DEFAULT_PADDING = { left: 76, top: 22, right: 24, bottom: 50 }
const DOMAIN_EPSILON = 1e-9

function validPlot(plot: ChartPlot): boolean {
  return (
    Number.isFinite(plot.left) &&
    Number.isFinite(plot.top) &&
    Number.isFinite(plot.right) &&
    Number.isFinite(plot.bottom) &&
    plot.right > plot.left &&
    plot.bottom > plot.top
  )
}

function validTimeDomain(domain: TimeDomain): boolean {
  return (
    Number.isFinite(domain.min) &&
    Number.isFinite(domain.max) &&
    domain.max >= domain.min
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function createTimeDomain(
  sourceTimeline: readonly AnalysisTimePoint[],
): TimeDomain | null {
  const times = sourceTimeline
    .map((point) => point.time)
    .filter((time) => Number.isFinite(time) && time >= 0)
    .sort((first, second) => first - second)
  if (times.length === 0) return null

  const sourceMin = times[0]!
  const sourceMax = times.at(-1)!
  const span = sourceMax - sourceMin
  const scale = Math.max(Math.abs(sourceMin), Math.abs(sourceMax), 1)
  if (!Number.isFinite(span) || !Number.isFinite(scale)) return null
  if (span <= scale * DOMAIN_EPSILON) {
    const center = sourceMin + span / 2
    const padding = Math.max(Math.abs(center) * 0.01, 0.5)
    const min = Math.max(0, center - padding)
    const max = Math.max(center + padding, min + 2 * padding)
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return null
    }
    return {
      min,
      max,
      sourceMin,
      sourceMax,
    }
  }

  return { min: sourceMin, max: sourceMax, sourceMin, sourceMax }
}

export function mediaTimeToSvgX(
  time: number,
  domain: TimeDomain,
  plot: ChartPlot,
): number | null {
  if (!Number.isFinite(time) || !validTimeDomain(domain) || !validPlot(plot)) {
    return null
  }
  if (domain.max === domain.min) return (plot.left + plot.right) / 2
  const boundedTime = clamp(time, domain.min, domain.max)
  return (
    plot.left +
    ((boundedTime - domain.min) / (domain.max - domain.min)) *
      (plot.right - plot.left)
  )
}

export function svgXToMediaTime(
  x: number,
  domain: TimeDomain,
  plot: ChartPlot,
): number | null {
  if (!Number.isFinite(x) || !validTimeDomain(domain) || !validPlot(plot)) {
    return null
  }
  if (domain.max === domain.min) return domain.min
  const boundedX = clamp(x, plot.left, plot.right)
  return (
    domain.min +
    ((boundedX - plot.left) / (plot.right - plot.left)) *
      (domain.max - domain.min)
  )
}

export function isTimeWithinDomain(time: number, domain: TimeDomain): boolean {
  return (
    Number.isFinite(time) &&
    validTimeDomain(domain) &&
    time >= domain.min &&
    time <= domain.max
  )
}

function usablePoint(
  point: GraphDataPoint,
  domain: TimeDomain,
): boolean {
  return (
    Number.isFinite(point.time) &&
    point.time >= domain.sourceMin &&
    point.time <= domain.sourceMax &&
    Number.isFinite(point.value)
  )
}

function valueDomain(points: readonly GraphDataPoint[]) {
  if (points.length === 0) return null
  let rawMin = points[0]!.value
  let rawMax = rawMin
  for (const point of points) {
    rawMin = Math.min(rawMin, point.value)
    rawMax = Math.max(rawMax, point.value)
  }
  const span = rawMax - rawMin
  const scale = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1)
  const padding =
    span <= scale * DOMAIN_EPSILON
      ? Math.max(Math.abs((rawMin + rawMax) / 2) * 0.1, 1e-6)
      : span * 0.08
  const min = rawMin - padding
  const max = rawMax + padding
  return Number.isFinite(min) && Number.isFinite(max) && max > min
    ? { min, max }
    : null
}

export function markerRadiusForSampleCount(sampleCount: number): number {
  if (!Number.isFinite(sampleCount) || sampleCount <= 24) return 5
  if (sampleCount <= 80) return 4
  return 3
}

export function createChartLayout(
  sourceSeries: readonly VisualizationSeries[],
  sourceTimeline: readonly AnalysisTimePoint[],
  width: number,
  height: number,
): ChartLayout | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  const plot = {
    left: DEFAULT_PADDING.left,
    top: DEFAULT_PADDING.top,
    right: width - DEFAULT_PADDING.right,
    bottom: height - DEFAULT_PADDING.bottom,
  }
  if (!validPlot(plot)) return null

  const timeDomain = createTimeDomain(sourceTimeline)
  if (timeDomain === null) return null

  const normalizedSeries = sourceSeries.map((series) => ({
    key: series.key,
    points: series.points
      .filter((point) => usablePoint(point, timeDomain))
      .sort(
        (first, second) =>
          first.time - second.time ||
          first.sampleId.localeCompare(second.sampleId),
      ),
  }))
  const allPoints = normalizedSeries.flatMap((series) => series.points)
  const values = valueDomain(allPoints)
  if (values === null) return null

  const valueSpan = values.max - values.min
  if (!Number.isFinite(valueSpan) || valueSpan <= 0) return null
  return {
    series: normalizedSeries.map((series) => ({
      key: series.key,
      points: series.points.flatMap((point) => {
        const x = mediaTimeToSvgX(point.time, timeDomain, plot)
        if (x === null) return []
        const y =
          plot.bottom -
          ((point.value - values.min) / valueSpan) *
            (plot.bottom - plot.top)
        return Number.isFinite(y) ? [{ ...point, x, y }] : []
      }),
    })),
    plot,
    timeMin: timeDomain.min,
    timeMax: timeDomain.max,
    sourceTimeMin: timeDomain.sourceMin,
    sourceTimeMax: timeDomain.sourceMax,
    valueMin: values.min,
    valueMax: values.max,
  }
}
