import {
  ASSISTED_GEOMETRY_LIMITS,
  isValidAssistedTrackingGeometry,
  isValidAssistedTrackingSearchGeometry,
} from './geometry'
import type { AssistedTrackingGeometry } from './types'
import type { Point } from '../video/geometry'

export const PRIMARY_MOTION_ALLOWANCE_FRACTION = 0.35
export const PRIMARY_TEMPLATE_SAFETY_FRACTION = 0.25
export const MAXIMUM_PRIMARY_RADIUS_MULTIPLIER = 1.5
export const FALLBACK_MOTION_ALLOWANCE_FRACTION = 1
export const FALLBACK_TEMPLATE_SAFETY_FRACTION = 1

export interface AdaptiveSearchPolicy {
  projectedMotionMagnitude: number
  primaryGeometry: AssistedTrackingGeometry
  fallbackGeometry: AssistedTrackingGeometry
}

function alignedRadius(
  requested: number,
  coarseScale: number,
  maximum: number,
): number {
  const alignedMaximum = Math.floor(maximum / coarseScale) * coarseScale
  return Math.min(
    Math.ceil(requested / coarseScale) * coarseScale,
    alignedMaximum,
  )
}

function withRadius(
  base: AssistedTrackingGeometry,
  nativeSearchRadius: number,
): AssistedTrackingGeometry {
  return {
    ...base,
    coarseRadius: nativeSearchRadius / base.coarseScale,
    nativeSearchRadius,
  }
}

export function adaptiveSearchPolicyFor(
  base: AssistedTrackingGeometry,
  projectedDisplacement: Point | null,
): AdaptiveSearchPolicy | null {
  if (!isValidAssistedTrackingGeometry(base)) return null
  if (
    projectedDisplacement !== null &&
    (!Number.isFinite(projectedDisplacement.x) ||
      !Number.isFinite(projectedDisplacement.y))
  ) {
    return null
  }

  const projectedMotionMagnitude = projectedDisplacement === null
    ? 0
    : Math.hypot(projectedDisplacement.x, projectedDisplacement.y)
  if (!Number.isFinite(projectedMotionMagnitude)) return null

  const recoveryMaximum =
    ASSISTED_GEOMETRY_LIMITS.maximumRecoveryNativeSearchRadius
  const primaryMaximum = Math.min(
    recoveryMaximum,
    Math.ceil(
      base.nativeSearchRadius * MAXIMUM_PRIMARY_RADIUS_MULTIPLIER,
    ),
  )
  const primaryRequested = projectedDisplacement === null
    ? base.nativeSearchRadius
    : base.nativeSearchRadius +
      projectedMotionMagnitude * PRIMARY_MOTION_ALLOWANCE_FRACTION +
      base.templateSize * PRIMARY_TEMPLATE_SAFETY_FRACTION
  const primaryRadius = alignedRadius(
    primaryRequested,
    base.coarseScale,
    primaryMaximum,
  )
  const fallbackRequested = Math.max(
    primaryRadius,
    base.nativeSearchRadius +
      projectedMotionMagnitude * FALLBACK_MOTION_ALLOWANCE_FRACTION +
      base.templateSize * FALLBACK_TEMPLATE_SAFETY_FRACTION,
  )
  const fallbackRadius = alignedRadius(
    fallbackRequested,
    base.coarseScale,
    recoveryMaximum,
  )
  const primaryGeometry = withRadius(base, primaryRadius)
  const fallbackGeometry = withRadius(base, fallbackRadius)
  return isValidAssistedTrackingSearchGeometry(primaryGeometry) &&
      isValidAssistedTrackingSearchGeometry(fallbackGeometry)
    ? { projectedMotionMagnitude, primaryGeometry, fallbackGeometry }
    : null
}
