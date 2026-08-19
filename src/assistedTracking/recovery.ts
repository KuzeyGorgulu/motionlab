import {
  ASSISTED_GEOMETRY_LIMITS,
  isValidAssistedTrackingGeometry,
  isValidAssistedTrackingSearchGeometry,
} from './geometry'
import type { AssistedTrackingGeometry } from './types'

export const MAX_CONSECUTIVE_MISSES = 3
export const RECOVERY_SEARCH_MULTIPLIERS = [1, 1.35, 1.7, 2] as const

export interface RecoveryMissResult {
  consecutiveMisses: number
  exhausted: boolean
}

export function registerRecoveryMiss(
  consecutiveMisses: number,
): RecoveryMissResult | null {
  if (!Number.isInteger(consecutiveMisses) || consecutiveMisses < 0) return null
  const nextMisses = consecutiveMisses + 1
  return {
    consecutiveMisses: nextMisses,
    exhausted: nextMisses > MAX_CONSECUTIVE_MISSES,
  }
}

export function recoveryAttemptFor(consecutiveMisses: number): number | null {
  if (!Number.isInteger(consecutiveMisses) || consecutiveMisses < 0) return null
  return Math.min(consecutiveMisses, MAX_CONSECUTIVE_MISSES)
}

export function recoveryGeometryFor(
  base: AssistedTrackingGeometry,
  consecutiveMisses: number,
): AssistedTrackingGeometry | null {
  if (!isValidAssistedTrackingGeometry(base)) return null
  const recoveryAttempt = recoveryAttemptFor(consecutiveMisses)
  if (recoveryAttempt === null) return null
  if (recoveryAttempt === 0) return { ...base }

  const requestedRadius = Math.round(
    base.nativeSearchRadius * RECOVERY_SEARCH_MULTIPLIERS[recoveryAttempt]!,
  )
  const maximumAlignedRadius = Math.floor(
    ASSISTED_GEOMETRY_LIMITS.maximumRecoveryNativeSearchRadius /
      base.coarseScale,
  ) * base.coarseScale
  const coarseRadius = Math.ceil(
    Math.min(requestedRadius, maximumAlignedRadius) / base.coarseScale,
  )
  const geometry = {
    ...base,
    coarseRadius,
    nativeSearchRadius: coarseRadius * base.coarseScale,
  }
  return isValidAssistedTrackingSearchGeometry(geometry) ? geometry : null
}

export function recoveryExhaustedReason(consecutiveMisses: number): string {
  return `Tracking lost after ${consecutiveMisses} consecutive frames. ` +
    'Try reseeding the target near the last reliable position.'
}
