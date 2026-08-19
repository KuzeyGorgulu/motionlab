import { describe, expect, it } from 'vitest'

import { adaptiveSearchPolicyFor } from './adaptiveSearch'
import { searchRectForTracking } from './frameExtraction'
import { assistedTrackingGeometryFor } from './geometry'
import { recoveryGeometryFor } from './recovery'
import { estimateCoarseToFineWork, locateTemplate } from './templateTracker'
import type { GrayImage } from './types'

const NATIVE_SIZE = { width: 1280, height: 720 }
const BASE = assistedTrackingGeometryFor(NATIVE_SIZE)!

function grayImage(width: number, height: number, fill = 17): GrayImage {
  return { width, height, pixels: new Uint8Array(width * height).fill(fill) }
}

function texturedTarget(size: number): GrayImage {
  const image = grayImage(size, size, 0)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      image.pixels[y * size + x] = (x * 31 + y * 43 + x * y * 7) % 256
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

describe('motion-adaptive assisted search', () => {
  it('keeps insufficient-history search at the existing base geometry', () => {
    const policy = adaptiveSearchPolicyFor(BASE, null)!
    expect(policy.primaryGeometry).toEqual(BASE)
    expect(policy.fallbackGeometry.nativeSearchRadius).toBeGreaterThan(
      BASE.nativeSearchRadius,
    )
  })

  it('uses only a small primary expansion for a nearly static target', () => {
    const policy = adaptiveSearchPolicyFor(BASE, { x: 1, y: 0 })!
    expect(policy.projectedMotionMagnitude).toBe(1)
    expect(policy.primaryGeometry.nativeSearchRadius).toBe(78)
    expect(policy.primaryGeometry.nativeSearchRadius).toBeLessThan(90)
  })

  it('gives fast movement a larger primary and fallback search', () => {
    const slow = adaptiveSearchPolicyFor(BASE, { x: 5, y: 0 })!
    const fast = adaptiveSearchPolicyFor(BASE, { x: 150, y: 0 })!

    expect(fast.primaryGeometry.nativeSearchRadius).toBeGreaterThan(
      slow.primaryGeometry.nativeSearchRadius,
    )
    expect(fast.fallbackGeometry.nativeSearchRadius).toBeGreaterThan(
      fast.primaryGeometry.nativeSearchRadius,
    )
    expect(fast.fallbackGeometry.nativeSearchRadius).toBeLessThanOrEqual(512)
  })

  it('compounds bounded multi-frame recovery after adaptive search misses', () => {
    const adaptive = adaptiveSearchPolicyFor(BASE, { x: 100, y: 0 })!
    const recovery = recoveryGeometryFor(adaptive.primaryGeometry, 1)!
    expect(recovery.nativeSearchRadius).toBeGreaterThan(
      adaptive.primaryGeometry.nativeSearchRadius,
    )
    expect(recovery.nativeSearchRadius).toBeLessThanOrEqual(512)
  })

  it('keeps the maximum 4K fallback search within a bounded work estimate', () => {
    const nativeSize4K = {
      width: 3840,
      height: 2160,
    }
    const geometry4K = assistedTrackingGeometryFor(nativeSize4K)!
    const policy = adaptiveSearchPolicyFor(geometry4K, { x: 512, y: 0 })!
    const corridor = searchRectForTracking(
      nativeSize4K,
      { x: 1536, y: 1080 },
      { x: 2048, y: 1080 },
      policy.fallbackGeometry,
      0,
      'corridor',
    )!
    const estimate = estimateCoarseToFineWork(
      grayImage(policy.fallbackGeometry.templateSize, policy.fallbackGeometry.templateSize),
      grayImage(corridor.width, corridor.height),
      policy.fallbackGeometry,
    )!

    expect(policy.fallbackGeometry.nativeSearchRadius).toBe(512)
    expect(corridor.width).toBeGreaterThan(corridor.height)
    expect(estimate.maximumTotalPixelComparisons).toBeLessThan(33_000_000)
  })

  it('recovers sudden acceleration outside primary but inside fallback', () => {
    const template = texturedTarget(BASE.templateSize)
    const previous = { x: 300, y: 300 }
    const predicted = { x: 320, y: 300 }
    const actual = { x: 420, y: 300 }
    const policy = adaptiveSearchPolicyFor(BASE, { x: 20, y: 0 })!
    const primaryRect = searchRectForTracking(
      NATIVE_SIZE,
      previous,
      predicted,
      policy.primaryGeometry,
      0,
      'predicted',
    )!
    const fallbackRect = searchRectForTracking(
      NATIVE_SIZE,
      previous,
      predicted,
      policy.fallbackGeometry,
      0,
      'corridor',
    )!
    const primarySearch = grayImage(primaryRect.width, primaryRect.height)
    const fallbackSearch = grayImage(fallbackRect.width, fallbackRect.height)
    const half = (template.width - 1) / 2
    paste(
      fallbackSearch,
      template,
      actual.x - fallbackRect.x - half,
      actual.y - fallbackRect.y - half,
    )

    const primary = locateTemplate(template, primarySearch, {
      origin: { x: primaryRect.x, y: primaryRect.y },
      expectedTemplateCenter: previous,
      searchCenter: predicted,
      geometry: policy.primaryGeometry,
      recoveryAttempt: 0,
      includeObservationCenter: false,
    })
    const fallback = locateTemplate(template, fallbackSearch, {
      origin: { x: fallbackRect.x, y: fallbackRect.y },
      expectedTemplateCenter: previous,
      searchCenter: predicted,
      geometry: policy.fallbackGeometry,
      recoveryAttempt: 0,
      includeObservationCenter: true,
    })

    expect(primary.status).toBe('low-confidence')
    expect(fallback.status).toBe('match')
    if (fallback.status !== 'match') return
    expect(fallback.displacement).toEqual({ x: 120, y: 0 })
  })

  it('preserves ambiguity rejection inside an expanded fallback region', () => {
    const template = texturedTarget(BASE.templateSize)
    const previous = { x: 300, y: 300 }
    const predicted = { x: 320, y: 300 }
    const policy = adaptiveSearchPolicyFor(BASE, { x: 80, y: 0 })!
    const rect = searchRectForTracking(
      NATIVE_SIZE,
      previous,
      predicted,
      policy.fallbackGeometry,
      0,
      'corridor',
    )!
    const search = grayImage(rect.width, rect.height)
    const half = (template.width - 1) / 2
    for (const center of [{ x: 250, y: 300 }, { x: 400, y: 300 }]) {
      paste(
        search,
        template,
        center.x - rect.x - half,
        center.y - rect.y - half,
      )
    }

    const result = locateTemplate(template, search, {
      origin: { x: rect.x, y: rect.y },
      expectedTemplateCenter: previous,
      searchCenter: predicted,
      geometry: policy.fallbackGeometry,
      recoveryAttempt: 0,
      includeObservationCenter: true,
    })
    expect(result.status).toBe('low-confidence')
    if (result.status !== 'low-confidence') return
    expect(result.reason).toMatch(/equally plausible/i)
  })

  it.each([
    ['top-left', { x: 2, y: 2 }],
    ['top-right', { x: 1278, y: 2 }],
    ['bottom-left', { x: 2, y: 718 }],
    ['bottom-right', { x: 1278, y: 718 }],
  ])('clips predicted and fallback bounds safely at %s', (_label, predicted) => {
    const policy = adaptiveSearchPolicyFor(BASE, { x: 150, y: 150 })!
    for (const mode of ['predicted', 'corridor'] as const) {
      const rect = searchRectForTracking(
        NATIVE_SIZE,
        { x: 640, y: 360 },
        predicted,
        mode === 'predicted'
          ? policy.primaryGeometry
          : policy.fallbackGeometry,
        0,
        mode,
      )!
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(NATIVE_SIZE.width)
      expect(rect.y + rect.height).toBeLessThanOrEqual(NATIVE_SIZE.height)
    }
  })

  it('rejects non-finite motion instead of producing absurd geometry', () => {
    expect(adaptiveSearchPolicyFor(BASE, { x: Number.NaN, y: 0 })).toBeNull()
    expect(
      adaptiveSearchPolicyFor(BASE, { x: Number.POSITIVE_INFINITY, y: 0 }),
    ).toBeNull()
  })
})
