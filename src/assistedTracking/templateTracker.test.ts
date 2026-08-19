import { describe, expect, it } from 'vitest'

import { createTrackSample } from '../tracking/model'
import { createFrameReference } from '../video/frameReference'
import { assistedTrackingGeometryFor } from './geometry'
import type { GrayImage } from './types'
import {
  applyTrackedDisplacement,
  estimateMatcherWork,
  grayscaleFromRgba,
  locateTemplate,
  matcherSearchPolicy,
  matchTemplate,
} from './templateTracker'

const PATTERN = new Uint8Array([
  0, 30, 220, 60, 250,
  210, 40, 120, 245, 15,
  70, 235, 10, 180, 90,
  255, 80, 200, 25, 150,
  35, 170, 100, 230, 5,
])

const GEOMETRY_1080 = assistedTrackingGeometryFor({
  width: 1920,
  height: 1080,
})!
const GEOMETRY_4K = assistedTrackingGeometryFor({
  width: 4096,
  height: 2160,
})!

function grayImage(width: number, height: number, fill = 128): GrayImage {
  return { width, height, pixels: new Uint8Array(width * height).fill(fill) }
}

function templateFixture(): GrayImage {
  return { width: 5, height: 5, pixels: new Uint8Array(PATTERN) }
}

function paste(search: GrayImage, template: GrayImage, left: number, top: number) {
  for (let y = 0; y < template.height; y += 1) {
    for (let x = 0; x < template.width; x += 1) {
      search.pixels[(top + y) * search.width + left + x] =
        template.pixels[y * template.width + x]!
    }
  }
}

function crop(
  source: GrayImage,
  left: number,
  top: number,
  width: number,
  height: number,
): GrayImage {
  const result = grayImage(width, height, 0)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      result.pixels[y * width + x] =
        source.pixels[(top + y) * source.width + left + x]!
    }
  }
  return result
}

function deterministicPattern(size: number): GrayImage {
  const image = grayImage(size, size, 0)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      image.pixels[y * size + x] = (x * 47 + y * 73 + x * y * 3) % 256
    }
  }
  return image
}

function flatCenterObject(size: number): GrayImage {
  const image = grayImage(size, size, 32)
  const center = (size - 1) / 2
  const radius = center - 2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center)
      if (distance <= radius) image.pixels[y * size + x] = 154
      if (distance > radius - 3 && distance <= radius) {
        image.pixels[y * size + x] = 222
      }
      if (distance > 17 && distance < 23 && Math.abs(x - center - 8) < 2) {
        image.pixels[y * size + x] = 24
      }
    }
  }
  return image
}

describe('template matching', () => {
  it('finds an identical template at the same native position', () => {
    const template = templateFixture()
    const search = grayImage(13, 13)
    paste(search, template, 4, 4)
    const result = matchTemplate(template, search)
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.matchedCenter).toEqual({ x: 6, y: 6 })
    expect(result.score).toBe(0)
  })

  it('finds a known translated target in native coordinates', () => {
    const template = templateFixture()
    const search = grayImage(15, 14, 100)
    paste(search, template, 8, 6)
    const result = matchTemplate(template, search, { x: 120, y: 75 })
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.matchedCenter).toEqual({ x: 130, y: 83 })
  })

  it('handles a strong target at the search-region boundary', () => {
    const template = templateFixture()
    const search = grayImage(13, 13, 110)
    paste(search, template, 0, 0)
    const result = matchTemplate(template, search, { x: 10, y: 20 })
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.matchedCenter).toEqual({ x: 12, y: 22 })
  })

  it('ignores deterministic noise around a preserved target', () => {
    const template = templateFixture()
    const search = grayImage(15, 15)
    for (let index = 0; index < search.pixels.length; index += 1) {
      search.pixels[index] = (index * 37 + 19) % 256
    }
    paste(search, template, 5, 7)
    const result = matchTemplate(template, search)
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.matchedCenter).toEqual({ x: 7, y: 9 })
  })

  it('rejects a featureless template', () => {
    const result = matchTemplate(grayImage(5, 5, 90), grayImage(13, 13, 90))
    expect(result.status).toBe('low-confidence')
    if (result.status !== 'low-confidence') return
    expect(result.reason).toMatch(/featureless/i)
  })

  it('rejects ambiguous duplicate candidates', () => {
    const template = templateFixture()
    const search = grayImage(18, 10)
    paste(search, template, 1, 2)
    paste(search, template, 12, 2)
    const result = matchTemplate(template, search)
    expect(result.status).toBe('low-confidence')
    if (result.status !== 'low-confidence') return
    expect(result.reason).toMatch(/equally plausible/i)
  })

  it('rejects invalid dimensions and data lengths', () => {
    const result = matchTemplate(
      { width: 5, height: 5, pixels: new Uint8Array(3) },
      grayImage(10, 10),
    )
    expect(result.status).toBe('invalid-frame')
  })

  it('rejects a truncated RGBA region without reading beyond its buffer', () => {
    expect(
      grayscaleFromRgba({
        width: 63,
        height: 63,
        origin: { x: 0, y: 0 },
        pixels: new Uint8ClampedArray(63 * 63 * 4 - 1),
      }),
    ).toBeNull()
  })

  it('is deterministic and does not mutate either input', () => {
    const template = templateFixture()
    const search = grayImage(13, 13, 77)
    paste(search, template, 6, 3)
    const templateBefore = new Uint8Array(template.pixels)
    const searchBefore = new Uint8Array(search.pixels)

    expect(matchTemplate(template, search)).toEqual(matchTemplate(template, search))
    expect(template.pixels).toEqual(templateBefore)
    expect(search.pixels).toEqual(searchBefore)
  })

  it('uses bounded coarse-to-fine matching for adaptive 4K geometry', () => {
    const template = deterministicPattern(63)
    const search = grayImage(231, 231, 91)
    paste(search, template, 121, 55)
    const templateBefore = new Uint8Array(template.pixels)
    const searchBefore = new Uint8Array(search.pixels)

    expect(matcherSearchPolicy(template, search)).toEqual({
      candidateStep: 1,
      pixelStep: 4,
      maximumRefinementSeeds: 12,
    })
    const result = matchTemplate(template, search)
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.matchedCenter).toEqual({ x: 152, y: 86 })
    expect(template.pixels).toEqual(templateBefore)
    expect(search.pixels).toEqual(searchBefore)
  })

  it('caps the 4K matcher below half of full exhaustive work', () => {
    const template = grayImage(63, 63)
    const guardedSearch = grayImage(239, 239)
    const estimate = estimateMatcherWork(template, guardedSearch)
    const exhaustiveComparisons = 177 * 177 * 63 * 63

    expect(estimate.maximumTotalPixelComparisons).toBeLessThan(
      exhaustiveComparisons / 2,
    )
    expect(estimate.maximumTotalPixelComparisons).toBeLessThan(32_000_000)
  })

  it('refines a non-grid coarse candidate to the exact native pixel', () => {
    const template = deterministicPattern(63)
    const search = grayImage(231, 231, 117)
    paste(search, template, 123, 58)

    const result = matchTemplate(template, search)
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.matchedCenter).toEqual({ x: 154, y: 89 })
  })

  it('keeps coarse-to-fine ambiguity rejection for repeated targets', () => {
    const template = deterministicPattern(63)
    const search = grayImage(250, 150, 84)
    paste(search, template, 21, 43)
    paste(search, template, 164, 43)

    const result = matchTemplate(template, search)
    expect(result.status).toBe('low-confidence')
    if (result.status !== 'low-confidence') return
    expect(result.reason).toMatch(/equally plausible/i)
  })

  it('tracks beyond the former 24 px radius within the 1080p policy', () => {
    const template = deterministicPattern(33)
    const search = grayImage(117, 117, 100)
    paste(search, template, 72, 15)
    const result = locateTemplate(template, search, {
      origin: { x: 100, y: 200 },
      expectedTemplateCenter: { x: 158, y: 258 },
      searchCenter: { x: 158, y: 258 },
      geometry: GEOMETRY_1080,
    })

    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual({ x: 30, y: -27 })
  })

  it('tracks beyond the former 42 px 1080p search radius', () => {
    const template = deterministicPattern(33)
    const search = grayImage(125, 125, 100)
    paste(search, template, 89, 46)
    const result = locateTemplate(template, search, {
      origin: { x: 96, y: 196 },
      expectedTemplateCenter: { x: 158, y: 258 },
      searchCenter: { x: 158, y: 258 },
      geometry: GEOMETRY_1080,
    })

    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual({ x: 43, y: 0 })
  })

  it('accepts an exact target at the adaptive search boundary', () => {
    const template = deterministicPattern(33)
    const search = grayImage(117, 117, 100)
    paste(search, template, 84, 0)
    const result = locateTemplate(template, search, {
      origin: { x: 100, y: 200 },
      expectedTemplateCenter: { x: 158, y: 258 },
      searchCenter: { x: 158, y: 258 },
      geometry: GEOMETRY_1080,
    })

    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual({ x: 42, y: -42 })
  })

  it('preserves the physical anchor while tracking an off-center visual feature', () => {
    const template = flatCenterObject(63)
    const search = grayImage(231, 231, 32)
    paste(search, template, 121, 55)
    const result = locateTemplate(template, search, {
      origin: { x: 385, y: 186 },
      expectedTemplateCenter: { x: 500, y: 301 },
      searchCenter: { x: 500, y: 301 },
      geometry: GEOMETRY_4K,
    })

    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual({ x: 37, y: -29 })
    const previousAnchor = { x: 500.25, y: 300.75 }
    const nextAnchor = applyTrackedDisplacement(
      previousAnchor,
      result.displacement,
    )
    expect(nextAnchor).toEqual({ x: 537.25, y: 271.75 })
    const sample = createTrackSample(
      'translated-anchor',
      createFrameReference(1),
      nextAnchor!,
    )
    expect(sample).not.toBeNull()
    if (sample === null) return
    expect(sample.nativePosition.x - previousAnchor.x).toBe(37)
    expect(sample.nativePosition.y - previousAnchor.y).toBe(-29)
  })

  it('regresses the 4K flat-center ball seed with adaptive context', () => {
    const adaptiveTemplate = flatCenterObject(63)
    const oldTemplate = crop(adaptiveTemplate, 21, 21, 21, 21)
    const oldSearch = grayImage(69, 69, 32)
    paste(oldSearch, oldTemplate, 24, 24)
    const adaptiveSearch = grayImage(231, 231, 32)
    paste(adaptiveSearch, adaptiveTemplate, 84, 84)

    const oldResult = matchTemplate(oldTemplate, oldSearch)
    expect(oldResult.status).toBe('low-confidence')
    if (oldResult.status === 'low-confidence') {
      expect(oldResult.reason).toMatch(/featureless/i)
    }

    const adaptiveResult = matchTemplate(adaptiveTemplate, adaptiveSearch)
    expect(adaptiveResult.status).toBe('match')
    if (adaptiveResult.status !== 'match') return
    expect(adaptiveResult.matchedCenter).toEqual({ x: 115, y: 115 })
  })

  it('still rejects a genuinely flat adaptive template', () => {
    const result = matchTemplate(grayImage(63, 63, 90), grayImage(231, 231, 90))
    expect(result.status).toBe('low-confidence')
    if (result.status !== 'low-confidence') return
    expect(result.reason).toMatch(/featureless/i)
  })
})
