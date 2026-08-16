import type { FormEvent } from 'react'

import {
  calibrationPixelDistance,
  unitsPerPixel,
} from '../../calibration/model'
import { formatMeasurementValue } from '../../calibration/measurement'
import {
  DISTANCE_UNITS,
  DISTANCE_UNIT_LABELS,
  type Calibration,
  type CalibrationMode,
  type DistanceUnit,
} from '../../calibration/types'

interface CalibrationPanelProps {
  calibration: Calibration | null
  mode: CalibrationMode
  selectedReferenceCount: number
  knownDistanceInput: string
  unit: DistanceUnit
  error: string | null
  onKnownDistanceChange: (value: string) => void
  onUnitChange: (unit: DistanceUnit) => void
  onBeginScale: () => void
  onConfirmScale: () => void
  onUpdateMeasurement: () => void
  onBeginOrigin: () => void
  onBeginXAxis: () => void
  onCancel: () => void
  onReset: () => void
}

function DistanceFields({
  value,
  unit,
  onValueChange,
  onUnitChange,
}: {
  value: string
  unit: DistanceUnit
  onValueChange: (value: string) => void
  onUnitChange: (unit: DistanceUnit) => void
}) {
  return (
    <div className="calibration-fields">
      <label>
        <span>Known distance</span>
        <input
          inputMode="decimal"
          min="0"
          onChange={(event) => onValueChange(event.currentTarget.value)}
          step="any"
          type="number"
          value={value}
        />
      </label>
      <label>
        <span>Unit</span>
        <select
          onChange={(event) => onUnitChange(event.currentTarget.value as DistanceUnit)}
          value={unit}
        >
          {DISTANCE_UNITS.map((distanceUnit) => (
            <option key={distanceUnit} value={distanceUnit}>
              {distanceUnit} — {DISTANCE_UNIT_LABELS[distanceUnit]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function CalibrationPanel({
  calibration,
  mode,
  selectedReferenceCount,
  knownDistanceInput,
  unit,
  error,
  onKnownDistanceChange,
  onUnitChange,
  onBeginScale,
  onConfirmScale,
  onUpdateMeasurement,
  onBeginOrigin,
  onBeginXAxis,
  onCancel,
  onReset,
}: CalibrationPanelProps) {
  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
    action: () => void,
  ) => {
    event.preventDefault()
    action()
  }

  const isCapturing = mode !== 'idle'

  return (
    <section className="inspector__section calibration-panel">
      <div className="inspector__heading-row">
        <h2>Calibration</h2>
        <span className={calibration === null ? 'calibration-status' : 'calibration-status calibration-status--active'}>
          {calibration === null ? 'Off' : 'Active'}
        </span>
      </div>

      {mode === 'scale-points' && (
        <div className="calibration-task" role="status">
          <strong>Set scale reference</strong>
          <span>
            {selectedReferenceCount === 0
              ? 'Click reference point A on the video.'
              : 'Point A set. Click reference point B.'}
          </span>
          <button onClick={onCancel} type="button">Cancel</button>
        </div>
      )}

      {mode === 'scale-values' && (
        <form className="calibration-form" onSubmit={(event) => handleSubmit(event, onConfirmScale)}>
          <p>Reference A → B selected. Enter its real distance.</p>
          <DistanceFields
            onUnitChange={onUnitChange}
            onValueChange={onKnownDistanceChange}
            unit={unit}
            value={knownDistanceInput}
          />
          <div className="calibration-form__actions">
            <button className="calibration-action calibration-action--primary" type="submit">Confirm</button>
            <button className="calibration-action" onClick={onCancel} type="button">Cancel</button>
          </div>
        </form>
      )}

      {mode === 'origin' && (
        <div className="calibration-task" role="status">
          <strong>Set world origin</strong>
          <span>Click the native-video position that should become (0, 0).</span>
          <button onClick={onCancel} type="button">Cancel</button>
        </div>
      )}

      {mode === 'x-axis' && (
        <div className="calibration-task" role="status">
          <strong>Set positive X</strong>
          <span>Click a point in the positive X direction from the origin.</span>
          <button onClick={onCancel} type="button">Cancel</button>
        </div>
      )}

      {error !== null && <p className="calibration-error" role="alert">{error}</p>}

      {!isCapturing && calibration === null && (
        <>
          <p className="calibration-empty">
            Define a known length to replace pixel measurements with physical units.
          </p>
          <button className="calibration-action calibration-action--primary calibration-action--wide" onClick={onBeginScale} type="button">
            Create calibration
          </button>
        </>
      )}

      {!isCapturing && calibration !== null && (
        <>
          <dl className="calibration-summary">
            <div>
              <dt>Scale reference</dt>
              <dd>{formatMeasurementValue(calibration.knownDistance)} {calibration.unit} = {calibrationPixelDistance(calibration).toFixed(1)} px</dd>
            </div>
            <div>
              <dt>Scale factor</dt>
              <dd>{formatMeasurementValue(unitsPerPixel(calibration))} {calibration.unit}/px</dd>
            </div>
            <div>
              <dt>Origin</dt>
              <dd>({calibration.origin.x.toFixed(1)}, {calibration.origin.y.toFixed(1)}) px · {calibration.originSource === 'custom' ? 'custom' : 'point A'}</dd>
            </div>
            <div>
              <dt>Positive X</dt>
              <dd>({calibration.xAxis.x.toFixed(3)}, {calibration.xAxis.y.toFixed(3)}) · {calibration.axisSource === 'custom' ? 'custom' : 'A → B'}</dd>
            </div>
            <div>
              <dt>Positive Y</dt>
              <dd>90° counterclockwise from +X</dd>
            </div>
          </dl>

          <form className="calibration-form calibration-form--edit" onSubmit={(event) => handleSubmit(event, onUpdateMeasurement)}>
            <DistanceFields
              onUnitChange={onUnitChange}
              onValueChange={onKnownDistanceChange}
              unit={unit}
              value={knownDistanceInput}
            />
            <button className="calibration-action calibration-action--wide" type="submit">Update distance / unit</button>
          </form>

          <div className="calibration-actions-grid">
            <button className="calibration-action" onClick={onBeginOrigin} type="button">Set origin</button>
            <button className="calibration-action" onClick={onBeginXAxis} type="button">Set X axis</button>
            <button className="calibration-action" onClick={onBeginScale} type="button">New reference</button>
            <button className="calibration-action calibration-action--danger" onClick={onReset} type="button">Reset</button>
          </div>
          <p className="calibration-assumption">
            Uniform planar scale. Measurements at different scene depths may be inaccurate.
          </p>
        </>
      )}
    </section>
  )
}
