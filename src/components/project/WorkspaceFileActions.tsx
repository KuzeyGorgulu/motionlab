import { ProjectOpenButton } from './ProjectOpenButton'

interface WorkspaceFileActionsProps {
  canExportGraph: boolean
  canSave: boolean
  onExportCsv: () => void
  onExportGraph: () => void
  onExportJson: () => void
  onOpenProject: (file: File) => void
  onSaveProject: () => void
}

export function WorkspaceFileActions({
  canExportGraph,
  canSave,
  onExportCsv,
  onExportGraph,
  onExportJson,
  onOpenProject,
  onSaveProject,
}: WorkspaceFileActionsProps) {
  return (
    <div className="workspace-file-actions">
      <details className="workspace-action-menu">
        <summary>Project</summary>
        <div className="workspace-action-menu__panel">
          <ProjectOpenButton
            className="workspace-action-menu__item"
            onOpen={onOpenProject}
          />
          <button
            className="workspace-action-menu__item"
            disabled={!canSave}
            onClick={onSaveProject}
            type="button"
          >
            Save project
          </button>
        </div>
      </details>
      <details className="workspace-action-menu">
        <summary>Export</summary>
        <div className="workspace-action-menu__panel">
          <button
            className="workspace-action-menu__item"
            onClick={onExportCsv}
            type="button"
          >
            CSV data
          </button>
          <button
            className="workspace-action-menu__item"
            onClick={onExportJson}
            type="button"
          >
            JSON data
          </button>
          <button
            className="workspace-action-menu__item"
            disabled={!canExportGraph}
            onClick={onExportGraph}
            type="button"
          >
            Current graph (SVG)
          </button>
        </div>
      </details>
    </div>
  )
}
