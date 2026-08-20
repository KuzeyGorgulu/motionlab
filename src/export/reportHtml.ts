import { formatAnalysisNumber } from '../analysis/format'
import type { ReportGraph, ReportTrack, ExperimentReport } from '../report/types'
import { createGraphSvg } from './graphSvg'

export type ReportHtmlResult =
  | { ok: true; html: string }
  | { ok: false; message: string }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function multiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

function formatted(value: number | null, unit = ''): string {
  return value === null || !Number.isFinite(value)
    ? '—'
    : `${formatAnalysisNumber(value)}${unit === '' ? '' : ` ${escapeHtml(unit)}`}`
}

function vector(
  value: { x: number; y: number; magnitude: number } | null,
  unit: string,
): string {
  return value === null
    ? '—'
    : `(${formatted(value.x, unit)}, ${formatted(value.y, unit)}), |r| ${formatted(value.magnitude, unit)}`
}

function toLightGraph(svg: string): string {
  return svg
    .replace(/^<\?xml[^>]+>\s*/, '')
    .replaceAll('#0c1114', '#ffffff')
    .replaceAll('#29343b', '#dce3e7')
    .replaceAll('#829098', '#52616a')
    .replaceAll('#9aa7ae', '#687780')
    .replaceAll('#c4cdd2', '#1f2a30')
    .replaceAll('#e2e9ec', '#10191e')
    .replaceAll('#aeb9bf', '#42515a')
    .replaceAll('#8d9aa1', '#687780')
}

export function createReportGraphSvg(
  graph: ReportGraph,
  track: Pick<ReportTrack, 'name' | 'color'>,
): string | null {
  const result = createGraphSvg(graph.group, track.name, track.color)
  return result.ok ? toLightGraph(result.svg) : null
}

function measurementRows(track: ReportTrack): string {
  const summary = track.measurementSummary
  const rows: Array<[string, string]> = [
    ['Initial position', vector(summary.initialPosition, track.positionUnit)],
    ['Final position', vector(summary.finalPosition, track.positionUnit)],
    ['Displacement', vector(summary.displacement, track.positionUnit)],
    ['Total path distance', formatted(summary.totalPathDistance, track.positionUnit)],
    ['Average velocity X', formatted(summary.averageVelocityX, track.velocityUnit)],
    ['Average velocity Y', formatted(summary.averageVelocityY, track.velocityUnit)],
    ['Average speed', formatted(summary.averageSpeed, track.velocityUnit)],
    ['Maximum speed', formatted(summary.maximumSpeed, track.velocityUnit)],
    ['Maximum acceleration', formatted(summary.maximumAccelerationMagnitude, track.accelerationUnit)],
  ]
  return rows.map(([label, value]) =>
    `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')
}

function modelSection(track: ReportTrack): string {
  const fit = track.modelFit
  if (fit === null) return ''
  const parameters = fit.parameters.map((parameter) =>
    `<div><dt>${escapeHtml(parameter.label)}</dt><dd>${formatted(parameter.value, parameter.unit)}</dd></div>`,
  ).join('')
  return `<section class="subsection"><h3>Model Fit</h3><p><strong>${escapeHtml(fit.name)}</strong></p><div class="equations"><code>${escapeHtml(fit.equations[0])}</code><code>${escapeHtml(fit.equations[1])}</code></div><dl class="facts">${parameters}<div><dt>Samples</dt><dd>${fit.sampleCount}</dd></div><div><dt>Analyzed span</dt><dd>${formatted(fit.timeSpan, 's')}</dd></div><div><dt>R² X</dt><dd>${formatted(fit.rSquaredX)}</dd></div><div><dt>R² Y</dt><dd>${formatted(fit.rSquaredY)}</dd></div><div><dt>RMSE</dt><dd>${formatted(fit.rmse, track.positionUnit)}</dd></div><div><dt>Spatial MAE</dt><dd>${formatted(fit.mae, track.positionUnit)}</dd></div><div><dt>Maximum deviation</dt><dd>${formatted(fit.maximumDeviation, track.positionUnit)}</dd></div><div><dt>Mean X residual</dt><dd>${formatted(fit.meanResidualX, track.positionUnit)}</dd></div><div><dt>Mean Y residual</dt><dd>${formatted(fit.meanResidualY, track.positionUnit)}</dd></div></dl></section>`
}

function deviationSection(track: ReportTrack): string {
  if (track.potentialDeviations.length === 0) return ''
  const rows = track.potentialDeviations.map((item) =>
    `<tr><td>${formatted(item.time, 's')}</td><td>${formatted(item.residualMagnitude, track.positionUnit)}</td><td>${formatted(item.residualX, track.positionUnit)}</td><td>${formatted(item.residualY, track.positionUnit)}</td></tr>`,
  ).join('')
  return `<section class="subsection"><h3>Potential Deviations</h3><p class="caution">Potential deviations detected statistically. They are not automatically classified as measurement errors.</p><table><thead><tr><th>Time</th><th>|Residual|</th><th>Residual X</th><th>Residual Y</th></tr></thead><tbody>${rows}</tbody></table></section>`
}

function graphSection(track: ReportTrack): string {
  const graphs = track.graphs.flatMap((graph) => {
    const svg = createReportGraphSvg(graph, track)
    return svg === null
      ? []
      : [`<figure><figcaption>${escapeHtml(graph.title)}</figcaption>${svg}</figure>`]
  })
  return graphs.length === 0
    ? ''
    : `<section class="subsection report-graphs"><h3>Graphs</h3>${graphs.join('')}</section>`
}

function observationSection(track: ReportTrack): string {
  if (!track.includeObservationTable) return ''
  const withFit = track.modelFit !== null
  const rows = track.observations.map((item) => `<tr><td>${formatted(item.time)}</td><td>${formatted(item.x)}</td><td>${formatted(item.y)}</td><td>${formatted(item.vx)}</td><td>${formatted(item.vy)}</td><td>${formatted(item.speed)}</td><td>${formatted(item.ax)}</td><td>${formatted(item.ay)}</td><td>${formatted(item.accelerationMagnitude)}</td>${withFit ? `<td>${formatted(item.predictedX)}</td><td>${formatted(item.predictedY)}</td><td>${formatted(item.residualX)}</td><td>${formatted(item.residualY)}</td><td>${formatted(item.residualMagnitude)}</td>` : ''}</tr>`).join('')
  return `<section class="subsection observation-table"><h3>Observations</h3><p class="units">Position ${escapeHtml(track.positionUnit)} · Velocity ${escapeHtml(track.velocityUnit)} · Acceleration ${escapeHtml(track.accelerationUnit)}</p><table><thead><tr><th>Time (s)</th><th>X</th><th>Y</th><th>vx</th><th>vy</th><th>Speed</th><th>ax</th><th>ay</th><th>|a|</th>${withFit ? '<th>Pred. X</th><th>Pred. Y</th><th>Residual X</th><th>Residual Y</th><th>|Residual|</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></section>`
}

function trackSection(track: ReportTrack): string {
  return `<article class="track"><header><span class="track-color" style="background:${escapeHtml(track.color)}"></span><div><h2>${escapeHtml(track.name)}</h2><p>${track.observationCount} observations · ${track.markerCount} markers · first ${formatted(track.firstObservationTime, 's')} · last ${formatted(track.lastObservationTime, 's')} · span ${formatted(track.trackedDuration, 's')}</p></div></header>${track.analysisAvailable ? `<section class="subsection"><h3>Measurement Summary</h3><dl class="facts">${measurementRows(track)}</dl></section>` : `<p class="empty">${escapeHtml(track.analysisUnavailableReason ?? 'Scientific analysis is unavailable for this track.')}</p>`}${modelSection(track)}${deviationSection(track)}${graphSection(track)}${observationSection(track)}</article>`
}

const REPORT_STYLES = `
  :root{color:#172126;background:#e7ecef;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px}*{box-sizing:border-box}body{margin:0;background:#e7ecef}main{width:min(1050px,calc(100% - 32px));margin:24px auto;padding:48px;background:#fff;box-shadow:0 8px 30px #26343d24}.report-header{padding-bottom:24px;border-bottom:3px solid #173c3a}.brand{margin:0 0 24px;color:#216b63;font-size:13px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.report-header h1{margin:0;color:#111a1f;font-size:32px}.byline{display:flex;gap:18px;flex-wrap:wrap;color:#536169}.section{margin-top:32px}.section>h2,.track>header h2{margin:0 0 14px;color:#173c3a}.facts{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#dfe5e8;border:1px solid #dfe5e8}.facts>div{padding:9px 11px;background:#fff}.facts dt{color:#66747c;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.facts dd{margin:4px 0 0;font-variant-numeric:tabular-nums}.track{margin-top:26px;padding-top:24px;border-top:2px solid #cfd9dd;break-inside:avoid-page}.track>header{display:flex;gap:10px;align-items:flex-start}.track>header p{margin:4px 0;color:#69767d}.track-color{width:9px;height:28px;display:block;border-radius:2px}.subsection{margin-top:22px}.subsection h3{margin:0 0 10px;color:#34444c;font-size:15px}.equations{display:grid;gap:5px;margin:10px 0}.equations code{padding:7px 9px;background:#f3f6f7}.caution,.empty{padding:10px 12px;border-left:3px solid #a87825;background:#faf7ef;color:#66573d}figure{margin:18px 0;break-inside:avoid-page}figcaption{margin-bottom:7px;font-weight:700}figure svg{width:100%;height:auto;display:block;border:1px solid #d8e0e3}table{width:100%;border-collapse:collapse;font-size:11px;font-variant-numeric:tabular-nums}th,td{padding:6px;border:1px solid #d8e0e3;text-align:right;white-space:nowrap}th{background:#eff3f5;color:#3c4c54}.observation-table{overflow-x:auto}.units{color:#66747c;font-size:11px}.notes{line-height:1.65}.provenance{color:#56656d}.provenance-note{margin-top:18px;padding-top:14px;border-top:1px solid #d8e0e3;line-height:1.55}@media(max-width:700px){main{width:100%;margin:0;padding:24px}.facts{grid-template-columns:1fr}}@media print{@page{margin:14mm}body{background:#fff}main{width:100%;margin:0;padding:0;box-shadow:none}figure,.track>header,.subsection h3{break-after:avoid}.track{break-inside:auto}.observation-table{overflow:visible}table{font-size:8px}th,td{padding:4px;white-space:normal}}
`

export function createExperimentReportHtml(report: ExperimentReport): ReportHtmlResult {
  const info: Array<[string, string]> = [
    ['Video', escapeHtml(report.video.filename || '—')],
    ['Duration', formatted(report.video.duration, 's')],
    ['Resolution', report.video.width === null || report.video.height === null ? '—' : `${report.video.width} × ${report.video.height} px`],
    ['Calibration', report.calibration.calibrated ? 'Calibrated' : 'Not calibrated'],
    ['Spatial unit', escapeHtml(report.calibration.unit)],
    ['Coordinate origin', report.calibration.origin === null ? 'Native video coordinates' : `${formatted(report.calibration.origin.x, 'px')}, ${formatted(report.calibration.origin.y, 'px')} (${report.calibration.originSource === 'custom' ? 'custom' : 'reference A'})`],
    ['X-axis orientation', report.calibration.xAxis === null ? 'Video right (+X), video down (+Y)' : `(${formatted(report.calibration.xAxis.x)}, ${formatted(report.calibration.xAxis.y)}) in video coordinates`],
    ['Analysis range', report.analysisTimeRange === null ? '—' : `${formatted(report.analysisTimeRange.start, 's')} to ${formatted(report.analysisTimeRange.end, 's')}`],
  ]
  const information = info.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')
  const course = [report.metadata.course, report.metadata.instructor]
    .filter((value) => value.trim() !== '')
    .map(escapeHtml)
    .join(' · ')
  const tracks = report.tracks.length === 0
    ? '<p class="empty">No tracks are included in this report.</p>'
    : report.tracks.map(trackSection).join('')
  const notes = report.metadata.notes.trim() === ''
    ? ''
    : `<section class="section notes"><h2>Discussion / Notes</h2><p>${multiline(report.metadata.notes)}</p></section>`
  const description = report.metadata.description.trim() === ''
    ? ''
    : `<section class="section notes"><h2>Description</h2><p>${multiline(report.metadata.description)}</p></section>`
  const provenance = report.provenance
  return {
    ok: true,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.displayTitle)} — MotionLab</title><style>${REPORT_STYLES}</style></head><body><main><header class="report-header"><p class="brand">MotionLab · Experiment Report</p><h1>${escapeHtml(report.displayTitle)}</h1><p class="byline">${report.metadata.author.trim() === '' ? '' : `<span>${escapeHtml(report.metadata.author)}</span>`}${report.metadata.date.trim() === '' ? '' : `<span>${escapeHtml(report.metadata.date)}</span>`}${course === '' ? '' : `<span>${course}</span>`}</p></header>${description}<section class="section"><h2>Experiment Information</h2><dl class="facts">${information}</dl></section><section class="section"><h2>Tracks</h2>${tracks}</section>${notes}<section class="section provenance"><h2>Analysis Information</h2><dl class="facts"><div><dt>MotionLab version</dt><dd>${escapeHtml(provenance.motionLabVersion)}</dd></div><div><dt>Report schema</dt><dd>${provenance.reportSchemaVersion}</dd></div><div><dt>Analysis source</dt><dd>${provenance.analysisSource.type === 'raw' ? 'Raw observations' : `Smoothed (${provenance.analysisSource.windowSize}-sample window)`}</dd></div><div><dt>Calibration unit</dt><dd>${escapeHtml(provenance.calibrationUnit)}</dd></div><div><dt>Calibration scale</dt><dd>${formatted(provenance.calibrationScale, `${provenance.calibrationUnit}/px`)}</dd></div><div><dt>Analyzed tracks</dt><dd>${provenance.analyzedTrackCount}</dd></div><div><dt>Generated</dt><dd>${escapeHtml(provenance.generatedAt)}</dd></div><div><dt>Source video</dt><dd>${escapeHtml(provenance.sourceVideoFilename)}</dd></div></dl><p class="provenance-note">Measurements were derived from video-based tracking and may be affected by calibration, perspective, frame rate, tracking accuracy, and manual annotation error.</p></section></main></body></html>\n`,
  }
}
