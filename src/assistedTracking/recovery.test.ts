import { describe, expect, it } from 'vitest'

import { assistedTrackingGeometryFor } from './geometry'
import { motionSearchHint } from './motionGuidance'
import {
  MAX_CONSECUTIVE_MISSES,
  recoveryAttemptFor,
  recoveryExhaustedReason,
  recoveryGeometryFor,
  registerRecoveryMiss,
} from './recovery'
import {
  estimateCoarseToFineWork,
  locateTemplate,
} from './templateTracker'
import type { GrayImage } from './types'

function grayImage(width: number, height: number, fill = 23): GrayImage {
  return { width, height, pixels: new Uint8Array(width * height).fill(fill) }
}

function texturedTarget(size: number): GrayImage {
  const image = grayImage(size, size, 0)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      image.pixels[y * size + x] = (x * 31 + y * 47 + x * y * 5) % 256
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

describe('assisted tracking recovery policy', () => {
  it('allows three recoverable misses and exhausts on the following miss', () => {
    let consecutiveMisses = 0
    for (let index = 0; index < MAX_CONSECUTIVE_MISSES; index += 1) {
      const miss = registerRecoveryMiss(consecutiveMisses)!
      expect(miss.exhausted).toBe(false)
      consecutiveMisses = miss.consecutiveMisses
    }

    const exhausted = registerRecoveryMiss(consecutiveMisses)!
    expect(exhausted).toEqual({ consecutiveMisses: 4, exhausted: true })
    expect(recoveryExhaustedReason(exhausted.consecutiveMisses)).toMatch(
      /tracking lost after 4 consecutive frames.*reseed/i,
    )
  })

  it.each([
    ['normal', 0, 216],
    ['first recovery', 1, 292],
    ['second recovery', 2, 368],
    ['third recovery', 3, 432],
  ])('derives the bounded 4K %s radius', (_label, misses, radius) => {
    const base = assistedTrackingGeometryFor({ width: 4096, height: 2160 })!
    const geometry = recoveryGeometryFor(base, misses)!
    expect(geometry.nativeSearchRadius).toBe(radius)
    expect(geometry.nativeSearchRadius).toBe(
      geometry.coarseRadius * geometry.coarseScale,
    )
  })

  it('caps recovery for an already maximum-sized normal geometry', () => {
    const base = assistedTrackingGeometryFor({ width: 8192, height: 4320 })!
    expect(recoveryGeometryFor(base, 3)?.nativeSearchRadius).toBe(512)
  })

  it('keeps the widest 4K recovery search bounded below 21 million comparisons', () => {
    const base = assistedTrackingGeometryFor({ width: 4096, height: 2160 })!
    const recovery = recoveryGeometryFor(base, 3)!
    const extent = recovery.templateSize +
      2 * (recovery.nativeSearchRadius + recovery.refinementRadius)
    const estimate = estimateCoarseToFineWork(
      grayImage(recovery.templateSize, recovery.templateSize),
      grayImage(extent, extent),
      recovery,
    )!

    expect(extent).toBe(943)
    expect(estimate.maximumTotalPixelComparisons).toBeLessThan(21_000_000)
  })

  it('returns to normal geometry after reacquisition resets the miss count', () => {
    const base = assistedTrackingGeometryFor({ width: 1920, height: 1080 })!
    expect(recoveryGeometryFor(base, 2)?.nativeSearchRadius).toBe(186)
    expect(recoveryGeometryFor(base, 0)).toEqual(base)
    expect(recoveryAttemptFor(0)).toBe(0)
  })

  it('projects from the last reliable observations across missed timestamps', () => {
    const base = assistedTrackingGeometryFor({ width: 4096, height: 2160 })!
    const recovery = recoveryGeometryFor(base, 3)!
    const hint = motionSearchHint(
      [
        { position: { x: 1000, y: 900 }, time: 0 },
        { position: { x: 1060, y: 900 }, time: 1 / 30 },
      ],
      4 / 30,
      { width: 4096, height: 2160 },
      recovery.nativeSearchRadius,
    )!

    expect(hint.usedMotionGuidance).toBe(true)
    expect(hint.predictedDisplacement).toEqual({ x: 180, y: 0 })
    expect(hint.searchCenter).toEqual({ x: 1240, y: 900 })
  })

  it('rejects a strong recovery distractor outside the predicted radius', () => {
    const base = assistedTrackingGeometryFor({ width: 1280, height: 720 })!
    const recovery = recoveryGeometryFor(base, 1)!
    const template = texturedTarget(base.templateSize)
    const searchCenter = { x: 200, y: 200 }
    const previousAnchor = { x: 98, y: 200 }
    const guard = recovery.refinementRadius
    const half = (template.width - 1) / 2
    const origin = {
      x: searchCenter.x - half - recovery.nativeSearchRadius - guard,
      y: searchCenter.y - half - recovery.nativeSearchRadius - guard,
    }
    const extent = template.width +
      2 * (recovery.nativeSearchRadius + guard)
    const search = grayImage(extent, extent)
    paste(
      search,
      template,
      previousAnchor.x - origin.x - half,
      previousAnchor.y - origin.y - half,
    )

    const result = locateTemplate(template, search, {
      origin,
      expectedTemplateCenter: previousAnchor,
      searchCenter,
      geometry: recovery,
      recoveryAttempt: 1,
    })
    expect(result.status).toBe('low-confidence')
    if (result.status !== 'low-confidence') return
    expect(result.reason).toMatch(/search range/i)
  })
})
