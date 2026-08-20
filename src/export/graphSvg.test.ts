import { describe, expect, it } from 'vitest'

import { deriveTrackKinematics } from '../analysis/kinematics'
import { selectVisualizationGroup } from '../analysis/series'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import { createGraphSvg } from './graphSvg'

function trackWithSamples(): Track {
  return {
    id: 'track-1',
    name: 'Ball <A>',
    color: '#4ecdc4',
    samples: [0, 1, 2].map((time) => ({
      id: `sample-${time}`,
      time,
      frame: createFrameReference(time),
      nativePosition: { x: time * 10, y: time * 5 },
    })),
  }
}

describe('graph SVG export', () => {
  it('exports the current graph with title, axes, units, and no UI chrome', () => {
    const track = trackWithSamples()
    const group = selectVisualizationGroup(
      deriveTrackKinematics(track, null),
      'position',
    )
    const result = createGraphSvg(group, track.name, track.color)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.svg).toContain('Ball &lt;A&gt; — Position')
    expect(result.svg).toContain('Time (s)')
    expect(result.svg).toContain('Position (px)')
    expect(result.svg).not.toMatch(/playhead|cursor|interaction-area/)
  })

  it('fails clearly when the selected graph has no derived values', () => {
    const track = { ...trackWithSamples(), samples: trackWithSamples().samples.slice(0, 1) }
    const group = selectVisualizationGroup(
      deriveTrackKinematics(track, null),
      'acceleration',
    )
    expect(createGraphSvg(group, track.name, track.color)).toMatchObject({
      ok: false,
    })
  })

  it('supports every existing analysis graph family', () => {
    const track = trackWithSamples()
    const analysis = deriveTrackKinematics(track, null)
    for (const mode of ['position', 'velocity', 'acceleration'] as const) {
      const group = selectVisualizationGroup(analysis, mode)
      const result = createGraphSvg(group, track.name, track.color)
      expect(result.ok, mode).toBe(true)
      if (result.ok) expect(result.svg).toContain(group.axisLabel)
    }
  })
})
