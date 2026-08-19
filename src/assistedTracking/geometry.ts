import type { Size } from '../video/geometry'
import type { AssistedTrackingGeometry } from './types'

export const ASSISTED_GEOMETRY_LIMITS = {
  referenceShortSide: 720,
  referenceTemplateSize: 21,
  referenceNativeSearchRadius: 72,
  minimumTemplateSize: 21,
  maximumTemplateSize: 65,
  minimumNativeSearchRadius: 72,
  maximumNativeSearchRadius: 256,
  minimumRefinementRadius: 4,
  maximumRefinementRadius: 8,
  maximumCoarseScale: 4,
  maximumRecoveryNativeSearchRadius: 512,
} as const

function isValidNativeSize(size: Size): boolean {
  return (
    Number.isInteger(size.width) &&
    Number.isInteger(size.height) &&
    size.width > 0 &&
    size.height > 0
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function nearestOdd(value: number): number {
  const rounded = Math.round(value)
  return rounded % 2 === 1 ? rounded : rounded + 1
}

export function assistedTrackingGeometryFor(
  nativeSize: Size,
): AssistedTrackingGeometry | null {
  if (!isValidNativeSize(nativeSize)) return null

  const limits = ASSISTED_GEOMETRY_LIMITS
  const scale = Math.min(nativeSize.width, nativeSize.height) /
    limits.referenceShortSide
  const templateSize = clamp(
    nearestOdd(limits.referenceTemplateSize * scale),
    limits.minimumTemplateSize,
    limits.maximumTemplateSize,
  )
  const coarseScale = Math.min(
    limits.maximumCoarseScale,
    shortSideCoarseScale(Math.min(nativeSize.width, nativeSize.height)),
  )
  const requestedNativeSearchRadius = clamp(
    Math.round(limits.referenceNativeSearchRadius * scale),
    limits.minimumNativeSearchRadius,
    limits.maximumNativeSearchRadius,
  )
  const coarseRadius = Math.ceil(requestedNativeSearchRadius / coarseScale)
  const nativeSearchRadius = coarseRadius * coarseScale
  const refinementRadius = clamp(
    Math.round(4 * scale),
    limits.minimumRefinementRadius,
    limits.maximumRefinementRadius,
  )

  return {
    templateSize,
    coarseScale,
    coarseRadius,
    coarseStep: 1,
    nativeSearchRadius,
    refinementRadius,
  }
}

function shortSideCoarseScale(shortSide: number): number {
  if (shortSide <= 720) return 2
  if (shortSide <= 1080) return 3
  return 4
}

export function isValidAssistedTrackingGeometry(
  geometry: AssistedTrackingGeometry,
): boolean {
  return isValidGeometryWithinRadius(
    geometry,
    ASSISTED_GEOMETRY_LIMITS.maximumNativeSearchRadius,
  )
}

export function isValidAssistedTrackingSearchGeometry(
  geometry: AssistedTrackingGeometry,
): boolean {
  return isValidGeometryWithinRadius(
    geometry,
    ASSISTED_GEOMETRY_LIMITS.maximumRecoveryNativeSearchRadius,
  )
}

function isValidGeometryWithinRadius(
  geometry: AssistedTrackingGeometry,
  maximumNativeSearchRadius: number,
): boolean {
  return (
    Number.isInteger(geometry.templateSize) &&
    geometry.templateSize >= ASSISTED_GEOMETRY_LIMITS.minimumTemplateSize &&
    geometry.templateSize <= ASSISTED_GEOMETRY_LIMITS.maximumTemplateSize &&
    geometry.templateSize % 2 === 1 &&
    Number.isInteger(geometry.coarseScale) &&
    geometry.coarseScale >= 2 &&
    geometry.coarseScale <= ASSISTED_GEOMETRY_LIMITS.maximumCoarseScale &&
    Number.isInteger(geometry.coarseRadius) &&
    geometry.coarseRadius > 0 &&
    Number.isInteger(geometry.coarseStep) &&
    geometry.coarseStep === 1 &&
    Number.isInteger(geometry.nativeSearchRadius) &&
    geometry.nativeSearchRadius ===
      geometry.coarseScale * geometry.coarseRadius &&
    geometry.nativeSearchRadius >=
      ASSISTED_GEOMETRY_LIMITS.minimumNativeSearchRadius &&
    geometry.nativeSearchRadius <= maximumNativeSearchRadius &&
    Number.isInteger(geometry.refinementRadius) &&
    geometry.refinementRadius >=
      ASSISTED_GEOMETRY_LIMITS.minimumRefinementRadius &&
    geometry.refinementRadius <=
      ASSISTED_GEOMETRY_LIMITS.maximumRefinementRadius
  )
}
