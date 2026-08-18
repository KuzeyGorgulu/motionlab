import { formatAnalysisNumber } from '../../analysis/format'
import { kinematicsForSample } from '../../analysis/kinematics'
import type {
  KinematicSample,
  TrackKinematics,
  VectorQuantity,
} from '../../analysis/types'
import type { Track, TrackSample } from '../../tracking/types'
import { formatTimestamp } from '../../video/timing'

interface KinematicsPanelProps {
  track: Track | null
  currentSample: TrackSample | null
  analysis: TrackKinematics | null
}

function formatted(value: number | null, unit: string): string {
  return value === null || !Number.isFinite(value)
    ? 'Unavailable'
    : `${formatAnalysisNumber(value)} ${unit}`
}

function vectorRows(
  vector: VectorQuantity | null,
  unit: string,
  labels: readonly [string, string, string],
) {
  return (
    <>
      <div><dt>{labels[0]}</dt><dd>{formatted(vector?.x ?? null, unit)}</dd></div>
      <div><dt>{labels[1]}</dt><dd>{formatted(vector?.y ?? null, unit)}</dd></div>
      <div><dt>{labels[2]}</dt><dd>{formatted(vector?.magnitude ?? null, unit)}</dd></div>
    </>
  )
}

function PositionSection({
  analysis,
  sample,
}: {
  analysis: TrackKinematics
  sample: KinematicSample
}) {
  return (
    <div className="kinematics-group">
      <h3>Position</h3>
      <dl className="kinematics-values">
        <div><dt>Timestamp</dt><dd>{formatTimestamp(sample.source.time)}</dd></div>
        <div>
          <dt>Native</dt>
          <dd>{sample.source.nativePosition.x.toFixed(1)}, {sample.source.nativePosition.y.toFixed(1)} px</dd>
        </div>
        <div><dt>x</dt><dd>{formatted(sample.position.x, analysis.positionUnit)}</dd></div>
        <div><dt>y</dt><dd>{formatted(sample.position.y, analysis.positionUnit)}</dd></div>
        <div><dt>|r|</dt><dd>{formatted(sample.positionMagnitude, analysis.positionUnit)}</dd></div>
      </dl>
    </div>
  )
}

function MotionSection({
  analysis,
  sample,
}: {
  analysis: TrackKinematics
  sample: KinematicSample
}) {
  const displacement = sample.displacementFromPrevious
  return (
    <>
      <div className="kinematics-group">
        <h3>Displacement & distance</h3>
        <dl className="kinematics-values">
          {vectorRows(
            displacement,
            analysis.positionUnit,
            ['Δx', 'Δy', '|Δr|'],
          )}
          <div>
            <dt>Path total</dt>
            <dd>{formatted(sample.cumulativeDistance, analysis.positionUnit)}</dd>
          </div>
        </dl>
        {displacement === null && (
          <p className="kinematics-unavailable">No valid previous interval for this sample.</p>
        )}
      </div>

      <div className="kinematics-group">
        <h3>Velocity</h3>
        <dl className="kinematics-values">
          {vectorRows(sample.velocity, analysis.velocityUnit, ['vx', 'vy', 'Speed'])}
        </dl>
        {sample.velocity === null && (
          <p className="kinematics-unavailable">At least two valid time-spaced samples are required.</p>
        )}
      </div>

      <div className="kinematics-group">
        <h3>Acceleration</h3>
        <dl className="kinematics-values">
          {vectorRows(sample.acceleration, analysis.accelerationUnit, ['ax', 'ay', '|a|'])}
        </dl>
        {sample.acceleration === null && (
          <p className="kinematics-unavailable">Unavailable at endpoints or without valid neighboring velocity samples.</p>
        )}
      </div>
    </>
  )
}

export function KinematicsPanel({
  track,
  currentSample,
  analysis,
}: KinematicsPanelProps) {
  const sample =
    analysis === null
      ? null
      : kinematicsForSample(analysis, currentSample?.id ?? null)
  const positionUnit = analysis?.positionUnit ?? 'px'

  return (
    <section className="inspector__section kinematics-panel">
      <div className="inspector__heading-row">
        <h2>Numerical inspector</h2>
        <span className={analysis?.space === 'world' ? 'analysis-space analysis-space--world' : 'analysis-space'}>
          {analysis?.space ?? 'idle'}
        </span>
      </div>

      {track === null || analysis === null ? (
        <p className="kinematics-empty">Create and select a track to analyze its motion.</p>
      ) : track.samples.length === 0 ? (
        <p className="kinematics-empty">Mark the first sample to begin position analysis.</p>
      ) : (
        <>
          <div className="kinematics-track-title">
            <span className="track-color" style={{ backgroundColor: track.color }} />
            <strong>{track.name}</strong>
            <small>{analysis.samples.length} valid samples · {positionUnit}</small>
          </div>

          {sample === null ? (
            <p className="kinematics-current-empty">
              Seek to a tracked timestamp or select a point in the Analysis panel.
            </p>
          ) : (
            <div className="kinematics-current">
              <PositionSection analysis={analysis} sample={sample} />
              <MotionSection analysis={analysis} sample={sample} />
            </div>
          )}

        </>
      )}
    </section>
  )
}
