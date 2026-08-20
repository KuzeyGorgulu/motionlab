import { angleBetweenThreePoints } from '../../annotations/measurement'
import type { Annotation } from '../../annotations/types'
import {
  formatLineMeasurement,
  formatMeasurementValue,
  measureLine,
  measurePoint,
} from '../../calibration/measurement'
import type { Calibration } from '../../calibration/types'
import { TrashIcon } from '../Icons'

interface AnnotationInspectorProps {
  annotations: Annotation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  calibration: Calibration | null
}

function measurementFor(
  annotation: Annotation,
  calibration: Calibration | null,
): string {
  if (annotation.type === 'point') {
    const worldMeasurement = measurePoint(annotation.point, calibration)
    if (worldMeasurement !== null) {
      return `x ${formatMeasurementValue(worldMeasurement.position.x)} ${worldMeasurement.unit} · y ${formatMeasurementValue(worldMeasurement.position.y)} ${worldMeasurement.unit}`
    }
    return `x ${annotation.point.x.toFixed(1)} · y ${annotation.point.y.toFixed(1)}`
  }
  if (annotation.type === 'line') {
    const measurement = measureLine(annotation.a, annotation.b, calibration)
    return measurement === null ? 'Undefined length' : formatLineMeasurement(measurement)
  }

  const angle = angleBetweenThreePoints(annotation.a, annotation.vertex, annotation.b)
  return angle === null ? 'Undefined angle' : `${angle.toFixed(1)}°`
}

export function AnnotationInspector({
  annotations,
  selectedId,
  onSelect,
  onDelete,
  calibration,
}: AnnotationInspectorProps) {
  const counts: Record<Annotation['type'], number> = { point: 0, line: 0, angle: 0 }

  return (
    <section className="inspector__section annotation-inspector">
      <div className="inspector__heading-row">
        <h2>Current frame annotations</h2>
        <span>{annotations.length}</span>
      </div>
      {annotations.length === 0 ? (
        <p className="annotation-list__empty">
          Choose Point, Line, or Angle and click directly on the paused video.
        </p>
      ) : (
        <ul className="annotation-list">
          {annotations.map((annotation) => {
            counts[annotation.type] += 1
            const typeName = `${annotation.type[0]!.toUpperCase()}${annotation.type.slice(1)}`
            const label = `${typeName} ${counts[annotation.type]}`
            const selected = annotation.id === selectedId
            return (
              <li className={selected ? 'annotation-list__item annotation-list__item--selected' : 'annotation-list__item'} key={annotation.id}>
                <button
                  aria-pressed={selected}
                  className="annotation-list__select"
                  onClick={() => onSelect(annotation.id)}
                  type="button"
                >
                  <span className={`annotation-type-mark annotation-type-mark--${annotation.type}`} aria-hidden="true" />
                  <span>
                    <strong>{label}</strong>
                    <small>{measurementFor(annotation, calibration)}</small>
                  </span>
                </button>
                <button
                  aria-label={`Delete ${label}`}
                  className="annotation-list__delete"
                  onClick={() => onDelete(annotation.id)}
                  title={`Delete ${label}`}
                  type="button"
                >
                  <TrashIcon />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="annotation-inspector__scope">
        Video coordinates · current video position only
      </p>
    </section>
  )
}
