import type { ReactNode } from 'react'

import type { LocalVideoSource, VideoMetadata } from '../../types/video'
import { FALLBACK_FRAME_RATE, formatTimestamp } from '../../video/timing'
import { ShieldIcon } from '../Icons'

interface VideoInspectorProps {
  source: LocalVideoSource
  metadata: VideoMetadata | null
  children?: ReactNode
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

export function VideoInspector({ source, metadata, children }: VideoInspectorProps) {
  return (
    <aside className="inspector" aria-label="Workspace inspector">
      {children}
      <section className="inspector__section">
        <h2>Video source</h2>
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
      </section>

      <section className="inspector__section">
        <h2>Timing</h2>
        <dl className="property-list">
          <div>
            <dt>Position source</dt>
            <dd>Media timestamp</dd>
          </div>
          <div>
            <dt>Step basis</dt>
            <dd>{FALLBACK_FRAME_RATE} fps fallback</dd>
          </div>
        </dl>
        <p className="inspector__note">
          Frame buttons make timestamp seeks. Exact adjacent-frame access depends on the
          source codec and browser decoder and is not guaranteed.
        </p>
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
