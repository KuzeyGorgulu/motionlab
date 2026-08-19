import { describe, expect, it } from 'vitest'

import { createTrackSample } from '../tracking/model'
import { createFrameReference } from '../video/frameReference'
import { assistedTrackingGeometryFor } from './geometry'
import { motionSearchHint } from './motionGuidance'
import { locateTemplate } from './templateTracker'
import type { GrayImage } from './types'
import type { Point } from '../video/geometry'

const NATIVE_SIZE = { width: 4096, height: 2160 }
const GEOMETRY = assistedTrackingGeometryFor(NATIVE_SIZE)!

function grayImage(width: number, height: number, fill = 23): GrayImage {
  return { width, height, pixels: new Uint8Array(width * height).fill(fill) }
}

function templateFixture(): GrayImage {
  const size = GEOMETRY.templateSize
  const image = grayImage(size, size, 0)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      image.pixels[y * size + x] =
        (x * 13 + y * 17 + Math.floor(x / 5) * 31 +
          Math.floor(y / 3) * 43) % 256
    }
  }
  return image
}

function paste(target: GrayImage, source: GrayImage, left: number, top: number) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      target.pixels[(top + y) * target.width + left + x] =
        source.pixels[y * source.width + x]!
    }
  }
}

function visualMatch(
  previousAnchor: Point,
  searchCenter: Point,
  actualCenter: Point | null,
) {
  const template = templateFixture()
  const half = (template.width - 1) / 2
  const radiusWithGuard =
    GEOMETRY.nativeSearchRadius + GEOMETRY.refinementRadius
  const roundedPrevious = {
    x: Math.round(previousAnchor.x),
    y: Math.round(previousAnchor.y),
  }
  const roundedSearchCenter = {
    x: Math.round(searchCenter.x),
    y: Math.round(searchCenter.y),
  }
  const origin = {
    x: Math.min(roundedPrevious.x, roundedSearchCenter.x) -
      half - radiusWithGuard,
    y: Math.min(roundedPrevious.y, roundedSearchCenter.y) -
      half - radiusWithGuard,
  }
  const search = grayImage(
    Math.abs(roundedSearchCenter.x - roundedPrevious.x) +
      template.width + radiusWithGuard * 2,
    Math.abs(roundedSearchCenter.y - roundedPrevious.y) +
      template.height + radiusWithGuard * 2,
  )
  if (actualCenter !== null) {
    paste(
      search,
      template,
      actualCenter.x - origin.x - half,
      actualCenter.y - origin.y - half,
    )
  }
  return locateTemplate(template, search, {
    origin,
    expectedTemplateCenter: previousAnchor,
    searchCenter: {
      x: roundedSearchCenter.x,
      y: roundedSearchCenter.y,
    },
    geometry: GEOMETRY,
  })
}

describe('observation-based motion search guidance', () => {
  it('uses the last observation without prediction on the first assisted frame', () => {
    const hint = motionSearchHint(
      [{ position: { x: 100, y: 200 }, time: 1 }],
      1 + 1 / 30,
      NATIVE_SIZE,
      GEOMETRY.nativeSearchRadius,
    )!
    expect(hint.searchCenter).toEqual({ x: 100, y: 200 })
    expect(hint.usedMotionGuidance).toBe(false)
  })

  it('predicts constant observed motion for the search center only', () => {
    const hint = motionSearchHint(
      [
        { position: { x: 100, y: 300 }, time: 0 },
        { position: { x: 170, y: 300 }, time: 1 / 30 },
      ],
      2 / 30,
      NATIVE_SIZE,
      GEOMETRY.nativeSearchRadius,
    )!
    expect(hint.usedMotionGuidance).toBe(true)
    expect(hint.predictedDisplacement).toEqual({ x: 70, y: 0 })
    expect(hint.searchCenter).toEqual({ x: 240, y: 300 })
  })

  it('scales the hint for irregular but valid timestamp spacing', () => {
    const hint = motionSearchHint(
      [
        { position: { x: 400, y: 500 }, time: 1 },
        { position: { x: 460, y: 500 }, time: 1.04 },
      ],
      1.06,
      NATIVE_SIZE,
      GEOMETRY.nativeSearchRadius,
    )!
    expect(hint.predictedDisplacement?.x).toBeCloseTo(30)
    expect(hint.searchCenter.x).toBeCloseTo(490)
  })

  it('falls back to the last observation for invalid timing', () => {
    const hint = motionSearchHint(
      [
        { position: { x: 400, y: 500 }, time: 1 },
        { position: { x: 460, y: 500 }, time: 1 },
      ],
      1.03,
      NATIVE_SIZE,
      GEOMETRY.nativeSearchRadius,
    )!
    expect(hint.usedMotionGuidance).toBe(false)
    expect(hint.searchCenter).toEqual({ x: 460, y: 500 })
    expect(hint.reason).toBe('invalid-timing')
  })

  it('bounds an extreme finite hint to the search policy', () => {
    const hint = motionSearchHint(
      [
        { position: { x: 1000, y: 1000 }, time: 0 },
        { position: { x: 2000, y: 1000 }, time: 1 / 30 },
      ],
      2 / 30,
      NATIVE_SIZE,
      GEOMETRY.nativeSearchRadius,
    )!
    expect(hint.usedMotionGuidance).toBe(true)
    expect(Math.hypot(
      hint.predictedDisplacement!.x,
      hint.predictedDisplacement!.y,
    )).toBe(GEOMETRY.nativeSearchRadius)
    expect(hint.reason).toBe('bounded-motion')
  })

  it('falls back when the predicted center lies implausibly beyond the frame', () => {
    const hint = motionSearchHint(
      [
        { position: { x: -20, y: 100 }, time: 0 },
        { position: { x: -40, y: 100 }, time: 1 / 30 },
      ],
      2 / 30,
      { width: 40, height: 200 },
      30,
    )!
    expect(hint.usedMotionGuidance).toBe(false)
    expect(hint.searchCenter).toEqual({ x: -40, y: 100 })
    expect(hint.reason).toBe('prediction-outside-frame')
  })

  it('uses prediction only to find an image-confirmed constant-motion sample', () => {
    const previous = { x: 1070, y: 900 }
    const hint = motionSearchHint(
      [
        { position: { x: 1000, y: 900 }, time: 0 },
        { position: previous, time: 1 / 30 },
      ],
      2 / 30,
      NATIVE_SIZE,
      GEOMETRY.nativeSearchRadius,
    )!
    const actual = { x: 1140, y: 900 }
    const result = visualMatch(previous, hint.searchCenter, actual)
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual({ x: 70, y: 0 })
  })

  it('does not create a sample when the predicted target is absent', () => {
    const previous = { x: 1070, y: 900 }
    const hint = motionSearchHint(
      [
        { position: { x: 1000, y: 900 }, time: 0 },
        { position: previous, time: 1 / 30 },
      ],
      2 / 30,
      NATIVE_SIZE,
      GEOMETRY.nativeSearchRadius,
    )!
    const result = visualMatch(previous, hint.searchCenter, null)
    const sample = result.status === 'match'
      ? createTrackSample(
          'predicted-only',
          createFrameReference(2 / 30),
          {
            x: previous.x + result.displacement.x,
            y: previous.y + result.displacement.y,
          },
        )
      : null
    expect(result.status).toBe('low-confidence')
    expect(sample).toBeNull()
  })

  it('recovers a sudden reversal inside the observation-centered envelope', () => {
    const previous = { x: 1150, y: 900 }
    const hint = motionSearchHint(
      [
        { position: { x: 1000, y: 900 }, time: 0 },
        { position: previous, time: 1 / 30 },
      ],
      2 / 30,
      NATIVE_SIZE,
      GEOMETRY.nativeSearchRadius,
    )!
    expect(hint.searchCenter).toEqual({ x: 1300, y: 900 })
    const result = visualMatch(previous, hint.searchCenter, { x: 1000, y: 900 })
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual({ x: -150, y: 0 })
  })

  it('recovers acceleration by matching the image rather than the hint', () => {
    const previous = { x: 1060, y: 900 }
    const hint = motionSearchHint(
      [
        { position: { x: 1020, y: 900 }, time: 1 / 30 },
        { position: previous, time: 2 / 30 },
      ],
      3 / 30,
      NATIVE_SIZE,
      GEOMETRY.nativeSearchRadius,
    )!
    expect(hint.searchCenter.x).toBe(1100)
    const result = visualMatch(previous, hint.searchCenter, { x: 1130, y: 900 })
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual({ x: 70, y: 0 })
  })
})
