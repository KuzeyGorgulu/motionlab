import type { AnnotationTool } from '../../annotations/types'

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
}

export function AnnotationToolbar({
  activeTool,
  enabled,
  canUndo,
  canRedo,
  onToolChange,
  onUndo,
  onRedo,
}: AnnotationToolbarProps) {
  return (
    <section className="annotation-toolbar" aria-label="Annotation tools">
      <div className="annotation-toolbar__tools">
        {TOOLS.map(({ tool, label, shortcut }) => (
          <button
            aria-pressed={activeTool === tool}
            className={`tool-button${activeTool === tool ? ' tool-button--active' : ''}`}
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
      </div>

      <p className="annotation-toolbar__hint">
        {activeTool === 'select'
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
