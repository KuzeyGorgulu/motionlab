import { describe, expect, it } from 'vitest'

import { searchRectForPoint } from './frameExtraction'
import { assistedTrackingGeometryFor } from './geometry'
import {
  downsampleGrayImage,
  estimateCoarseToFineWork,
  locateTemplate,
  matchTemplate,
  matchTemplateCoarseToFine,
} from './templateTracker'
import type {
  AssistedTrackingGeometry,
  GrayImage,
  SearchPixelRegion,
} from './types'
import type { Point, Size } from '../video/geometry'

const GEOMETRY_4K = assistedTrackingGeometryFor({
  width: 4096,
  height: 2160,
})!

function grayImage(width: number, height: number, fill = 17): GrayImage {
  return { width, height, pixels: new Uint8Array(width * height).fill(fill) }
}

function texturedTarget(size: number): GrayImage {
  const image = grayImage(size, size, 0)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      image.pixels[y * size + x] =
        (x * 7 + y * 11 + Math.floor(x / 4) * 37 +
          Math.floor(y / 4) * 19) % 256
    }
  }
  return image
}

function softEdgedBasketballTarget(size: number): GrayImage {
  const background = 28
  const image = grayImage(size, size, background)
  const center = (size - 1) / 2
  const radius = center - 4
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const deltaX = x - center
      const deltaY = y - center
      const distance = Math.hypot(deltaX, deltaY)
      const edgeBlend = Math.max(0, Math.min(1, (radius + 3 - distance) / 6))
      let value = background + Math.round(edgeBlend * 154)
      if (edgeBlend > 0.5) {
        const diagonalSeam = Math.abs(deltaY - deltaX * 0.28)
        const curvedSeam = Math.abs(distance - radius * 0.58)
        if (diagonalSeam < 1.6 || curvedSeam < 1.4) value = 48
        if (Math.hypot(deltaX + 9, deltaY + 10) < 4) value = 224
      }
      image.pixels[y * size + x] = value
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

function centeredSearch(
  geometry: AssistedTrackingGeometry,
  expectedTemplateCenter: Point,
  searchCenter: Point,
  actualCenter: Point | null,
  template: GrayImage,
): { search: GrayImage; region: SearchPixelRegion } {
  const guard = geometry.refinementRadius
  const extent = geometry.templateSize +
    2 * (geometry.nativeSearchRadius + guard)
  const half = (geometry.templateSize - 1) / 2
  const origin = {
    x: Math.round(searchCenter.x) - half - geometry.nativeSearchRadius - guard,
    y: Math.round(searchCenter.y) - half - geometry.nativeSearchRadius - guard,
  }
  const search = grayImage(extent, extent)
  if (actualCenter !== null) {
    paste(
      search,
      template,
      Math.round(actualCenter.x) - origin.x - half,
      Math.round(actualCenter.y) - origin.y - half,
    )
  }
  return {
    search,
    region: {
      width: search.width,
      height: search.height,
      origin,
      pixels: new Uint8ClampedArray(search.width * search.height * 4),
      expectedTemplateCenter,
      searchCenter: {
        x: Math.round(searchCenter.x),
        y: Math.round(searchCenter.y),
      },
      geometry,
      recoveryAttempt: 0,
      includeObservationCenter: true,
    },
  }
}

function locate(
  template: GrayImage,
  search: GrayImage,
  region: SearchPixelRegion,
) {
  return locateTemplate(template, search, region)
}

describe('multi-resolution grayscale reduction', () => {
  it('box-averages deterministic source blocks', () => {
    const source: GrayImage = {
      width: 4,
      height: 4,
      pixels: new Uint8Array([
        0, 1, 2, 3,
        4, 5, 6, 7,
        8, 9, 10, 11,
        12, 13, 14, 15,
      ]),
    }
    expect(downsampleGrayImage(source, 2)).toEqual({
      width: 2,
      height: 2,
      pixels: new Uint8Array([3, 5, 11, 13]),
    })
  })

  it('does not mutate the source image', () => {
    const source = texturedTarget(63)
    const before = new Uint8Array(source.pixels)
    expect(downsampleGrayImage(source, 4)).not.toBeNull()
    expect(source.pixels).toEqual(before)
  })
})

describe('fast-motion coarse-to-fine matching', () => {
  const template = texturedTarget(GEOMETRY_4K.templateSize)
  const previous = { x: 1200, y: 900 }

  it.each([
    ['zero', { x: 0, y: 0 }],
    ['small', { x: 7, y: -5 }],
    ['large', { x: 150, y: -90 }],
  ])('recovers %s displacement with exact native refinement', (_label, move) => {
    const fixture = centeredSearch(
      GEOMETRY_4K,
      previous,
      previous,
      { x: previous.x + move.x, y: previous.y + move.y },
      template,
    )
    const result = locate(template, fixture.search, fixture.region)
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual(move)
  })

  it('handles the first large assisted frame without motion history', () => {
    const movement = { x: 150, y: 96 }
    expect(Math.abs(movement.x)).toBeGreaterThan(84)
    const oldSingleScaleSearch = grayImage(
      template.width + 84 * 2,
      template.height + 84 * 2,
    )
    expect(matchTemplate(template, oldSingleScaleSearch).status).toBe(
      'low-confidence',
    )
    const fixture = centeredSearch(
      GEOMETRY_4K,
      previous,
      previous,
      { x: previous.x + movement.x, y: previous.y + movement.y },
      template,
    )
    const result = locate(template, fixture.search, fixture.region)
    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual(movement)
  })

  it('is deterministic and does not mutate either matching input', () => {
    const fixture = centeredSearch(
      GEOMETRY_4K,
      previous,
      previous,
      { x: previous.x + 137, y: previous.y - 83 },
      template,
    )
    const templateBefore = new Uint8Array(template.pixels)
    const searchBefore = new Uint8Array(fixture.search.pixels)
    const first = locate(template, fixture.search, fixture.region)
    const second = locate(template, fixture.search, fixture.region)

    expect(first).toEqual(second)
    expect(template.pixels).toEqual(templateBefore)
    expect(fixture.search.pixels).toEqual(searchBefore)
  })

  it('rejects a strong target just outside total native coverage', () => {
    const movement = GEOMETRY_4K.nativeSearchRadius + 4
    const fixture = centeredSearch(
      GEOMETRY_4K,
      previous,
      previous,
      { x: previous.x + movement, y: previous.y },
      template,
    )
    const result = locate(template, fixture.search, fixture.region)
    expect(result.status).toBe('low-confidence')
    if (result.status !== 'low-confidence') return
    expect(result.reason).toMatch(/within the assisted tracking search range/i)
  })

  it('stops when the target is missing instead of fabricating a position', () => {
    const fixture = centeredSearch(
      GEOMETRY_4K,
      previous,
      previous,
      null,
      template,
    )
    const result = locate(template, fixture.search, fixture.region)
    expect(result.status).toBe('low-confidence')
  })

  it('preserves low-texture rejection for a large coarse search', () => {
    const flatTemplate = grayImage(GEOMETRY_4K.templateSize, GEOMETRY_4K.templateSize, 90)
    const fixture = centeredSearch(
      GEOMETRY_4K,
      previous,
      previous,
      previous,
      flatTemplate,
    )
    const result = locate(flatTemplate, fixture.search, fixture.region)
    expect(result.status).toBe('low-confidence')
    if (result.status !== 'low-confidence') return
    expect(result.reason).toMatch(/featureless/i)
  })

  it('rejects two similarly strong targets in the wider search range', () => {
    const fixture = centeredSearch(
      GEOMETRY_4K,
      previous,
      previous,
      null,
      template,
    )
    const half = (template.width - 1) / 2
    paste(
      fixture.search,
      template,
      previous.x - 140 - fixture.region.origin.x - half,
      previous.y - fixture.region.origin.y - half,
    )
    paste(
      fixture.search,
      template,
      previous.x + 140 - fixture.region.origin.x - half,
      previous.y - fixture.region.origin.y - half,
    )

    const result = locate(template, fixture.search, fixture.region)
    expect(result.status).toBe('low-confidence')
    if (result.status !== 'low-confidence') return
    expect(result.reason).toMatch(/equally plausible/i)
    expect(result.diagnostics?.clusterCount).toBeGreaterThanOrEqual(2)
    expect(result.diagnostics?.secondClusterScore).toBe(0)
    expect(result.diagnostics?.ambiguityMargin).toBe(0)
    expect(result.diagnostics?.bestSecondClusterSeparation).toBeGreaterThan(
      result.diagnostics?.clusterRadius ?? Number.POSITIVE_INFINITY,
    )
    expect(result.diagnostics?.motionTieBreakUsed).toBe(false)
  })

  it('accepts a soft-edged basketball target as one local match basin', () => {
    const basketball = softEdgedBasketballTarget(GEOMETRY_4K.templateSize)
    const search = grayImage(511, 511, 28)
    paste(search, basketball, 301, 187)

    const result = matchTemplateCoarseToFine(
      basketball,
      search,
      GEOMETRY_4K,
    )

    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.matchedCenter).toEqual({ x: 332, y: 218 })
    expect(result.score).toBe(0)
    expect(result.diagnostics?.bestClusterCandidateCount).toBeGreaterThan(1)
    expect(result.diagnostics?.retainedRepresentativeCount).toBeLessThanOrEqual(
      8,
    )
    expect(result.diagnostics?.refinedCandidateCount).toBeGreaterThan(0)
    expect(result.diagnostics?.motionTieBreakUsed).toBe(false)
  })

  it('keeps the bounded 4K work estimate below the Phase 7.1 strategy', () => {
    const fixture = centeredSearch(
      GEOMETRY_4K,
      previous,
      previous,
      previous,
      template,
    )
    const estimate = estimateCoarseToFineWork(
      template,
      fixture.search,
      GEOMETRY_4K,
    )!
    expect(estimate.maximumTotalPixelComparisons).toBeLessThan(13_000_000)
    expect(estimate.maximumTotalPixelComparisons).toBeLessThan(31_507_020)

    const conservativeGuidedUnion = grayImage(727, 727)
    const guidedEstimate = estimateCoarseToFineWork(
      template,
      conservativeGuidedUnion,
      GEOMETRY_4K,
    )!
    expect(guidedEstimate.maximumTotalPixelComparisons).toBeLessThan(
      16_000_000,
    )
  })
})

describe('fast-motion frame boundaries', () => {
  const frameSize: Size = { width: 4096, height: 2160 }
  const template = texturedTarget(GEOMETRY_4K.templateSize)

  it.each([
    ['left', { x: 40, y: 1000 }, { x: 35, y: 1000 }],
    ['right', { x: 4055, y: 1000 }, { x: 4060, y: 1000 }],
    ['top', { x: 1000, y: 40 }, { x: 1000, y: 35 }],
    ['bottom', { x: 1000, y: 2120 }, { x: 1000, y: 2125 }],
  ])('matches safely near the %s frame edge', (_edge, previous, actual) => {
    const rect = searchRectForPoint(
      frameSize,
      previous,
      GEOMETRY_4K.templateSize,
      GEOMETRY_4K.nativeSearchRadius + GEOMETRY_4K.refinementRadius,
    )!
    const search = grayImage(rect.width, rect.height)
    const half = (template.width - 1) / 2
    paste(
      search,
      template,
      actual.x - rect.x - half,
      actual.y - rect.y - half,
    )
    const result = locate(template, search, {
      width: search.width,
      height: search.height,
      origin: { x: rect.x, y: rect.y },
      pixels: new Uint8ClampedArray(search.width * search.height * 4),
      expectedTemplateCenter: previous,
      searchCenter: previous,
      geometry: GEOMETRY_4K,
      recoveryAttempt: 0,
      includeObservationCenter: true,
    })

    expect(result.status).toBe('match')
    if (result.status !== 'match') return
    expect(result.displacement).toEqual({
      x: actual.x - previous.x,
      y: actual.y - previous.y,
    })
  })

  it('fails safely when the target leaves the frame', () => {
    const previous = { x: 40, y: 1000 }
    const rect = searchRectForPoint(
      frameSize,
      previous,
      GEOMETRY_4K.templateSize,
      GEOMETRY_4K.nativeSearchRadius + GEOMETRY_4K.refinementRadius,
    )!
    const search = grayImage(rect.width, rect.height)
    const result = locate(template, search, {
      width: search.width,
      height: search.height,
      origin: { x: rect.x, y: rect.y },
      pixels: new Uint8ClampedArray(search.width * search.height * 4),
      expectedTemplateCenter: previous,
      searchCenter: previous,
      geometry: GEOMETRY_4K,
      recoveryAttempt: 0,
      includeObservationCenter: true,
    })
    expect(result.status).toBe('low-confidence')
  })
})
