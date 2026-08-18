import { describe, expect, it } from 'vitest'

import { createTrack, createTrackSample } from '../tracking/model'
import { createFrameReference } from '../video/frameReference'
import { deriveTrackKinematics } from './kinematics'
import { selectGraphSeries } from './series'

const track = {
  ...createTrack('track-1', 'Ball', '#4ecdc4')!,
  samples: [0, 1, 2].map((time, index) =>
    createTrackSample(
      `sample-${index}`,
      createFrameReference(time),
      { x: time * 2, y: time * time },
    )!,
  ),
}

describe('analysis graph series', () => {
  const analysis = deriveTrackKinematics(track, null)

  it('selects x and y positions at exact sample timestamps', () => {
    expect(selectGraphSeries(analysis, 'position-x').points).toEqual([
      { sampleId: 'sample-0', time: 0, value: 0 },
      { sampleId: 'sample-1', time: 1, value: 2 },
      { sampleId: 'sample-2', time: 2, value: 4 },
    ])
    expect(selectGraphSeries(analysis, 'position-y').points[2]?.value).toBe(4)
  })

  it('propagates dimensional units for each quantity', () => {
    expect(selectGraphSeries(analysis, 'position-x').unit).toBe('px')
    expect(selectGraphSeries(analysis, 'position-x').axisLabel).toBe('X')
    expect(selectGraphSeries(analysis, 'speed').unit).toBe('px/s')
    expect(selectGraphSeries(analysis, 'acceleration').unit).toBe('px/s²')
    expect(selectGraphSeries(analysis, 'acceleration').axisLabel).toBe('|a|')
  })

  it('omits unavailable acceleration endpoints instead of inventing values', () => {
    const acceleration = selectGraphSeries(analysis, 'acceleration')
    expect(acceleration.points).toHaveLength(1)
    expect(acceleration.points[0]?.sampleId).toBe('sample-1')
  })
})
