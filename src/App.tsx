import { useState } from 'react'

import { EmptyWorkspace } from './components/EmptyWorkspace'
import { ShieldIcon } from './components/Icons'
import { VideoWorkspace } from './components/video/VideoWorkspace'
import { useLocalVideoSource } from './hooks/useLocalVideoSource'

export default function App() {
  const { source, importError, loadVideo, clearVideo } = useLocalVideoSource()
  const [assistedTrackingNoticeAcknowledged, setAssistedTrackingNoticeAcknowledged] =
    useState(false)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="MotionLab home">
          <span className="brand-mark" aria-hidden="true">
            <i className="brand-mark__x" />
            <i className="brand-mark__y" />
            <i className="brand-mark__point" />
          </span>
          <span>Motion<span>Lab</span></span>
          <small>Video mechanics</small>
        </div>
        <div className="local-status">
          <ShieldIcon />
          <span><strong>Local session</strong> · Video stays on this device</span>
        </div>
      </header>

      {source === null ? (
        <EmptyWorkspace importError={importError} onSelectVideo={loadVideo} />
      ) : (
        <VideoWorkspace
          assistedTrackingNoticeAcknowledged={assistedTrackingNoticeAcknowledged}
          importError={importError}
          key={source.url}
          onAcknowledgeAssistedTrackingNotice={() => {
            setAssistedTrackingNoticeAcknowledged(true)
          }}
          onRemoveVideo={clearVideo}
          onSelectVideo={loadVideo}
          source={source}
        />
      )}
    </div>
  )
}
