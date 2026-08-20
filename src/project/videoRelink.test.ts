import { describe, expect, it } from 'vitest'

import { compareRelinkedVideo } from './videoRelink'

const SOURCE = {
  name: 'experiment.mp4',
  url: 'blob:test',
  size: 10,
  type: 'video/mp4',
  lastModified: 1,
}

describe('project video relinking', () => {
  it('accepts matching filename, dimensions, and duration', () => {
    expect(
      compareRelinkedVideo(
        { name: 'experiment.mp4', width: 1280, height: 720, duration: 10 },
        SOURCE,
        { width: 1280, height: 720, duration: 10.2 },
      ),
    ).toEqual({ matches: true, differences: [] })
  })

  it('reports filename, resolution, and substantial duration differences', () => {
    const comparison = compareRelinkedVideo(
      { name: 'original.mp4', width: 1920, height: 1080, duration: 20 },
      SOURCE,
      { width: 1280, height: 720, duration: 10 },
    )
    expect(comparison.matches).toBe(false)
    expect(comparison.differences).toHaveLength(3)
  })

  it('does not reject a relink when optional measurements are absent', () => {
    expect(
      compareRelinkedVideo(
        { name: 'experiment.mp4' },
        SOURCE,
        { width: 1, height: 1, duration: null },
      ).matches,
    ).toBe(true)
  })
})
