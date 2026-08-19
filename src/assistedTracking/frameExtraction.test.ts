import { describe, expect, it } from 'vitest'

import { displayPointToVideo } from '../video/geometry'
import {
  searchRectForPoint,
  searchRectForPoints,
  searchRectForTracking,
  templateRectForPoint,
} from './frameExtraction'
import { assistedTrackingGeometryFor } from './geometry'
import { recoveryGeometryFor } from './recovery'

describe('assisted frame extraction geometry', () => {
  const nativeSize = { width: 1920, height: 1080 }

  it('creates an odd native-pixel template centered on the seed', () => {
    expect(templateRectForPoint(nativeSize, { x: 960, y: 540 })).toEqual({
      x: 944,
      y: 524,
      width: 33,
      height: 33,
    })
  })

  it('rejects a seed whose template would clip at the video boundary', () => {
    expect(templateRectForPoint(nativeSize, { x: 5, y: 5 })).toBeNull()
  })

  it('bounds the search ROI around the previous native position', () => {
    expect(searchRectForPoint(nativeSize, { x: 960, y: 540 })).toEqual({
      x: 836,
      y: 416,
      width: 249,
      height: 249,
    })
  })

  it('clips a search ROI safely at a native frame edge', () => {
    expect(searchRectForPoint(nativeSize, { x: 12, y: 12 })).toEqual({
      x: 0,
      y: 0,
      width: 137,
      height: 137,
    })
  })

  it('adds a small bounded guard for detecting motion beyond the allowance', () => {
    expect(
      searchRectForPoint(
        nativeSize,
        { x: 960, y: 540 },
        33,
        108 + 6,
      ),
    ).toEqual({ x: 830, y: 410, width: 261, height: 261 })
  })

  it('bounds the union of observed and motion-guided search envelopes', () => {
    expect(
      searchRectForPoints(
        { width: 4096, height: 2160 },
        [{ x: 1000, y: 1000 }, { x: 1150, y: 1000 }],
        63,
        216 + 8,
      ),
    ).toEqual({ x: 745, y: 745, width: 661, height: 511 })
  })

  it('centers an expanded recovery ROI on prediction instead of old position', () => {
    const base = assistedTrackingGeometryFor({ width: 4096, height: 2160 })!
    const recovery = recoveryGeometryFor(base, 1)!
    expect(
      searchRectForTracking(
        { width: 4096, height: 2160 },
        { x: 1000, y: 1000 },
        { x: 1300, y: 1000 },
        recovery,
        1,
      ),
    ).toEqual({ x: 969, y: 669, width: 663, height: 663 })
  })

  it('derives extraction geometry from native coordinates after letterboxing', () => {
    const nativePoint = displayPointToVideo(
      { x: 400, y: 300 },
      { x: 0, y: 75, width: 800, height: 450 },
      nativeSize,
    )
    expect(nativePoint).toEqual({ x: 960, y: 540 })
    const rect = templateRectForPoint(nativeSize, nativePoint!)
    expect(rect?.x).toBe(944)
    expect(rect?.y).toBe(524)
  })

  it('extracts substantially more context around a centered 4K anchor', () => {
    expect(
      templateRectForPoint(
        { width: 4096, height: 2160 },
        { x: 2048, y: 1080 },
      ),
    ).toEqual({ x: 2017, y: 1049, width: 63, height: 63 })
  })

  it('rejects a 4K edge seed rather than clipping or shifting its template', () => {
    expect(
      templateRectForPoint(
        { width: 4096, height: 2160 },
        { x: 20, y: 20 },
      ),
    ).toBeNull()
  })

  it('never returns extraction geometry outside the pixel buffer', () => {
    const edgeSearch = searchRectForPoint(
      { width: 4096, height: 2160 },
      { x: 4088, y: 2152 },
    )
    expect(edgeSearch).not.toBeNull()
    expect(edgeSearch!.x).toBeGreaterThanOrEqual(0)
    expect(edgeSearch!.y).toBeGreaterThanOrEqual(0)
    expect(edgeSearch!.x + edgeSearch!.width).toBeLessThanOrEqual(4096)
    expect(edgeSearch!.y + edgeSearch!.height).toBeLessThanOrEqual(2160)

    expect(
      templateRectForPoint({ width: 16, height: 12 }, { x: 8, y: 6 }),
    ).toBeNull()
  })
})
