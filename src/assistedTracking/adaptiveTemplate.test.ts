import { describe, expect, it } from 'vitest'

import {
  commitAdaptiveTemplateUpdate,
  createAdaptiveTemplateState,
  locateWithAdaptiveTemplates,
} from './adaptiveTemplate'
import { assistedTrackingGeometryFor } from './geometry'
import type {
  AdaptiveTemplateState,
} from './adaptiveTemplate'
import type { GrayImage, SearchPixelRegion } from './types'

const GEOMETRY = assistedTrackingGeometryFor({ width: 1280, height: 720 })!

function grayImage(width: number, height: number, fill = 17): GrayImage {
  return { width, height, pixels: new Uint8Array(width * height).fill(fill) }
}

function pattern(size: number, offset = 0): GrayImage {
  const image = grayImage(size, size, 0)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      image.pixels[y * size + x] =
        (x * 29 + y * 43 + x * y * 7 + offset) % 256
    }
  }
  return image
}

function brighten(source: GrayImage, amount: number): GrayImage {
  return {
    width: source.width,
    height: source.height,
    pixels: Uint8Array.from(
      source.pixels,
      (pixel) => Math.min(255, pixel + amount),
    ),
  }
}

function paste(target: GrayImage, source: GrayImage, left: number, top: number) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      target.pixels[(top + y) * target.width + left + x] =
        source.pixels[y * source.width + x]!
    }
  }
}

function region(
  width: number,
  height: number,
  center: { x: number; y: number },
  recoveryAttempt: number,
): SearchPixelRegion {
  return {
    width,
    height,
    origin: { x: 0, y: 0 },
    pixels: new Uint8ClampedArray(width * height * 4),
    expectedTemplateCenter: center,
    searchCenter: center,
    geometry: GEOMETRY,
    recoveryAttempt,
    includeObservationCenter: recoveryAttempt === 0,
  }
}

function adaptedState(
  seedTemplate: GrayImage,
  currentTemplate: GrayImage,
): AdaptiveTemplateState {
  return {
    seedTemplate: {
      ...seedTemplate,
      pixels: new Uint8Array(seedTemplate.pixels),
    },
    currentTemplate: {
      ...currentTemplate,
      pixels: new Uint8Array(currentTemplate.pixels),
    },
    updateCount: 1,
  }
}

describe('conservative adaptive template matching', () => {
  it('stages and explicitly commits only a high-confidence appearance update', () => {
    const seed = pattern(GEOMETRY.templateSize)
    const observed = brighten(seed, 8)
    const search = grayImage(121, 121)
    paste(search, observed, 50, 50)
    const state = createAdaptiveTemplateState(seed)!
    const seedBefore = new Uint8Array(state.seedTemplate.pixels)

    const outcome = locateWithAdaptiveTemplates(
      state,
      search,
      region(121, 121, { x: 60, y: 60 }, 0),
    )
    expect(outcome.result.status).toBe('match')
    if (outcome.result.status !== 'match') return
    expect(outcome.result.templateUpdateEligible).toBe(true)
    expect(outcome.pendingTemplateUpdate).not.toBeNull()
    expect(state.updateCount).toBe(0)

    const committed = commitAdaptiveTemplateUpdate(
      state,
      outcome.pendingTemplateUpdate,
    )
    expect(committed.updateCount).toBe(1)
    expect(committed.seedTemplate.pixels).toEqual(seedBefore)
    expect(committed.currentTemplate.pixels).not.toEqual(
      state.currentTemplate.pixels,
    )
  })

  it('does not update from a low-confidence or missing target', () => {
    const seed = pattern(GEOMETRY.templateSize)
    const state = createAdaptiveTemplateState(seed)!
    const outcome = locateWithAdaptiveTemplates(
      state,
      grayImage(121, 121),
      region(121, 121, { x: 60, y: 60 }, 0),
    )

    expect(outcome.result.status).toBe('low-confidence')
    expect(outcome.pendingTemplateUpdate).toBeNull()
    expect(commitAdaptiveTemplateUpdate(state, null)).toBe(state)
  })

  it('does not update from an ambiguous repeated target', () => {
    const seed = pattern(GEOMETRY.templateSize)
    const search = grayImage(161, 81)
    paste(search, seed, 15, 30)
    paste(search, seed, 125, 30)
    const state = createAdaptiveTemplateState(seed)!
    const outcome = locateWithAdaptiveTemplates(
      state,
      search,
      region(161, 81, { x: 80, y: 40 }, 0),
    )

    expect(outcome.result.status).toBe('low-confidence')
    expect(outcome.result.status === 'low-confidence' && outcome.result.reason)
      .toMatch(/equally plausible/i)
    expect(outcome.pendingTemplateUpdate).toBeNull()
  })

  it('uses the immutable seed template to reacquire during recovery', () => {
    const seed = pattern(GEOMETRY.templateSize)
    const drifted = pattern(GEOMETRY.templateSize, 97)
    const state = adaptedState(seed, drifted)
    const search = grayImage(121, 121)
    paste(search, seed, 50, 50)

    const normal = locateWithAdaptiveTemplates(
      state,
      search,
      region(121, 121, { x: 60, y: 60 }, 0),
    )
    expect(normal.result.status).toBe('low-confidence')

    const recovery = locateWithAdaptiveTemplates(
      state,
      search,
      region(121, 121, { x: 60, y: 60 }, 1),
    )
    expect(recovery.result.status).toBe('match')
    if (recovery.result.status !== 'match') return
    expect(recovery.result.templateSource).toBe('seed')
    expect(recovery.result.displacement).toEqual({ x: 0, y: 0 })
  })

  it('stops when adapted and seed templates find separate plausible targets', () => {
    const seed = pattern(GEOMETRY.templateSize)
    const current = pattern(GEOMETRY.templateSize, 97)
    const state = adaptedState(seed, current)
    const search = grayImage(181, 81)
    paste(search, current, 20, 30)
    paste(search, seed, 140, 30)

    const outcome = locateWithAdaptiveTemplates(
      state,
      search,
      region(181, 81, { x: 90, y: 40 }, 1),
    )
    expect(outcome.result.status).toBe('low-confidence')
    if (outcome.result.status !== 'low-confidence') return
    expect(outcome.result.reason).toMatch(/different plausible targets/i)
    expect(outcome.pendingTemplateUpdate).toBeNull()
  })
})
