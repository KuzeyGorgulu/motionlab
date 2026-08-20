import { formatAnalysisNumber } from '../../analysis/format'
import type {
  FitDiagnosticObservation,
  FitDiagnostics,
} from '../../analysis/fitDiagnostics'
import { kinematicsForSample } from '../../analysis/kinematics'
import type {
  AnalysisSource,
  KinematicSample,
  MotionModelFit,
  MotionModelFitResult,
  MotionModelType,
  TrackKinematics,
  VectorQuantity,
} from '../../analysis/types'
import type { Track, TrackSample } from '../../tracking/types'
import { formatTimestamp } from '../../video/timing'

interface KinematicsPanelProps {
  track: Track | null
  currentSample: TrackSample | null
  analysis: TrackKinematics | null
  analysisSource: AnalysisSource
  model: MotionModelType
  modelFitResult: MotionModelFitResult | null
  diagnostics: FitDiagnostics | null
  onSeekSample: (time: number) => void
}

function fitValue(value: number | null, unit = ''): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable'
  return `${formatAnalysisNumber(value)}${unit === '' ? '' : ` ${unit}`}`
}

function ModelFitSection({
  analysis,
  source,
  fit,
  diagnostics,
  currentSampleId,
  onSeekSample,
}: {
  analysis: TrackKinematics
  source: AnalysisSource
  fit: MotionModelFit
  diagnostics: FitDiagnostics
  currentSampleId: string | null
  onSeekSample: (time: number) => void
}) {
  const selected = diagnostics.observations.find(
    (observation) => observation.sampleId === currentSampleId,
  ) ?? null
  return (
    <div className="kinematics-group kinematics-model-fit" data-testid="model-fit-summary">
      <h3>Model fit</h3>
      <div className="kinematics-model-fit__identity">
        <strong>
          {fit.type === 'constant-velocity'
            ? 'Constant velocity fit'
            : 'Constant acceleration fit'}
        </strong>
        <span>Source: {source.type === 'raw' ? 'Raw observations' : 'Smoothed analysis'}</span>
      </div>
      <div className="fit-diagnostics">
        <h4>Fit diagnostics</h4>
        <dl className="kinematics-values kinematics-values--diagnostics">
          <div><dt>RMSE</dt><dd>{fitValue(diagnostics.summary.rmse, analysis.positionUnit)}</dd></div>
          <div><dt>MAE</dt><dd>{fitValue(diagnostics.summary.mae, analysis.positionUnit)}</dd></div>
          <div data-testid="fit-max-residual"><dt>Max deviation</dt><dd>{fitValue(diagnostics.summary.maximumResidualMagnitude, analysis.positionUnit)}</dd></div>
          <div><dt>R² X</dt><dd>{fitValue(diagnostics.summary.rSquaredX)}</dd></div>
          <div><dt>R² Y</dt><dd>{fitValue(diagnostics.summary.rSquaredY)}</dd></div>
          <div><dt>Samples</dt><dd>{diagnostics.summary.sampleCount}</dd></div>
          <div><dt>Time span</dt><dd>{fitValue(diagnostics.summary.timeSpan, 's')}</dd></div>
        </dl>
        <p className="fit-diagnostics__definition">
          MAE is the mean magnitude of position-space fit residuals.
        </p>
      </div>

      <div className="fit-deviations">
        <h4>Largest deviations</h4>
        <ol>
          {diagnostics.rankedObservations.slice(0, 5).map((observation, index) => (
            <li key={observation.sampleId}>
              <button
                aria-label={`Rank ${index + 1}, ${formatTimestamp(observation.time)}, fit residual ${formatAnalysisNumber(observation.residualMagnitude)} ${analysis.positionUnit}${observation.potentialOutlier ? ', potential outlier' : ''}. Seek video.`}
                aria-pressed={observation.sampleId === currentSampleId}
                className={observation.sampleId === currentSampleId ? 'fit-deviation fit-deviation--active' : 'fit-deviation'}
                onClick={() => onSeekSample(observation.time)}
                type="button"
              >
                <span>{index + 1}. {formatTimestamp(observation.time)}</span>
                <strong>{formatAnalysisNumber(observation.residualMagnitude)} {analysis.positionUnit}</strong>
                {observation.potentialOutlier && <small>Potential outlier</small>}
              </button>
            </li>
          ))}
        </ol>
        {diagnostics.observations.some((observation) => observation.potentialOutlier) && (
          <p className="fit-deviations__caution">
            A flagged observation deviates strongly from this model. Review the video before editing or deleting it; the model itself may be inappropriate.
          </p>
        )}
      </div>

      {selected !== null && (
        <SelectedFitObservation
          observation={selected}
          unit={analysis.positionUnit}
        />
      )}

      <details className="kinematics-fit-details">
        <summary>Model parameters and residual detail</summary>
        <dl className="kinematics-values">
          {fit.type === 'constant-velocity' ? (
            <>
              <div><dt>vx</dt><dd>{fitValue(fit.vx, analysis.velocityUnit)}</dd></div>
              <div><dt>vy</dt><dd>{fitValue(fit.vy, analysis.velocityUnit)}</dd></div>
              <div><dt>Speed</dt><dd>{fitValue(fit.speed, analysis.velocityUnit)}</dd></div>
            </>
          ) : (
            <>
              <div><dt>vx₀</dt><dd>{fitValue(fit.vx0, analysis.velocityUnit)}</dd></div>
              <div><dt>vy₀</dt><dd>{fitValue(fit.vy0, analysis.velocityUnit)}</dd></div>
              <div><dt>ax</dt><dd>{fitValue(fit.ax, analysis.accelerationUnit)}</dd></div>
              <div><dt>ay</dt><dd>{fitValue(fit.ay, analysis.accelerationUnit)}</dd></div>
              <div><dt>|a|</dt><dd>{fitValue(fit.accelerationMagnitude, analysis.accelerationUnit)}</dd></div>
            </>
          )}
          <div><dt>Mean residual X</dt><dd>{fitValue(diagnostics.summary.meanResidualX, analysis.positionUnit)}</dd></div>
          <div><dt>Mean residual Y</dt><dd>{fitValue(diagnostics.summary.meanResidualY, analysis.positionUnit)}</dd></div>
          <div><dt>Residual median</dt><dd>{fitValue(diagnostics.residualMedian, analysis.positionUnit)}</dd></div>
          <div><dt>Residual MAD</dt><dd>{fitValue(diagnostics.residualMad, analysis.positionUnit)}</dd></div>
        </dl>
      </details>
    </div>
  )
}

function SelectedFitObservation({
  observation,
  unit,
}: {
  observation: FitDiagnosticObservation
  unit: string
}) {
  return (
    <div className="fit-observation" data-testid="selected-fit-observation">
      <div className="fit-observation__heading">
        <h4>Selected deviation</h4>
        <span>{formatTimestamp(observation.time)}</span>
      </div>
      <dl>
        <div><dt>Observed</dt><dd>x {fitValue(observation.observedX, unit)} · y {fitValue(observation.observedY, unit)}</dd></div>
        <div><dt>Model</dt><dd>x {fitValue(observation.predictedX, unit)} · y {fitValue(observation.predictedY, unit)}</dd></div>
        <div><dt>Fit residual</dt><dd>dx {fitValue(observation.residualX, unit)} · dy {fitValue(observation.residualY, unit)} · |r| {fitValue(observation.residualMagnitude, unit)}</dd></div>
      </dl>
    </div>
  )
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
          <dt>Video point</dt>
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
  analysisSource,
  model,
  modelFitResult,
  diagnostics,
  onSeekSample,
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

      {track === null ? (
        <div className="kinematics-empty">
          <strong>No motion data yet</strong>
          <span>Create a track in Tracking, then mark the object across several video positions.</span>
        </div>
      ) : track.samples.length === 0 ? (
        <div className="kinematics-empty">
          <strong>No motion measurements yet</strong>
          <span>Choose Mark point in Tracking and place the first point on the paused video.</span>
        </div>
      ) : analysis === null ? (
        <>
          <p className="kinematics-empty">
            The selected derived analysis is unavailable. Switch to Raw to inspect confirmed observations.
          </p>
          {model !== 'none' && (
            <div className="kinematics-group kinematics-model-fit">
              <h3>Model fit</h3>
              <p className="kinematics-unavailable" role="status">
                {modelFitResult !== null && !modelFitResult.ok
                  ? modelFitResult.message
                  : 'Model fitting requires available analysis samples.'}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="kinematics-track-title">
            <span className="track-color" style={{ backgroundColor: track.color }} />
            <strong>{track.name}</strong>
            <small>{analysis.samples.length} valid samples · {positionUnit}</small>
          </div>

          {sample === null ? (
            <div className="kinematics-current-empty">
              <strong>No measurement at this video position</strong>
              <span>Select a sample below or choose a marker in the Analysis graph.</span>
            </div>
          ) : (
            <div className="kinematics-current">
              <PositionSection analysis={analysis} sample={sample} />
              <MotionSection analysis={analysis} sample={sample} />
            </div>
          )}

          {model !== 'none' && (
            modelFitResult?.ok && diagnostics !== null ? (
              <ModelFitSection
                analysis={analysis}
                currentSampleId={currentSample?.id ?? null}
                diagnostics={diagnostics}
                fit={modelFitResult.fit}
                onSeekSample={onSeekSample}
                source={analysisSource}
              />
            ) : (
              <div className="kinematics-group kinematics-model-fit">
                <h3>Model fit</h3>
                <p className="kinematics-unavailable" role="status">
                  {modelFitResult !== null && !modelFitResult.ok
                    ? modelFitResult.message
                    : 'Model fitting requires available analysis samples.'}
                </p>
              </div>
            )
          )}

        </>
      )}
    </section>
  )
}
