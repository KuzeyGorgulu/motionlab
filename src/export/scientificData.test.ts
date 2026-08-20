import { describe, expect, it } from 'vitest'

import type { Calibration } from '../calibration/types'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import {
  buildScientificDataRows,
  createScientificCsv,
  createScientificJson,
} from './scientificData'

function track(
  id: string,
  name: string,
  observations: Array<[number, number, number]>,
): Track {
  return {
    id,
    name,
    color: '#4ecdc4',
    samples: observations.map(([time, x, y], index) => ({
      id: `${id}-sample-${index + 1}`,
      time,
      frame: createFrameReference(time),
      nativePosition: { x, y },
    })),
  }
}

const CALIBRATION: Calibration = {
  referenceA: { x: 0, y: 0 },
  referenceB: { x: 100, y: 0 },
  knownDistance: 2,
  unit: 'm',
  origin: { x: 0, y: 0 },
  originSource: 'reference-a',
  xAxis: { x: 1, y: 0 },
  axisSource: 'reference',
}

describe('scientific data export', () => {
  it('exports stable columns, pixel values, pixel units, and empty unavailable acceleration', () => {
    const result = createScientificCsv(
      [track('track-1', 'Ball', [[0, 10, 20], [1, 20, 20]])],
      null,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [header, firstRow] = result.value.trimEnd().split('\n')
    expect(header).toContain('track_id,track_name,sample_id,time_s')
    expect(header).toContain('x_px,y_px,position_space,position_unit')
    expect(firstRow).toContain(',10,20,pixel,px,10,20,px/s,10,0,10,px/s²,,')
  })

  it('uses existing calibrated kinematics and explicit world units', () => {
    const rows = buildScientificDataRows(
      [track('track-1', 'Ball', [[0, 0, 0], [1, 100, 0], [2, 200, 0]])],
      CALIBRATION,
    )
    expect(rows[1]).toMatchObject({
      xPixels: 100,
      positionSpace: 'world',
      positionUnit: 'm',
      xPosition: 2,
      yPosition: 0,
      velocityUnit: 'm/s',
      velocityX: 2,
      accelerationUnit: 'm/s²',
      accelerationX: 0,
    })
  })

  it('combines multiple tracks in chronological order using stable IDs', () => {
    const rows = buildScientificDataRows(
      [
        track('track-b', 'Second', [[0.2, 2, 2]]),
        track('track-a', 'First', [[0.1, 1, 1]]),
      ],
      null,
    )
    expect(rows.map((row) => row.trackId)).toEqual(['track-a', 'track-b'])
  })

  it('escapes commas, quotes, and line breaks in track names', () => {
    const result = createScientificCsv(
      [track('track-1', 'Ball, "upper"\ntrial', [[0, 1, 2]])],
      null,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toContain('"Ball, ""upper""\ntrial"')
  })

  it('leaves derivative values unavailable instead of exporting fake zeros', () => {
    const rows = buildScientificDataRows(
      [track('track-1', 'Single', [[0, 1, 2]])],
      null,
    )
    expect(rows[0]).toMatchObject({
      velocityX: null,
      velocityY: null,
      speed: null,
      accelerationX: null,
      accelerationY: null,
      accelerationMagnitude: null,
    })
  })

  it('returns a useful error for empty track export', () => {
    expect(createScientificCsv([], null)).toMatchObject({ ok: false })
    expect(
      createScientificJson({ name: 'test.mp4' }, [], [], null),
    ).toMatchObject({ ok: false })
  })

  it('exports human-readable JSON separately from workspace persistence', () => {
    const result = createScientificJson(
      { name: 'test.mp4', width: 100, height: 100 },
      [],
      [track('track-1', 'Ball', [[0, 1, 2]])],
      null,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsed = JSON.parse(result.value) as Record<string, unknown>
    expect(parsed).toMatchObject({ format: 'motionlab-data', version: 1 })
    expect(parsed).not.toHaveProperty('workspace')
  })
})
