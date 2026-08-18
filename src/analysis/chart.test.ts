import { describe, expect, it } from 'vitest'

import { createChartLayout } from './chart'

describe('analysis chart layout', () => {
  it('places samples by true timestamp rather than array index', () => {
    const layout = createChartLayout(
      [
        { sampleId: 'a', time: 0, value: 0 },
        { sampleId: 'b', time: 1, value: 1 },
        { sampleId: 'c', time: 3, value: 2 },
      ],
      400,
      180,
    )
    if (layout === null) throw new Error('layout should exist')
    const firstSpan = layout.points[1]!.x - layout.points[0]!.x
    const secondSpan = layout.points[2]!.x - layout.points[1]!.x
    expect(secondSpan / firstSpan).toBeCloseTo(2)
  })

  it('sorts non-monotonic input and expands constant ranges safely', () => {
    const layout = createChartLayout(
      [
        { sampleId: 'later', time: 2, value: 5 },
        { sampleId: 'earlier', time: 2, value: 5 },
      ],
      400,
      180,
    )
    expect(layout?.points.map((point) => point.sampleId)).toEqual([
      'earlier',
      'later',
    ])
    expect(layout?.timeMax).toBeGreaterThan(layout?.timeMin ?? 0)
    expect(layout?.valueMax).toBeGreaterThan(layout?.valueMin ?? 0)
  })

  it('returns null for missing data or invalid dimensions', () => {
    expect(createChartLayout([], 400, 180)).toBeNull()
    expect(
      createChartLayout([{ sampleId: 'a', time: 0, value: 0 }], 0, 180),
    ).toBeNull()
  })
})
