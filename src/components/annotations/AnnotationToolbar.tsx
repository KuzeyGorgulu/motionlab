import type { AnnotationTool } from '../../annotations/types'
import type { TrackingMode } from '../../tracking/types'

const TOOLS: Array<{ tool: AnnotationTool; label: string; shortcut: string }> = [
  { tool: 'select', label: 'Select', shortcut: 'V' },
  { tool: 'point', label: 'Point', shortcut: 'P' },
  { tool: 'line', label: 'Line', shortcut: 'L' },
  { tool: 'angle', label: 'Angle', shortcut: 'A' },
]

interface AnnotationToolbarProps {
  activeTool: AnnotationTool
  enabled: boolean
  canUndo: boolean
  canRedo: boolean
  onToolChange: (tool: AnnotationTool) => void
  onUndo: () => void
  onRedo: () => void
  trackingMode: TrackingMode
  trackingEnabled: boolean
  onTrackMark: () => void
}

export function AnnotationToolbar({
  activeTool,
  enabled,
  canUndo,
  canRedo,
  onToolChange,
  onUndo,
  onRedo,
  trackingMode,
  trackingEnabled,
  onTrackMark,
}: AnnotationToolbarProps) {
  return (
    <section className="annotation-toolbar" aria-label="Canvas tools">
      <div className="annotation-toolbar__tools">
        {TOOLS.map(({ tool, label, shortcut }) => (
          <button
            aria-pressed={activeTool === tool && trackingMode === 'idle'}
            className={`tool-button${activeTool === tool && trackingMode === 'idle' ? ' tool-button--active' : ''}`}
            disabled={!enabled}
            key={tool}
            onClick={() => onToolChange(tool)}
            title={`${label} tool (${shortcut})`}
            type="button"
          >
            <span className={`tool-glyph tool-glyph--${tool}`} aria-hidden="true" />
            {label}
            <kbd>{shortcut}</kbd>
          </button>
        ))}
        <button
          aria-pressed={trackingMode === 'mark'}
          className={`tool-button${trackingMode === 'mark' ? ' tool-button--active tool-button--tracking' : ''}`}
          disabled={!enabled || !trackingEnabled}
          onClick={onTrackMark}
          title="Track Mark mode (T)"
          type="button"
        >
          <span className="tool-glyph tool-glyph--track" aria-hidden="true" />
          Track
          <kbd>T</kbd>
        </button>
      </div>

      <p className="annotation-toolbar__hint">
        {trackingMode === 'mark'
          ? 'Click to mark or replace the active track sample'
          : trackingMode === 'edit'
            ? 'Drag the active track sample on the current frame'
            : activeTool === 'select'
          ? 'Select geometry or drag a control point'
          : activeTool === 'point'
            ? 'Click to place a point'
            : activeTool === 'line'
              ? 'Click two endpoints · Esc cancels'
              : 'Click arm, vertex, arm · Esc cancels'}
      </p>

      <div className="annotation-toolbar__history">
        <button
          aria-label="Undo annotation change"
          disabled={!canUndo}
          onClick={onUndo}
          title="Undo annotation change (Ctrl/Cmd+Z)"
          type="button"
        >
          ↶
        </button>
        <button
          aria-label="Redo annotation change"
          disabled={!canRedo}
          onClick={onRedo}
          title="Redo annotation change (Ctrl/Cmd+Shift+Z)"
          type="button"
        >
          ↷
        </button>
      </div>
    </section>
  )
}
