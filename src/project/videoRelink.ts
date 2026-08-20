import type { ProjectVideoReferenceV1 } from './types'
import type { LocalVideoSource, VideoMetadata } from '../types/video'

export interface VideoRelinkComparison {
  matches: boolean
  differences: string[]
}

export function compareRelinkedVideo(
  expected: ProjectVideoReferenceV1,
  source: LocalVideoSource,
  actual: VideoMetadata,
): VideoRelinkComparison {
  const differences: string[] = []
  if (source.name !== expected.name) {
    differences.push(`Filename differs: expected “${expected.name}”, selected “${source.name}”.`)
  }
  if (
    expected.width !== undefined &&
    expected.height !== undefined &&
    (actual.width !== expected.width || actual.height !== expected.height)
  ) {
    differences.push(
      `Resolution differs: expected ${expected.width} × ${expected.height}px, selected ${actual.width} × ${actual.height}px.`,
    )
  }
  if (
    expected.duration !== undefined &&
    actual.duration !== null &&
    Math.abs(actual.duration - expected.duration) >
      Math.max(0.5, expected.duration * 0.02)
  ) {
    differences.push(
      `Duration differs: expected ${expected.duration.toFixed(2)}s, selected ${actual.duration.toFixed(2)}s.`,
    )
  }
  return { matches: differences.length === 0, differences }
}
