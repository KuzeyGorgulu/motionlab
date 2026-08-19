import { describe, expect, it } from 'vitest'

import {
  ASSISTED_GEOMETRY_LIMITS,
  assistedTrackingGeometryFor,
  isValidAssistedTrackingGeometry,
  isValidAssistedTrackingSearchGeometry,
} from './geometry'

describe('adaptive assisted-tracking geometry', () => {
  it.each([
    [
      '720p',
      { width: 1280, height: 720 },
      {
        templateSize: 21,
        coarseScale: 2,
        coarseRadius: 36,
        coarseStep: 1,
        nativeSearchRadius: 72,
        refinementRadius: 4,
      },
    ],
    [
      '1080p',
      { width: 1920, height: 1080 },
      {
        templateSize: 33,
        coarseScale: 3,
        coarseRadius: 36,
        coarseStep: 1,
        nativeSearchRadius: 108,
        refinementRadius: 6,
      },
    ],
    [
      '1440p',
      { width: 2560, height: 1440 },
      {
        templateSize: 43,
        coarseScale: 4,
        coarseRadius: 36,
        coarseStep: 1,
        nativeSearchRadius: 144,
        refinementRadius: 8,
      },
    ],
    [
      '4K',
      { width: 4096, height: 2160 },
      {
        templateSize: 63,
        coarseScale: 4,
        coarseRadius: 54,
        coarseStep: 1,
        nativeSearchRadius: 216,
        refinementRadius: 8,
      },
    ],
  ])('derives the documented %s policy', (_label, nativeSize, expected) => {
    expect(assistedTrackingGeometryFor(nativeSize)).toEqual(expected)
  })

  it('uses the shorter native dimension for portrait video', () => {
    expect(assistedTrackingGeometryFor({ width: 1080, height: 1920 })).toEqual({
      templateSize: 33,
      coarseScale: 3,
      coarseRadius: 36,
      coarseStep: 1,
      nativeSearchRadius: 108,
      refinementRadius: 6,
    })
  })

  it('handles an unusual wide aspect ratio conservatively', () => {
    expect(assistedTrackingGeometryFor({ width: 4096, height: 512 })).toEqual({
      templateSize: 21,
      coarseScale: 2,
      coarseRadius: 36,
      coarseStep: 1,
      nativeSearchRadius: 72,
      refinementRadius: 4,
    })
  })

  it('clamps very small video to the minimum policy', () => {
    expect(assistedTrackingGeometryFor({ width: 16, height: 12 })).toEqual({
      templateSize: ASSISTED_GEOMETRY_LIMITS.minimumTemplateSize,
      coarseScale: 2,
      coarseRadius: 36,
      coarseStep: 1,
      nativeSearchRadius:
        ASSISTED_GEOMETRY_LIMITS.minimumNativeSearchRadius,
      refinementRadius: ASSISTED_GEOMETRY_LIMITS.minimumRefinementRadius,
    })
  })

  it('clamps very large video to the bounded maximum policy', () => {
    expect(assistedTrackingGeometryFor({ width: 8192, height: 4320 })).toEqual({
      templateSize: ASSISTED_GEOMETRY_LIMITS.maximumTemplateSize,
      coarseScale: 4,
      coarseRadius: 64,
      coarseStep: 1,
      nativeSearchRadius:
        ASSISTED_GEOMETRY_LIMITS.maximumNativeSearchRadius,
      refinementRadius: ASSISTED_GEOMETRY_LIMITS.maximumRefinementRadius,
    })
  })

  it('keeps every supported template size odd and within limits', () => {
    const shortSides = [1, 360, 720, 900, 1080, 1440, 2160, 4320, 10000]
    for (const shortSide of shortSides) {
      const geometry = assistedTrackingGeometryFor({
        width: shortSide * 2,
        height: shortSide,
      })!
      expect(geometry.templateSize % 2).toBe(1)
      expect(geometry.templateSize).toBeGreaterThanOrEqual(
        ASSISTED_GEOMETRY_LIMITS.minimumTemplateSize,
      )
      expect(geometry.templateSize).toBeLessThanOrEqual(
        ASSISTED_GEOMETRY_LIMITS.maximumTemplateSize,
      )
      expect(geometry.nativeSearchRadius).toBeGreaterThanOrEqual(
        ASSISTED_GEOMETRY_LIMITS.minimumNativeSearchRadius,
      )
      expect(geometry.nativeSearchRadius).toBeLessThanOrEqual(
        ASSISTED_GEOMETRY_LIMITS.maximumNativeSearchRadius,
      )
      expect(geometry.nativeSearchRadius).toBe(
        geometry.coarseScale * geometry.coarseRadius,
      )
      expect(geometry.coarseStep).toBe(1)
    }
  })

  it('rejects invalid native dimensions instead of inventing geometry', () => {
    expect(assistedTrackingGeometryFor({ width: 0, height: 1080 })).toBeNull()
    expect(assistedTrackingGeometryFor({ width: 1920.5, height: 1080 })).toBeNull()
  })

  it('accepts bounded recovery geometry without relaxing normal geometry', () => {
    const recoveryGeometry = {
      templateSize: 63,
      coarseScale: 4,
      coarseRadius: 108,
      coarseStep: 1,
      nativeSearchRadius: 432,
      refinementRadius: 8,
    }
    expect(isValidAssistedTrackingGeometry(recoveryGeometry)).toBe(false)
    expect(isValidAssistedTrackingSearchGeometry(recoveryGeometry)).toBe(true)
  })
})
