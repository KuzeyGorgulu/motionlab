import { useMemo, useRef, type CSSProperties, type RefObject } from 'react'

import { useElementSize } from '../../hooks/useElementSize'
import type { VideoController } from '../../hooks/useVideoController'
import type { VideoMetadata } from '../../types/video'
import { getContainedContentRect } from '../../video/geometry'

interface VideoStageProps {
  sourceUrl: string
  videoName: string
  videoRef: RefObject<HTMLVideoElement | null>
  metadata: VideoMetadata | null
  mediaError: string | null
  mediaEvents: VideoController['mediaEvents']
}

export function VideoStage({
  sourceUrl,
  videoName,
  videoRef,
  metadata,
  mediaError,
  mediaEvents,
}: VideoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const stageSize = useElementSize(stageRef)
  const contentRect = useMemo(
    () =>
      getContainedContentRect(stageSize, {
        width: metadata?.width ?? 0,
        height: metadata?.height ?? 0,
      }),
    [metadata?.height, metadata?.width, stageSize],
  )

  const overlayStyle = {
    '--overlay-left': `${contentRect.x}px`,
    '--overlay-top': `${contentRect.y}px`,
    '--overlay-width': `${contentRect.width}px`,
    '--overlay-height': `${contentRect.height}px`,
  } as CSSProperties

  return (
    <div className="video-stage" ref={stageRef}>
      <video
        aria-label={`Local video: ${videoName}`}
        className="video-stage__video"
        onDurationChange={mediaEvents.onDurationChange}
        onEnded={mediaEvents.onEnded}
        onError={mediaEvents.onError}
        onLoadedMetadata={mediaEvents.onLoadedMetadata}
        onPause={mediaEvents.onPause}
        onPlay={mediaEvents.onPlay}
        onSeeked={mediaEvents.onSeeked}
        onSeeking={mediaEvents.onSeeking}
        onTimeUpdate={mediaEvents.onTimeUpdate}
        playsInline
        preload="metadata"
        ref={videoRef}
        src={sourceUrl}
      />
      {metadata !== null && contentRect.width > 0 && (
        <canvas
          aria-hidden="true"
          className="video-stage__overlay"
          data-coordinate-space="native-video-pixels"
          height={metadata.height}
          style={overlayStyle}
          width={metadata.width}
        />
      )}
      {metadata === null && mediaError === null && (
        <div className="video-stage__status" role="status">
          <span className="status-spinner" aria-hidden="true" />
          Reading video metadata…
        </div>
      )}
      {mediaError !== null && (
        <div className="video-stage__error" role="alert">
          <strong>Video unavailable</strong>
          <span>{mediaError}</span>
        </div>
      )}
    </div>
  )
}
