import { describe, expect, it } from 'vitest'

import type {
  ChartPlot,
  TimeDomain,
  VisualizationSeries,
} from './types'
import {
  createChartLayout,
  createTimeDomain,
  markerRadiusForSampleCount,
  mediaTimeToSvgX,
  svgXToMediaTime,
} from './chart'

const plot: ChartPlot = { left: 50, top: 10, right: 450, bottom: 210 }
const domain: TimeDomain = { min: 2, max: 10, sourceMin: 2, sourceMax: 10 }

function series(
  key: VisualizationSeries['key'],
  points: VisualizationSeries['points'],
): VisualizationSeries {
  return { key, label: key, marker: 'circle', points }
}

describe('analysis chart layout', () => {
  it('uses the full source timeline as a shared domain for every series', () => {
    const layout = createChartLayout(
      [series('acceleration-x', [{ sampleId: 'middle', time: 1, value: 4 }])],
      [
        { sampleId: 'start', time: 0 },
        { sampleId: 'middle', time: 1 },
        { sampleId: 'end', time: 5 },
      ],
      600,
      260,
    )
    expect(layout).toMatchObject({
      timeMin: 0,
      timeMax: 5,
      sourceTimeMin: 0,
      sourceTimeMax: 5,
    })
    expect(layout?.series[0]?.points[0]?.x).toBeLessThan(300)
  })

  it('shares a value domain across multiple positive and negative series', () => {
    const layout = createChartLayout(
      [
        series('position-x', [
          { sampleId: 'a', time: 0, value: -3 },
          { sampleId: 'b', time: 1, value: 2 },
        ]),
        series('position-y', [
          { sampleId: 'a', time: 0, value: 5 },
          { sampleId: 'b', time: 1, value: -1 },
        ]),
      ],
      [{ sampleId: 'a', time: 0 }, { sampleId: 'b', time: 1 }],
      600,
      260,
    )
    expect(layout?.valueMin).toBeLessThan(0)
    expect(layout?.valueMax).toBeGreaterThan(0)
    expect(layout?.series.map((item) => item.points.length)).toEqual([2, 2])
  })

  it('expands constant and single-sample domains without collapsed axes', () => {
    const layout = createChartLayout(
      [series('position-x', [{ sampleId: 'only', time: 2, value: 5 }])],
      [{ sampleId: 'only', time: 2 }],
      600,
      260,
    )
    expect(layout?.timeMax).toBeGreaterThan(layout?.timeMin ?? 0)
    expect(layout?.valueMax).toBeGreaterThan(layout?.valueMin ?? 0)
    expect(layout?.series[0]?.points[0]?.x).toBeTypeOf('number')
    expect(layout?.series[0]?.points[0]?.y).toBeTypeOf('number')

    const nearlyIdentical = createTimeDomain([
      { sampleId: 'a', time: 1 },
      { sampleId: 'b', time: 1 + 1e-12 },
    ])
    expect(nearlyIdentical?.max).toBeGreaterThan(nearlyIdentical?.min ?? 0)
  })

  it('preserves sparse irregular timestamp spacing', () => {
    const layout = createChartLayout(
      [series('position-x', [
        { sampleId: 'a', time: 0, value: 0 },
        { sampleId: 'b', time: 0.5, value: 1 },
        { sampleId: 'c', time: 3, value: 2 },
      ])],
      [
        { sampleId: 'a', time: 0 },
        { sampleId: 'b', time: 0.5 },
        { sampleId: 'c', time: 3 },
      ],
      600,
      260,
    )
    if (layout === null) throw new Error('layout should exist')
    const points = layout.series[0]!.points
    const firstSpan = points[1]!.x - points[0]!.x
    const secondSpan = points[2]!.x - points[1]!.x
    expect(secondSpan / firstSpan).toBeCloseTo(5)
  })

  it('keeps dense samples and applies deterministic marker sizing', () => {
    const timeline = Array.from({ length: 120 }, (_, index) => ({
      sampleId: `sample-${index}`,
      time: index / 10,
    }))
    const layout = createChartLayout(
      [series('speed', timeline.map((point, index) => ({ ...point, value: index })))],
      timeline,
      900,
      300,
    )
    expect(layout?.series[0]?.points).toHaveLength(120)
    expect(markerRadiusForSampleCount(24)).toBe(5)
    expect(markerRadiusForSampleCount(25)).toBe(4)
    expect(markerRadiusForSampleCount(80)).toBe(4)
    expect(markerRadiusForSampleCount(81)).toBe(3)
  })

  it('excludes invalid points and rejects unusable dimensions safely', () => {
    const layout = createChartLayout(
      [series('position-x', [
        { sampleId: 'valid', time: 0, value: 1 },
        { sampleId: 'nan', time: 1, value: Number.NaN },
        { sampleId: 'infinite', time: 1, value: Number.POSITIVE_INFINITY },
        { sampleId: 'outside', time: 3, value: 2 },
      ])],
      [
        { sampleId: 'valid', time: 0 },
        { sampleId: 'end', time: 1 },
        { sampleId: 'bad', time: Number.NaN },
        { sampleId: 'negative', time: -1 },
      ],
      600,
      260,
    )
    expect(layout?.series[0]?.points.map((point) => point.sampleId)).toEqual(['valid'])
    expect(createChartLayout([], [], 600, 260)).toBeNull()
    expect(createChartLayout([], [{ sampleId: 'a', time: 0 }], 80, 60)).toBeNull()
    expect(createChartLayout(
      [series('position-x', [{ sampleId: 'huge', time: 0, value: Number.MAX_VALUE }])],
      [{ sampleId: 'huge', time: 0 }],
      600,
      260,
    )).toBeNull()
  })
})

describe('analysis time mapping', () => {
  it('maps start, midpoint, and end in both directions', () => {
    expect(mediaTimeToSvgX(2, domain, plot)).toBe(50)
    expect(mediaTimeToSvgX(6, domain, plot)).toBe(250)
    expect(mediaTimeToSvgX(10, domain, plot)).toBe(450)
    expect(svgXToMediaTime(50, domain, plot)).toBe(2)
    expect(svgXToMediaTime(250, domain, plot)).toBe(6)
    expect(svgXToMediaTime(450, domain, plot)).toBe(10)
  })

  it('clamps outside values and round-trips finite inputs', () => {
    expect(mediaTimeToSvgX(-100, domain, plot)).toBe(50)
    expect(mediaTimeToSvgX(100, domain, plot)).toBe(450)
    expect(svgXToMediaTime(-100, domain, plot)).toBe(2)
    expect(svgXToMediaTime(900, domain, plot)).toBe(10)
    for (const time of [2, 3.25, 6, 9.5, 10]) {
      const x = mediaTimeToSvgX(time, domain, plot)
      expect(x).not.toBeNull()
      expect(svgXToMediaTime(x!, domain, plot)).toBeCloseTo(time)
    }
  })

  it('handles degenerate domains and invalid input without non-finite output', () => {
    const degenerate = { min: 4, max: 4, sourceMin: 4, sourceMax: 4 }
    expect(mediaTimeToSvgX(4, degenerate, plot)).toBe(250)
    expect(svgXToMediaTime(250, degenerate, plot)).toBe(4)
    expect(mediaTimeToSvgX(Number.NaN, domain, plot)).toBeNull()
    expect(svgXToMediaTime(Number.POSITIVE_INFINITY, domain, plot)).toBeNull()
  })
})
