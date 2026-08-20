import type { ReactNode } from 'react'

import type { LocalVideoSource, VideoMetadata } from '../../types/video'
import { FALLBACK_FRAME_RATE, formatTimestamp } from '../../video/timing'
import { DisclosureSection } from '../guidance/DisclosureSection'
import { ShieldIcon } from '../Icons'

interface VideoInspectorProps {
  source: LocalVideoSource
  metadata: VideoMetadata | null
  children?: ReactNode
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

function videoSummary(metadata: VideoMetadata | null): string {
  return metadata === null
    ? 'Reading video information…'
    : `${metadata.width} × ${metadata.height} · ${formatTimestamp(metadata.duration)}`
}

export function VideoInspector({ source, metadata, children }: VideoInspectorProps) {
  return (
    <aside className="inspector" aria-label="Workspace inspector">
      {children}

      <section className="inspector__section inspector__section--disclosure">
        <DisclosureSection title="Video details" summary={videoSummary(metadata)}>
          <dl className="property-list">
            <div>
              <dt>Resolution</dt>
              <dd>{metadata === null ? 'Reading…' : `${metadata.width} × ${metadata.height} px`}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{formatTimestamp(metadata?.duration ?? null)}</dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>{formatFileSize(source.size)}</dd>
            </div>
            <div>
              <dt>Media type</dt>
              <dd title={source.type}>{source.type}</dd>
            </div>
            <div>
              <dt>Modified</dt>
              <dd>{new Date(source.lastModified).toLocaleDateString()}</dd>
            </div>
          </dl>
        </DisclosureSection>
      </section>

      <section className="inspector__section inspector__section--disclosure">
        <DisclosureSection
          title="Advanced timing"
          summary={`Timestamp-based · ${FALLBACK_FRAME_RATE} fps step fallback`}
        >
          <dl className="property-list">
            <div>
              <dt>Video position</dt>
              <dd>Media timestamp</dd>
            </div>
            <div>
              <dt>Frame stepping</dt>
              <dd>≈ {(1000 / FALLBACK_FRAME_RATE).toFixed(1)} ms per step</dd>
            </div>
          </dl>
          <p className="inspector__note">
            Frame buttons perform timestamp seeks using a {FALLBACK_FRAME_RATE} fps fallback.
            Exact adjacent-frame access depends on the source codec and browser decoder and is not guaranteed.
          </p>
        </DisclosureSection>
      </section>

      <section className="inspector__privacy">
        <ShieldIcon />
        <div>
          <strong>On-device session</strong>
          <span>This file has not been uploaded.</span>
        </div>
      </section>
    </aside>
  )
}
