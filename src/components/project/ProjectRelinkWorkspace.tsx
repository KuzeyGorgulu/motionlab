import type { MotionLabProjectV1 } from '../../project/types'
import { FilmIcon, ShieldIcon } from '../Icons'
import { VideoImportButton } from '../video/VideoImportButton'
import { ProjectOpenButton } from './ProjectOpenButton'

interface ProjectRelinkWorkspaceProps {
  project: MotionLabProjectV1
  error: string | null
  onOpenProject: (file: File) => void
  onSelectVideo: (file: File) => void
}

export function ProjectRelinkWorkspace({
  project,
  error,
  onOpenProject,
  onSelectVideo,
}: ProjectRelinkWorkspaceProps) {
  return (
    <main className="empty-shell">
      <section className="empty-workspace" aria-labelledby="project-relink-title">
        <div className="empty-workspace__grid" aria-hidden="true" />
        <div className="empty-workspace__content">
          <div className="empty-workspace__icon">
            <FilmIcon height="30" width="30" />
          </div>
          <p className="eyebrow">Project ready</p>
          <h1 id="project-relink-title">Select the original video</h1>
          <p className="empty-workspace__description">
            This project was created with <strong>{project.video.name}</strong>.
            The video is not embedded in the project file and must be selected
            again from this device.
          </p>
          <div className="empty-workspace__actions">
            <VideoImportButton
              label="Select original video"
              onSelect={onSelectVideo}
            />
            <ProjectOpenButton
              label="Open different project"
              onOpen={onOpenProject}
            />
          </div>
          {error !== null && <p className="inline-error" role="alert">{error}</p>}
          <div className="privacy-note">
            <ShieldIcon />
            <span>
              <strong>Local relinking.</strong> MotionLab cannot access a local
              video unless you select it.
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
