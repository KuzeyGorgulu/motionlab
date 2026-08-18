import type { Point } from '../video/geometry'
import type { TimestampFrameReference } from '../video/frameReference'
import { isSameFrameReference } from '../video/frameReference'
import { visibleTrackSamples } from './selectors'
import type {
  Track,
  TrackDragPreview,
  TrackSample,
  TrailMode,
} from './types'

interface TrackRenderOptions {
  activeTrackId: string | null
  currentFrame: TimestampFrameReference
  currentTime: number
  displayScale: number
  trailMode: TrailMode
  dragPreview: TrackDragPreview | null
}

function samplePosition(
  sample: TrackSample,
  track: Track,
  preview: TrackDragPreview | null,
): Point {
  return preview?.trackId === track.id && preview.sampleId === sample.id
    ? preview.nativePosition
    : sample.nativePosition
}

function drawSample(
  context: CanvasRenderingContext2D,
  position: Point,
  color: string,
  unit: number,
  active: boolean,
  current: boolean,
) {
  context.beginPath()
  context.arc(
    position.x,
    position.y,
    (current ? (active ? 7 : 5.5) : active ? 4 : 3) * unit,
    0,
    Math.PI * 2,
  )
  context.fillStyle = current ? '#071013' : color
  context.fill()
  context.strokeStyle = current ? '#ffffff' : color
  context.lineWidth = (current ? 2.25 : 1.4) * unit
  context.stroke()

  if (current && active) {
    context.beginPath()
    context.arc(position.x, position.y, 10 * unit, 0, Math.PI * 2)
    context.strokeStyle = color
    context.lineWidth = 1.5 * unit
    context.stroke()
  }
}

export function renderTrackLayer(
  context: CanvasRenderingContext2D,
  tracks: readonly Track[],
  options: TrackRenderOptions,
) {
  const unit = 1 / Math.max(options.displayScale, 0.01)

  for (const track of tracks) {
    const active = track.id === options.activeTrackId
    const samples = visibleTrackSamples(
      track,
      options.currentFrame,
      options.currentTime,
      options.trailMode,
    )
    if (samples.length === 0) continue

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.globalAlpha = active ? 1 : 0.42

    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1]!
      const sample = samples[index]!
      const previousPoint = samplePosition(previous, track, options.dragPreview)
      const point = samplePosition(sample, track, options.dragPreview)
      const segmentIsFuture =
        options.trailMode === 'all' &&
        sample.time > options.currentTime &&
        !isSameFrameReference(sample.frame, options.currentFrame)

      context.beginPath()
      context.moveTo(previousPoint.x, previousPoint.y)
      context.lineTo(point.x, point.y)
      context.strokeStyle = track.color
      context.lineWidth = (active ? 2.4 : 1.5) * unit
      context.globalAlpha = active
        ? segmentIsFuture
          ? 0.35
          : 0.9
        : segmentIsFuture
          ? 0.16
          : 0.36
      context.setLineDash(segmentIsFuture ? [5 * unit, 5 * unit] : [])
      context.stroke()
    }

    context.setLineDash([])
    for (const sample of samples) {
      const current = isSameFrameReference(sample.frame, options.currentFrame)
      const future =
        options.trailMode === 'all' &&
        sample.time > options.currentTime &&
        !current
      context.globalAlpha = active ? (future ? 0.4 : 1) : future ? 0.15 : 0.45
      drawSample(
        context,
        samplePosition(sample, track, options.dragPreview),
        track.color,
        unit,
        active,
        current,
      )
    }
    context.restore()
  }
}
