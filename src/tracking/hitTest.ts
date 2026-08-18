import type { Point } from '../video/geometry'
import type { TrackSample } from './types'

export function hitTestTrackSample(
  samples: readonly TrackSample[],
  point: Point,
  tolerance: number,
): TrackSample | null {
  if (!Number.isFinite(tolerance) || tolerance < 0) return null

  let closest: TrackSample | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const sample of samples) {
    const distance = Math.hypot(
      point.x - sample.nativePosition.x,
      point.y - sample.nativePosition.y,
    )
    if (distance <= tolerance && distance < closestDistance) {
      closest = sample
      closestDistance = distance
    }
  }
  return closest
}
