import { describe, expect, it } from 'vitest'

import { createCalibration } from '../calibration/model'
import { createTrack, createTrackSample } from '../tracking/model'
import { createFrameReference } from '../video/frameReference'
import { deriveTrackKinematics } from './kinematics'
import { selectVisualizationGroup } from './series'

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

describe('analysis visualization groups', () => {
  const analysis = deriveTrackKinematics(track, null)

  it('builds Position with exact X/Y samples and the source timeline', () => {
    const group = selectVisualizationGroup(analysis, 'position')
    expect(group).toMatchObject({
      mode: 'position',
      label: 'Position',
      axisLabel: 'Position',
      unit: 'px',
    })
    expect(group.series.map((series) => [series.key, series.label, series.marker])).toEqual([
      ['position-x', 'X', 'circle'],
      ['position-y', 'Y', 'square'],
    ])
    expect(group.series[0]?.points).toEqual([
      { sampleId: 'sample-0', time: 0, value: 0 },
      { sampleId: 'sample-1', time: 1, value: 2 },
      { sampleId: 'sample-2', time: 2, value: 4 },
    ])
    expect(group.timeline).toEqual([
      { sampleId: 'sample-0', time: 0 },
      { sampleId: 'sample-1', time: 1 },
      { sampleId: 'sample-2', time: 2 },
    ])
  })

  it('builds Velocity with vx, vy, and Speed in one dimensional unit', () => {
    const group = selectVisualizationGroup(analysis, 'velocity')
    expect(group.unit).toBe('px/s')
    expect(group.series.map((series) => series.key)).toEqual([
      'velocity-x',
      'velocity-y',
      'speed',
    ])
    expect(group.series.every((series) => series.points.length === 3)).toBe(true)
    expect(group.series[0]?.points[1]).toMatchObject({
      sampleId: 'sample-1',
      time: 1,
      value: 2,
    })
  })

  it('builds Acceleration components and omits unavailable endpoints', () => {
    const group = selectVisualizationGroup(analysis, 'acceleration')
    expect(group.unit).toBe('px/s²')
    expect(group.series.map((series) => series.key)).toEqual([
      'acceleration-x',
      'acceleration-y',
      'acceleration',
    ])
    for (const series of group.series) {
      expect(series.points).toHaveLength(1)
      expect(series.points[0]).toMatchObject({ sampleId: 'sample-1', time: 1 })
    }
    expect(group.timeline).toHaveLength(3)
  })

  it('propagates calibrated position, velocity, and acceleration units', () => {
    const result = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 10, y: 0 },
      knownDistance: 2,
      unit: 'cm',
    })
    if (!result.ok) throw new Error('calibration fixture should be valid')
    const calibrated = deriveTrackKinematics(track, result.calibration)

    expect(selectVisualizationGroup(calibrated, 'position').unit).toBe('cm')
    expect(selectVisualizationGroup(calibrated, 'velocity').unit).toBe('cm/s')
    expect(selectVisualizationGroup(calibrated, 'acceleration').unit).toBe('cm/s²')
  })
})
