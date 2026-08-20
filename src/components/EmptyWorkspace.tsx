import { useState, type DragEvent } from 'react'

import { FilmIcon, ShieldIcon } from './Icons'
import { ProjectOpenButton } from './project/ProjectOpenButton'
import { VideoImportButton } from './video/VideoImportButton'

interface EmptyWorkspaceProps {
  onSelectVideo: (file: File) => void
  onOpenProject: (file: File) => void
  importError: string | null
  projectError: string | null
  sampleLoading: boolean
  onTrySample: () => void
}

export function EmptyWorkspace({
  onSelectVideo,
  onOpenProject,
  importError,
  projectError,
  sampleLoading,
  onTrySample,
}: EmptyWorkspaceProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file !== undefined) {
      onSelectVideo(file)
    }
  }

  return (
    <main className="empty-shell">
      <section
        aria-label="Video import area"
        className={`empty-workspace${isDragging ? ' empty-workspace--dragging' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          const relatedTarget = event.relatedTarget
          if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
            setIsDragging(false)
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="empty-workspace__grid" aria-hidden="true" />
        <div className="empty-workspace__content">
          <div className="empty-workspace__icon">
            <FilmIcon height="30" width="30" />
          </div>
          <p className="eyebrow">New analysis</p>
          <h1>Load a video to open the workspace</h1>
          <p className="empty-workspace__description">
            Inspect motion with timestamp-based playback and an analysis-ready overlay.
            Your file is decoded by this browser and never uploaded.
          </p>
          <p className="mobile-recommendation">
            MotionLab works best on a tablet, laptop, or desktop with room for the video and inspector.
          </p>
          <div className="empty-workspace__actions">
            <VideoImportButton onSelect={onSelectVideo} />
            <ProjectOpenButton onOpen={onOpenProject} />
            <button
              className="button button--secondary"
              disabled={sampleLoading}
              onClick={onTrySample}
              type="button"
            >
              {sampleLoading ? 'Loading sample…' : 'Try sample'}
            </button>
            <span>or drop a video here</span>
          </div>
          {(importError !== null || projectError !== null) && (
            <p className="inline-error" role="alert">
              {projectError ?? importError}
            </p>
          )}
          <div className="privacy-note">
            <ShieldIcon />
            <span>
              <strong>Local by design.</strong> No upload, account, or API key.
            </span>
          </div>
          <div className="empty-workspace__production-signature">
            <span>A</span>
            <img
              className="empty-workspace__production-logo"
              src="/qzeybei-logo.png"
              alt="Qzeybei"
            />
            <span>production</span>
          </div>
        </div>
      </section>
    </main>
  )
}
