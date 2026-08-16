import { describe, expect, it } from 'vitest'

import {
  displayPointToVideo,
  getContainedContentRect,
  videoPointToDisplay,
} from './geometry'

describe('getContainedContentRect', () => {
  it('adds vertical letterboxing when a widescreen video is in a 4:3 stage', () => {
    expect(
      getContainedContentRect(
        { width: 800, height: 600 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 0, y: 75, width: 800, height: 450 })
  })

  it('adds horizontal letterboxing for portrait video', () => {
    expect(
      getContainedContentRect(
        { width: 900, height: 600 },
        { width: 1080, height: 1920 },
      ),
    ).toEqual({ x: 281.25, y: 0, width: 337.5, height: 600 })
  })

  it('returns an empty rectangle while dimensions are unavailable', () => {
    expect(
      getContainedContentRect(
        { width: 800, height: 0 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('coordinate conversion', () => {
  const contentRect = { x: 0, y: 75, width: 800, height: 450 }
  const nativeSize = { width: 1920, height: 1080 }

  it('maps the displayed center to the native-video center', () => {
    expect(
      displayPointToVideo({ x: 400, y: 300 }, contentRect, nativeSize),
    ).toEqual({ x: 960, y: 540 })
  })

  it('rejects points in the letterbox region', () => {
    expect(
      displayPointToVideo({ x: 400, y: 20 }, contentRect, nativeSize),
    ).toBeNull()
  })

  it('includes media boundaries', () => {
    expect(
      displayPointToVideo({ x: 800, y: 525 }, contentRect, nativeSize),
    ).toEqual({ x: 1920, y: 1080 })
  })

  it('round-trips native points through display coordinates', () => {
    const nativePoint = { x: 321.25, y: 987.5 }
    const displayed = videoPointToDisplay(nativePoint, contentRect, nativeSize)

    expect(displayed).not.toBeNull()
    const roundTripped = displayPointToVideo(displayed!, contentRect, nativeSize)
    expect(roundTripped).not.toBeNull()
    expect(roundTripped!.x).toBeCloseTo(nativePoint.x, 10)
    expect(roundTripped!.y).toBeCloseTo(nativePoint.y, 10)
  })

  it('rejects native points outside the video', () => {
    expect(
      videoPointToDisplay({ x: -1, y: 200 }, contentRect, nativeSize),
    ).toBeNull()
  })
})
