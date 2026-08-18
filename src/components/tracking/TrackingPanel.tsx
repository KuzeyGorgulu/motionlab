import { useEffect, useState, type FormEvent } from 'react'

import { formatMeasurementValue, measurePoint } from '../../calibration/measurement'
import type { Calibration } from '../../calibration/types'
import type {
  Track,
  TrackSample,
  TrackingMode,
  TrailMode,
} from '../../tracking/types'
import { formatTimestamp } from '../../video/timing'
import { TrashIcon } from '../Icons'

interface TrackingPanelProps {
  tracks: Track[]
  activeTrack: Track | null
  currentSample: TrackSample | null
  mode: TrackingMode
  trailMode: TrailMode
  advanceAfterMark: boolean
  calibration: Calibration | null
  canUndo: boolean
  canRedo: boolean
  onCreateTrack: (name: string) => boolean
  onRenameTrack: (id: string, name: string) => void
  onDeleteTrack: (id: string) => void
  onSelectTrack: (id: string) => void
  onBeginMark: () => void
  onBeginEdit: () => void
  onCancelInteraction: () => void
  onTrailModeChange: (mode: TrailMode) => void
  onAdvanceAfterMarkChange: (enabled: boolean) => void
  onDeleteCurrentSample: () => void
  onSeekSample: (time: number) => void
  onUndo: () => void
  onRedo: () => void
}

function coordinateText(sample: TrackSample, calibration: Calibration | null) {
  const native = `${sample.nativePosition.x.toFixed(1)}, ${sample.nativePosition.y.toFixed(1)} px`
  const world = measurePoint(sample.nativePosition, calibration)
  return {
    native,
    world:
      world === null
        ? null
        : `${formatMeasurementValue(world.position.x)}, ${formatMeasurementValue(world.position.y)} ${world.unit}`,
  }
}

export function TrackingPanel({
  tracks,
  activeTrack,
  currentSample,
  mode,
  trailMode,
  advanceAfterMark,
  calibration,
  canUndo,
  canRedo,
  onCreateTrack,
  onRenameTrack,
  onDeleteTrack,
  onSelectTrack,
  onBeginMark,
  onBeginEdit,
  onCancelInteraction,
  onTrailModeChange,
  onAdvanceAfterMarkChange,
  onDeleteCurrentSample,
  onSeekSample,
  onUndo,
  onRedo,
}: TrackingPanelProps) {
  const [newName, setNewName] = useState('Ball')
  const [renameInput, setRenameInput] = useState(activeTrack?.name ?? '')
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)

  useEffect(() => {
    setRenameInput(activeTrack?.name ?? '')
    setDeleteConfirmationId(null)
  }, [activeTrack?.id, activeTrack?.name])

  const submitNewTrack = (event: FormEvent) => {
    event.preventDefault()
    if (onCreateTrack(newName)) setNewName('')
  }

  const submitRename = (event: FormEvent) => {
    event.preventDefault()
    if (activeTrack !== null) onRenameTrack(activeTrack.id, renameInput)
  }

  const currentCoordinates =
    currentSample === null ? null : coordinateText(currentSample, calibration)

  return (
    <section className="inspector__section tracking-panel">
      <div className="inspector__heading-row">
        <h2>Manual tracking</h2>
        <span className={mode === 'idle' ? '' : 'tracking-status--active'}>
          {mode === 'idle' ? tracks.length : mode}
        </span>
      </div>

      <form className="tracking-create" onSubmit={submitNewTrack}>
        <label>
          <span>New track</span>
          <input
            aria-label="New track name"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Object name"
            value={newName}
          />
        </label>
        <button disabled={newName.trim() === ''} type="submit">Create</button>
      </form>

      {tracks.length === 0 ? (
        <p className="tracking-empty">
          Create a track, pause on the object, then mark its position across timestamps.
        </p>
      ) : (
        <div className="track-switcher" role="list" aria-label="Tracks">
          {tracks.map((track) => {
            const active = track.id === activeTrack?.id
            return (
              <button
                aria-pressed={active}
                className={active ? 'track-choice track-choice--active' : 'track-choice'}
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                role="listitem"
                type="button"
              >
                <span className="track-color" style={{ backgroundColor: track.color }} />
                <span>{track.name}</span>
                <small>{track.samples.length}</small>
              </button>
            )
          })}
        </div>
      )}

      {activeTrack !== null && (
        <>
          <div className="tracking-mode-actions">
            <button
              aria-pressed={mode === 'mark'}
              className={mode === 'mark' ? 'calibration-action calibration-action--primary' : 'calibration-action'}
              onClick={mode === 'mark' ? onCancelInteraction : onBeginMark}
              type="button"
            >
              {mode === 'mark' ? 'Stop marking' : 'Mark point (T)'}
            </button>
            <button
              aria-pressed={mode === 'edit'}
              className={mode === 'edit' ? 'calibration-action calibration-action--primary' : 'calibration-action'}
              disabled={currentSample === null}
              onClick={mode === 'edit' ? onCancelInteraction : onBeginEdit}
              type="button"
            >
              {mode === 'edit' ? 'Stop editing' : 'Edit current'}
            </button>
          </div>

          <label className="tracking-advance">
            <input
              checked={advanceAfterMark}
              onChange={(event) => onAdvanceAfterMarkChange(event.target.checked)}
              type="checkbox"
            />
            Advance after mark (approx. 30 fps)
          </label>

          <label className="tracking-trail">
            <span>Trail</span>
            <select
              onChange={(event) => onTrailModeChange(event.target.value as TrailMode)}
              value={trailMode}
            >
              <option value="past">Past + current</option>
              <option value="all">All (future muted)</option>
              <option value="current">Current only</option>
            </select>
          </label>

          <form className="tracking-rename" onSubmit={submitRename}>
            <label>
              <span>Active track name</span>
              <input
                aria-label="Active track name"
                onChange={(event) => setRenameInput(event.target.value)}
                value={renameInput}
              />
            </label>
            <button disabled={renameInput.trim() === ''} type="submit">Rename</button>
          </form>

          <div className="tracking-current">
            <div className="tracking-current__heading">
              <strong>Current frame</strong>
              <span>{currentSample === null ? 'No sample' : 'Sample marked'}</span>
            </div>
            {currentSample === null ? (
              <p>Use Mark point and click the object on this frame.</p>
            ) : (
              <dl>
                <div><dt>Native</dt><dd>{currentCoordinates?.native}</dd></div>
                {currentCoordinates?.world !== null && (
                  <div><dt>World</dt><dd>{currentCoordinates?.world}</dd></div>
                )}
              </dl>
            )}
            <button
              className="tracking-delete-sample"
              disabled={currentSample === null}
              onClick={onDeleteCurrentSample}
              type="button"
            >
              Delete current sample
            </button>
          </div>

          <div className="tracking-history" aria-label="Track history">
            <button disabled={!canUndo} onClick={onUndo} type="button">Undo track change</button>
            <button disabled={!canRedo} onClick={onRedo} type="button">Redo</button>
          </div>

          <div className="track-samples">
            <div className="track-samples__heading">
              <strong>Samples</strong>
              <span>{activeTrack.samples.length}</span>
            </div>
            {activeTrack.samples.length === 0 ? (
              <p>No samples yet.</p>
            ) : (
              <ol>
                {activeTrack.samples.map((sample) => {
                  const coordinates = coordinateText(sample, calibration)
                  return (
                    <li key={sample.id}>
                      <button onClick={() => onSeekSample(sample.time)} type="button">
                        <strong>{formatTimestamp(sample.time)}</strong>
                        <span>{coordinates.native}</span>
                        {coordinates.world !== null && <small>{coordinates.world}</small>}
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          <div className="tracking-delete-track">
            {deleteConfirmationId === activeTrack.id ? (
              <>
                <span>Delete “{activeTrack.name}” and all samples?</span>
                <button
                  className="calibration-action calibration-action--danger"
                  onClick={() => onDeleteTrack(activeTrack.id)}
                  type="button"
                >
                  Confirm delete
                </button>
                <button onClick={() => setDeleteConfirmationId(null)} type="button">Cancel</button>
              </>
            ) : (
              <button
                className="tracking-delete-track__start"
                onClick={() => setDeleteConfirmationId(activeTrack.id)}
                type="button"
              >
                <TrashIcon /> Delete track
              </button>
            )}
          </div>
        </>
      )}

      <p className="annotation-inspector__scope">
        Native positions · timestamp buckets · session only
      </p>
    </section>
  )
}
