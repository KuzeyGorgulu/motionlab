import { formatAnalysisNumber } from '../../analysis/format'
import { createReportGraphSvg } from '../../export/reportHtml'
import {
  REPORT_GRAPH_TYPES,
  type ExperimentReport,
  type ReportGraphType,
  type ReportMetadata,
  type ReportProjectState,
  type ReportTrack,
} from '../../report/types'
import type { Track } from '../../tracking/types'
import { formatTimestamp } from '../../video/timing'

interface ReportWorkspaceProps {
  report: ExperimentReport
  reportState: ReportProjectState
  tracks: readonly Track[]
  onBack: () => void
  onExportHtml: () => void
  onReportStateChange: (state: ReportProjectState) => void
}

const GRAPH_LABELS: Record<ReportGraphType, string> = {
  'position-x': 'Position X vs Time',
  'position-y': 'Position Y vs Time',
  speed: 'Speed vs Time',
  'acceleration-magnitude': 'Acceleration Magnitude vs Time',
  'observed-vs-fitted': 'Observed vs Fitted Motion',
  'residual-magnitude': 'Residual Magnitude vs Time',
  'residual-x': 'X Residual vs Time',
  'residual-y': 'Y Residual vs Time',
}

function value(number: number | null, unit = ''): string {
  return number === null || !Number.isFinite(number)
    ? '—'
    : `${formatAnalysisNumber(number)}${unit === '' ? '' : ` ${unit}`}`
}

function vector(
  quantity: { x: number; y: number; magnitude: number } | null,
  unit: string,
): string {
  return quantity === null
    ? '—'
    : `(${value(quantity.x, unit)}, ${value(quantity.y, unit)}) · |r| ${value(quantity.magnitude, unit)}`
}

function MetadataEditor({
  metadata,
  onChange,
}: {
  metadata: ReportMetadata
  onChange: (metadata: ReportMetadata) => void
}) {
  const field = (key: keyof ReportMetadata, nextValue: string) => {
    onChange({ ...metadata, [key]: nextValue })
  }
  return (
    <fieldset className="report-config__group">
      <legend>Experiment metadata</legend>
      <label>Experiment title<input maxLength={240} onChange={(event) => field('title', event.target.value)} value={metadata.title} /></label>
      <label>Author<input maxLength={160} onChange={(event) => field('author', event.target.value)} value={metadata.author} /></label>
      <label>Date<input maxLength={40} onChange={(event) => field('date', event.target.value)} type="date" value={metadata.date} /></label>
      <label>Course / class<input maxLength={160} onChange={(event) => field('course', event.target.value)} value={metadata.course} /></label>
      <label>Instructor<input maxLength={160} onChange={(event) => field('instructor', event.target.value)} value={metadata.instructor} /></label>
      <label>Short description<textarea maxLength={4000} onChange={(event) => field('description', event.target.value)} rows={4} value={metadata.description} /></label>
      <label>Discussion / Notes<textarea maxLength={20000} onChange={(event) => field('notes', event.target.value)} rows={7} value={metadata.notes} /></label>
      <small>Interpretation remains yours; MotionLab does not generate scientific conclusions.</small>
    </fieldset>
  )
}

function ReportConfiguration({
  reportState,
  tracks,
  onChange,
}: {
  reportState: ReportProjectState
  tracks: readonly Track[]
  onChange: (state: ReportProjectState) => void
}) {
  const preferences = reportState.preferences
  const toggleListValue = <T extends string>(
    values: readonly T[],
    item: T,
    included: boolean,
  ): T[] => included
    ? [...values.filter((value) => value !== item), item]
    : values.filter((value) => value !== item)
  const updatePreferences = (
    next: Partial<ReportProjectState['preferences']>,
  ) => onChange({
    ...reportState,
    preferences: { ...preferences, ...next },
  })

  return (
    <aside className="report-config" aria-label="Report configuration">
      <MetadataEditor
        metadata={reportState.metadata}
        onChange={(metadata) => onChange({ ...reportState, metadata })}
      />
      <fieldset className="report-config__group">
        <legend>Included tracks</legend>
        {tracks.length === 0 ? (
          <p>No tracks are available yet.</p>
        ) : tracks.map((track) => {
          const included = !preferences.excludedTrackIds.includes(track.id)
          return (
            <label className="report-check" key={track.id}>
              <input
                checked={included}
                onChange={(event) => updatePreferences({
                  excludedTrackIds: toggleListValue(
                    preferences.excludedTrackIds,
                    track.id,
                    !event.target.checked,
                  ),
                })}
                type="checkbox"
              />
              <span className="track-color" style={{ backgroundColor: track.color }} />
              {track.name}
            </label>
          )
        })}
      </fieldset>
      <fieldset className="report-config__group">
        <legend>Included graphs</legend>
        {REPORT_GRAPH_TYPES.map((type) => (
          <label className="report-check" key={type}>
            <input
              checked={preferences.includedGraphs.includes(type)}
              onChange={(event) => updatePreferences({
                includedGraphs: REPORT_GRAPH_TYPES.filter((candidate) =>
                  candidate === type
                    ? event.target.checked
                    : preferences.includedGraphs.includes(candidate)),
              })}
              type="checkbox"
            />
            {GRAPH_LABELS[type]}
          </label>
        ))}
        <small>Fit and residual graphs appear only when the selected model is available for a track.</small>
      </fieldset>
      <fieldset className="report-config__group">
        <legend>Observation tables</legend>
        {tracks.length === 0 ? (
          <p>No tracks are available yet.</p>
        ) : tracks.map((track) => (
          <label className="report-check" key={track.id}>
            <input
              checked={preferences.observationTableTrackIds.includes(track.id)}
              onChange={(event) => updatePreferences({
                observationTableTrackIds: toggleListValue(
                  preferences.observationTableTrackIds,
                  track.id,
                  event.target.checked,
                ),
              })}
              type="checkbox"
            />
            {track.name}
          </label>
        ))}
      </fieldset>
    </aside>
  )
}

function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="report-facts">
      {rows.map(([label, content]) => (
        <div key={label}><dt>{label}</dt><dd>{content}</dd></div>
      ))}
    </dl>
  )
}

function MeasurementSummary({ track }: { track: ReportTrack }) {
  const summary = track.measurementSummary
  return (
    <section className="report-subsection">
      <h3>Measurement Summary</h3>
      <Facts rows={[
        ['Initial position', vector(summary.initialPosition, track.positionUnit)],
        ['Final position', vector(summary.finalPosition, track.positionUnit)],
        ['Displacement', vector(summary.displacement, track.positionUnit)],
        ['Total path distance', value(summary.totalPathDistance, track.positionUnit)],
        ['Average velocity X', value(summary.averageVelocityX, track.velocityUnit)],
        ['Average velocity Y', value(summary.averageVelocityY, track.velocityUnit)],
        ['Average speed', value(summary.averageSpeed, track.velocityUnit)],
        ['Maximum speed', value(summary.maximumSpeed, track.velocityUnit)],
        ['Maximum acceleration', value(summary.maximumAccelerationMagnitude, track.accelerationUnit)],
      ]} />
    </section>
  )
}

function ModelFitSummary({ track }: { track: ReportTrack }) {
  const fit = track.modelFit
  if (fit === null) return null
  return (
    <section className="report-subsection">
      <h3>Model Fit</h3>
      <p className="report-model-name"><strong>{fit.name}</strong></p>
      <div className="report-equations">
        <code>{fit.equations[0]}</code><code>{fit.equations[1]}</code>
      </div>
      <Facts rows={[
        ...fit.parameters.map((parameter): [string, string] => [
          parameter.label,
          value(parameter.value, parameter.unit),
        ]),
        ['Samples', String(fit.sampleCount)],
        ['Analyzed span', value(fit.timeSpan, 's')],
        ['R² X', value(fit.rSquaredX)],
        ['R² Y', value(fit.rSquaredY)],
        ['RMSE', value(fit.rmse, track.positionUnit)],
        ['Spatial MAE', value(fit.mae, track.positionUnit)],
        ['Maximum deviation', value(fit.maximumDeviation, track.positionUnit)],
        ['Mean X residual', value(fit.meanResidualX, track.positionUnit)],
        ['Mean Y residual', value(fit.meanResidualY, track.positionUnit)],
      ]} />
    </section>
  )
}

function PotentialDeviations({ track }: { track: ReportTrack }) {
  if (track.potentialDeviations.length === 0) return null
  return (
    <section className="report-subsection">
      <h3>Potential Deviations</h3>
      <p className="report-caution">
        Potential deviations detected statistically. They are not automatically classified as measurement errors.
      </p>
      <div className="report-table-scroll">
        <table className="report-table">
          <thead><tr><th>Time</th><th>|Residual|</th><th>Residual X</th><th>Residual Y</th></tr></thead>
          <tbody>{track.potentialDeviations.map((deviation) => (
            <tr key={deviation.sampleId}>
              <td>{formatTimestamp(deviation.time)}</td>
              <td>{value(deviation.residualMagnitude, track.positionUnit)}</td>
              <td>{value(deviation.residualX, track.positionUnit)}</td>
              <td>{value(deviation.residualY, track.positionUnit)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  )
}

function ReportGraphs({ track }: { track: ReportTrack }) {
  const graphs = track.graphs.flatMap((graph) => {
    const svg = createReportGraphSvg(graph, track)
    return svg === null ? [] : [{ graph, svg }]
  })
  if (graphs.length === 0) return null
  return (
    <section className="report-subsection report-graphs">
      <h3>Graphs</h3>
      {graphs.map(({ graph, svg }) => (
        <figure key={graph.type}>
          <figcaption>{graph.title}</figcaption>
          <div aria-label={`${track.name} ${graph.title} graph`} dangerouslySetInnerHTML={{ __html: svg }} />
        </figure>
      ))}
    </section>
  )
}

function ObservationTable({ track }: { track: ReportTrack }) {
  if (!track.includeObservationTable) return null
  const withFit = track.modelFit !== null
  return (
    <section className="report-subsection report-observations">
      <h3>Observations</h3>
      <p>Position {track.positionUnit} · Velocity {track.velocityUnit} · Acceleration {track.accelerationUnit}</p>
      <div className="report-table-scroll">
        <table className="report-table">
          <thead><tr><th>Time (s)</th><th>X</th><th>Y</th><th>vx</th><th>vy</th><th>Speed</th><th>ax</th><th>ay</th><th>|a|</th>{withFit && <><th>Pred. X</th><th>Pred. Y</th><th>Residual X</th><th>Residual Y</th><th>|Residual|</th></>}</tr></thead>
          <tbody>{track.observations.map((observation) => (
            <tr key={observation.sampleId}>
              <td>{value(observation.time)}</td><td>{value(observation.x)}</td><td>{value(observation.y)}</td><td>{value(observation.vx)}</td><td>{value(observation.vy)}</td><td>{value(observation.speed)}</td><td>{value(observation.ax)}</td><td>{value(observation.ay)}</td><td>{value(observation.accelerationMagnitude)}</td>
              {withFit && <><td>{value(observation.predictedX)}</td><td>{value(observation.predictedY)}</td><td>{value(observation.residualX)}</td><td>{value(observation.residualY)}</td><td>{value(observation.residualMagnitude)}</td></>}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  )
}

function ReportDocument({ report }: { report: ExperimentReport }) {
  const course = [report.metadata.course, report.metadata.instructor]
    .filter((item) => item.trim() !== '').join(' · ')
  const calibration = report.calibration
  return (
    <article className="report-document" aria-label="Experiment report">
      <header className="report-document__header">
        <p className="report-document__brand">MotionLab · Experiment Report</p>
        <h1>{report.displayTitle}</h1>
        <div className="report-document__byline">
          {report.metadata.author.trim() !== '' && <span>{report.metadata.author}</span>}
          {report.metadata.date.trim() !== '' && <span>{report.metadata.date}</span>}
          {course !== '' && <span>{course}</span>}
        </div>
      </header>

      {report.metadata.description.trim() !== '' && (
        <section className="report-section"><h2>Description</h2><p className="report-prose">{report.metadata.description}</p></section>
      )}

      <section className="report-section">
        <h2>Experiment Information</h2>
        <Facts rows={[
          ['Video filename', report.video.filename || '—'],
          ['Video duration', value(report.video.duration, 's')],
          ['Video resolution', report.video.width === null || report.video.height === null ? '—' : `${report.video.width} × ${report.video.height} px`],
          ['Calibration', calibration.calibrated ? 'Calibrated' : 'Not calibrated'],
          ['Spatial unit', calibration.unit],
          ['Coordinate origin', calibration.origin === null ? 'Native video coordinates' : `${value(calibration.origin.x, 'px')}, ${value(calibration.origin.y, 'px')} (${calibration.originSource === 'custom' ? 'custom' : 'reference A'})`],
          ['X-axis orientation', calibration.xAxis === null ? 'Video right (+X), video down (+Y)' : `(${value(calibration.xAxis.x)}, ${value(calibration.xAxis.y)}) in video coordinates`],
          ['Analysis time range', report.analysisTimeRange === null ? '—' : `${value(report.analysisTimeRange.start, 's')} to ${value(report.analysisTimeRange.end, 's')}`],
        ]} />
      </section>

      <section className="report-section">
        <h2>Tracks</h2>
        {report.tracks.length === 0 ? (
          <p className="report-empty">No tracks are included in this report.</p>
        ) : report.tracks.map((track) => (
          <article className="report-track" key={track.id}>
            <header>
              <span className="track-color" style={{ backgroundColor: track.color }} />
              <div>
                <h2>{track.name}</h2>
                <p>{track.observationCount} observations · {track.markerCount} markers · first {value(track.firstObservationTime, 's')} · last {value(track.lastObservationTime, 's')} · span {value(track.trackedDuration, 's')}</p>
              </div>
            </header>
            {track.analysisAvailable
              ? <MeasurementSummary track={track} />
              : <p className="report-empty">{track.analysisUnavailableReason}</p>}
            <ModelFitSummary track={track} />
            <PotentialDeviations track={track} />
            <ReportGraphs track={track} />
            <ObservationTable track={track} />
          </article>
        ))}
      </section>

      {report.metadata.notes.trim() !== '' && (
        <section className="report-section"><h2>Discussion / Notes</h2><p className="report-prose">{report.metadata.notes}</p></section>
      )}

      <section className="report-section report-provenance">
        <h2>Analysis Information</h2>
        <Facts rows={[
          ['MotionLab version', report.provenance.motionLabVersion],
          ['Report schema version', String(report.provenance.reportSchemaVersion)],
          ['Analysis source', report.provenance.analysisSource.type === 'raw' ? 'Raw observations' : `Smoothed (${report.provenance.analysisSource.windowSize}-sample window)`],
          ['Calibration unit', report.provenance.calibrationUnit],
          ['Calibration scale', value(report.provenance.calibrationScale, `${report.provenance.calibrationUnit}/px`)],
          ['Analyzed tracks', String(report.provenance.analyzedTrackCount)],
          ['Report generated', report.provenance.generatedAt],
          ['Source video', report.provenance.sourceVideoFilename],
        ]} />
        <p className="report-provenance__note">Measurements were derived from video-based tracking and may be affected by calibration, perspective, frame rate, tracking accuracy, and manual annotation error.</p>
      </section>
    </article>
  )
}

export function ReportWorkspace({
  report,
  reportState,
  tracks,
  onBack,
  onExportHtml,
  onReportStateChange,
}: ReportWorkspaceProps) {
  return (
    <section className="report-workspace">
      <header className="report-toolbar">
        <div><span>Report workspace</span><strong>{report.displayTitle}</strong></div>
        <div className="report-toolbar__actions">
          <button className="button button--secondary" onClick={onBack} type="button">Back to analysis</button>
          <button className="button button--secondary" onClick={() => window.print()} type="button">Print / Save PDF</button>
          <button className="button button--primary" onClick={onExportHtml} type="button">Export Report · HTML</button>
        </div>
      </header>
      <div className="report-layout">
        <ReportConfiguration
          onChange={onReportStateChange}
          reportState={reportState}
          tracks={tracks}
        />
        <ReportDocument report={report} />
      </div>
    </section>
  )
}
