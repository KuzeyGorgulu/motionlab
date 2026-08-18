import type { ChartLayout, GraphDataPoint } from './types'

const DEFAULT_PADDING = { left: 76, top: 22, right: 24, bottom: 50 }

export function createChartLayout(
  sourcePoints: readonly GraphDataPoint[],
  width: number,
  height: number,
): ChartLayout | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 80 || height <= 60) {
    return null
  }

  const points = sourcePoints
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
    .sort((first, second) => first.time - second.time || first.sampleId.localeCompare(second.sampleId))
  if (points.length === 0) return null

  const rawTimeMin = points[0]!.time
  const rawTimeMax = points.at(-1)!.time
  const timePadding = rawTimeMin === rawTimeMax ? 0.5 : 0
  const timeMin = rawTimeMin - timePadding
  const timeMax = rawTimeMax + timePadding
  let rawValueMin = points[0]!.value
  let rawValueMax = rawValueMin
  for (const point of points) {
    rawValueMin = Math.min(rawValueMin, point.value)
    rawValueMax = Math.max(rawValueMax, point.value)
  }
  const valuePadding =
    rawValueMin === rawValueMax
      ? Math.max(Math.abs(rawValueMin) * 0.1, 1)
      : (rawValueMax - rawValueMin) * 0.08
  const valueMin = rawValueMin - valuePadding
  const valueMax = rawValueMax + valuePadding
  const plot = {
    left: DEFAULT_PADDING.left,
    top: DEFAULT_PADDING.top,
    right: width - DEFAULT_PADDING.right,
    bottom: height - DEFAULT_PADDING.bottom,
  }
  const timeSpan = timeMax - timeMin
  const valueSpan = valueMax - valueMin

  return {
    points: points.map((point) => ({
      ...point,
      x: plot.left + ((point.time - timeMin) / timeSpan) * (plot.right - plot.left),
      y: plot.bottom - ((point.value - valueMin) / valueSpan) * (plot.bottom - plot.top),
    })),
    plot,
    timeMin,
    timeMax,
    valueMin,
    valueMax,
  }
}
