import { VideoImportButton } from '../video/VideoImportButton'

interface VideoRelinkWarningProps {
  differences: readonly string[]
  onAccept: () => void
  onSelectVideo: (file: File) => void
}

export function VideoRelinkWarning({
  differences,
  onAccept,
  onSelectVideo,
}: VideoRelinkWarningProps) {
  return (
    <section className="project-relink-warning" role="alert">
      <div>
        <strong>This video may not match the saved project.</strong>
        <p>Tracking and annotation positions may not align correctly.</p>
        <ul>
          {differences.map((difference) => <li key={difference}>{difference}</li>)}
        </ul>
      </div>
      <div className="project-relink-warning__actions">
        <VideoImportButton
          compact
          label="Choose another video"
          onSelect={onSelectVideo}
        />
        <button className="button button--danger" onClick={onAccept} type="button">
          Use this video anyway
        </button>
      </div>
    </section>
  )
}
