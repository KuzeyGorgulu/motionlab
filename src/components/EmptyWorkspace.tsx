import { useState, type DragEvent } from 'react'

import { FilmIcon, ShieldIcon } from './Icons'
import { VideoImportButton } from './video/VideoImportButton'

interface EmptyWorkspaceProps {
  onSelectVideo: (file: File) => void
  importError: string | null
}

export function EmptyWorkspace({
  onSelectVideo,
  importError,
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
          <div className="empty-workspace__actions">
            <VideoImportButton onSelect={onSelectVideo} />
            <span>or drop a video here</span>
          </div>
          {importError !== null && (
            <p className="inline-error" role="alert">
              {importError}
            </p>
          )}
          <div className="privacy-note">
            <ShieldIcon />
            <span>
              <strong>Local by design.</strong> No upload, account, or API key.
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}
