import { createChartLayout, markerRadiusForSampleCount } from '../analysis/chart'
import { formatAnalysisNumber } from '../analysis/format'
import type { MarkerShape, VisualizationGroup } from '../analysis/types'

const WIDTH = 1200
const CHART_HEIGHT = 600
const TITLE_HEIGHT = 64
const HEIGHT = CHART_HEIGHT + TITLE_HEIGHT
const GRID_STEPS = 4
const SECONDARY_COLOR = '#7aa7ff'
const MAGNITUDE_COLOR = '#f0b86c'
const DIAGNOSTIC_COLOR = '#d9b36c'

export type GraphSvgResult =
  | { ok: true; svg: string }
  | { ok: false; message: string }

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function colorForSeries(index: number, trackColor: string): string {
  if (index === 0) return trackColor
  return index === 1 ? SECONDARY_COLOR : MAGNITUDE_COLOR
}

function marker(
  shape: MarkerShape,
  x: number,
  y: number,
  radius: number,
  color: string,
  hollow = false,
  potentialOutlier = false,
): string {
  const safeColor = escapeXml(color)
  const fill = hollow ? 'none' : safeColor
  const stroke = hollow ? ` stroke="${safeColor}" stroke-width="1.5"` : ''
  const shapeMarkup = shape === 'circle'
    ? `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"${stroke}/>`
    : shape === 'square'
      ? `<rect x="${x - radius}" y="${y - radius}" width="${radius * 2}" height="${radius * 2}" fill="${fill}"${stroke}/>`
      : `<path d="M ${x} ${y - radius} L ${x + radius} ${y} L ${x} ${y + radius} L ${x - radius} ${y} Z" fill="${fill}"${stroke}/>`
  return potentialOutlier
    ? `${shapeMarkup}<circle cx="${x}" cy="${y}" r="${radius + 7}" fill="none" stroke="${DIAGNOSTIC_COLOR}" stroke-width="2" stroke-dasharray="3 3"/>`
    : shapeMarkup
}

function polyline(
  points: readonly { x: number; y: number }[],
  color: string,
  dash: string | null,
): string {
  const coordinates = points
    .map((point) => `${point.x},${point.y}`)
    .join(' ')
  return `<polyline points="${coordinates}" fill="none" stroke="${escapeXml(color)}" stroke-width="1.7"${dash === null ? '' : ` stroke-dasharray="${dash}"`}/>`
}

export function createGraphSvg(
  group: VisualizationGroup,
  trackName: string,
  trackColor: string,
): GraphSvgResult {
  const allSeries = [
    ...group.measuredSeries,
    ...group.series,
    ...group.modelSeries,
  ]
  const layout = createChartLayout(allSeries, group.timeline, WIDTH, CHART_HEIGHT)
  if (layout === null) {
    return {
      ok: false,
      message: `The current ${group.label.toLowerCase()} graph has no available values to export.`,
    }
  }
  const horizontalGrid = Array.from({ length: GRID_STEPS + 1 }, (_, index) => {
    const ratio = index / GRID_STEPS
    return {
      y: layout.plot.top + ratio * (layout.plot.bottom - layout.plot.top),
      value: layout.valueMax - ratio * (layout.valueMax - layout.valueMin),
    }
  })
  const verticalGrid = Array.from({ length: GRID_STEPS + 1 }, (_, index) => {
    const ratio = index / GRID_STEPS
    return {
      x: layout.plot.left + ratio * (layout.plot.right - layout.plot.left),
      time: layout.timeMin + ratio * (layout.timeMax - layout.timeMin),
    }
  })
  const markerSize = markerRadiusForSampleCount(
    Math.max(0, ...group.series.map((series) => series.points.length)),
  )
  const analysisOffset = group.measuredSeries.length
  const modelOffset = analysisOffset + group.series.length
  const signedResidual = group.mode === 'residual-x' || group.mode === 'residual-y'
  const zeroY = signedResidual && layout.valueMin <= 0 && layout.valueMax >= 0
    ? layout.plot.bottom -
      ((0 - layout.valueMin) / (layout.valueMax - layout.valueMin)) *
        (layout.plot.bottom - layout.plot.top)
    : null
  const chart = [
    ...horizontalGrid.flatMap(({ y, value }) => [
      `<line x1="${layout.plot.left}" x2="${layout.plot.right}" y1="${y}" y2="${y}" stroke="#29343b"/>`,
      `<text x="${layout.plot.left - 12}" y="${y + 4}" text-anchor="end" fill="#829098" font-size="12">${escapeXml(formatAnalysisNumber(value))}</text>`,
    ]),
    ...verticalGrid.flatMap(({ x, time }) => [
      `<line x1="${x}" x2="${x}" y1="${layout.plot.top}" y2="${layout.plot.bottom}" stroke="#29343b"/>`,
      `<text x="${x}" y="${layout.plot.bottom + 24}" text-anchor="middle" fill="#829098" font-size="12">${escapeXml(formatAnalysisNumber(Math.max(0, time)))}</text>`,
    ]),
    ...(zeroY === null
      ? []
      : [`<line data-role="zero-baseline" x1="${layout.plot.left}" x2="${layout.plot.right}" y1="${zeroY}" y2="${zeroY}" stroke="#718087" stroke-width="1.5"/>`]),
    `<line x1="${layout.plot.left}" x2="${layout.plot.right}" y1="${layout.plot.bottom}" y2="${layout.plot.bottom}" stroke="#9aa7ae"/>`,
    `<line x1="${layout.plot.left}" x2="${layout.plot.left}" y1="${layout.plot.top}" y2="${layout.plot.bottom}" stroke="#9aa7ae"/>`,
    `<text x="${WIDTH / 2}" y="${CHART_HEIGHT - 10}" text-anchor="middle" fill="#c4cdd2" font-size="14">Time (s)</text>`,
    `<text transform="translate(20 ${(layout.plot.top + layout.plot.bottom) / 2}) rotate(-90)" text-anchor="middle" fill="#c4cdd2" font-size="14">${escapeXml(`${group.axisLabel} (${group.unit})`)}</text>`,
    ...group.measuredSeries.flatMap((series, index) => {
      const color = colorForSeries(index, trackColor)
      return (layout.series[index]?.points ?? []).map((point) =>
          marker(series.marker, point.x, point.y, markerSize, color, true, point.potentialOutlier === true),
      )
    }),
    ...group.series.flatMap((series, index) => {
      const color = colorForSeries(index, trackColor)
      const points = layout.series[analysisOffset + index]?.points ?? []
      return [
        ...(group.kind === 'motion' && group.analysisSource === 'smoothed' && points.length > 1
          ? [polyline(points, color, null)]
          : []),
        ...points.map((point) =>
          marker(series.marker, point.x, point.y, markerSize, color, false, point.potentialOutlier === true),
        ),
      ]
    }),
    ...group.modelSeries.flatMap((_, index) => {
      const points = layout.series[modelOffset + index]?.points ?? []
      return points.length > 0
        ? [polyline(points, colorForSeries(index, trackColor), '8 6')]
        : []
    }),
  ].join('')
  const seriesLegend = group.series.map((series, index) => {
    const x = 76 + index * 145
    const color = colorForSeries(index, trackColor)
    return `<circle cx="${x}" cy="52" r="5" fill="${escapeXml(color)}"/><text x="${x + 11}" y="56" fill="#aeb9bf" font-size="12">${escapeXml(series.label)}</text>`
  }).join('')
  const layerLabels = [
    ...(group.kind === 'motion' && group.analysisSource === 'smoothed' ? ['Measured', 'Smoothed'] : []),
    ...(group.kind === 'motion' && group.modelType !== 'none' ? ['Model fit'] : []),
    ...(group.kind === 'residuals' && group.series.some((series) =>
      series.points.some((point) => point.potentialOutlier === true))
      ? ['Potential outlier']
      : []),
  ]
  const layerLegend = layerLabels.map((label, index) => {
    const x = 520 + index * 125
    const sample = label === 'Measured'
      ? `<circle cx="${x}" cy="52" r="5" fill="none" stroke="#8d9aa1"/>`
      : label === 'Potential outlier'
        ? `<circle cx="${x}" cy="52" r="7" fill="none" stroke="${DIAGNOSTIC_COLOR}" stroke-width="2" stroke-dasharray="3 3"/>`
      : `<line x1="${x - 5}" x2="${x + 7}" y1="52" y2="52" stroke="#8d9aa1" stroke-width="2"${label === 'Model fit' ? ' stroke-dasharray="5 4"' : ''}/>`
    return `${sample}<text x="${x + 14}" y="56" fill="#aeb9bf" font-size="12">${label}</text>`
  }).join('')
  return {
    ok: true,
    svg: `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(`${trackName} ${group.label} graph`)}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#0c1114"/><text x="76" y="30" fill="#e2e9ec" font-size="20" font-family="system-ui, sans-serif">${escapeXml(`${trackName} — ${group.label}`)}</text>${seriesLegend}${layerLegend}<g transform="translate(0 ${TITLE_HEIGHT})" font-family="system-ui, sans-serif">${chart}</g></svg>\n`,
  }
}
