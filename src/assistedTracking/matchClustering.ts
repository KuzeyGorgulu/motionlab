import { isValidAssistedTrackingSearchGeometry } from './geometry'
import type { AssistedTrackingGeometry } from './types'

export const MAXIMUM_MATCH_CLUSTER_CANDIDATES = 8
export const MINIMUM_MATCH_CLUSTER_RADIUS = 12
export const MAXIMUM_MATCH_CLUSTER_RADIUS = 48
export const TEMPLATE_MATCH_CLUSTER_FRACTION = 2 / 3

export interface RefinedMatchCandidate {
  x: number
  y: number
  score: number
}

export interface MatchBasin {
  representative: RefinedMatchCandidate
  candidateCount: number
}

export interface MatchBasinClustering {
  radius: number
  basins: MatchBasin[]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function compareCandidates(
  left: RefinedMatchCandidate,
  right: RefinedMatchCandidate,
): number {
  return left.score - right.score || left.y - right.y || left.x - right.x
}

function validCandidate(candidate: RefinedMatchCandidate): boolean {
  return (
    Number.isInteger(candidate.x) &&
    Number.isInteger(candidate.y) &&
    Number.isFinite(candidate.score) &&
    candidate.score >= 0
  )
}

/**
 * Returns the native-pixel linking distance for refined hypotheses. Candidates
 * at exactly this distance belong to the same connected match basin.
 */
export function matchClusterRadiusFor(
  geometry: AssistedTrackingGeometry,
): number | null {
  if (!isValidAssistedTrackingSearchGeometry(geometry)) return null

  return clamp(
    Math.max(
      Math.round(geometry.templateSize * TEMPLATE_MATCH_CLUSTER_FRACTION),
      geometry.refinementRadius * 2 + geometry.coarseScale,
    ),
    MINIMUM_MATCH_CLUSTER_RADIUS,
    MAXIMUM_MATCH_CLUSTER_RADIUS,
  )
}

/**
 * Greedily clusters a bounded set of refined hypothesis representatives by
 * native-pixel distance from each basin's best candidate. A weak candidate
 * between two basins cannot merge them. Positions are never averaged or
 * converted to subpixel estimates.
 */
export function clusterMatchCandidates(
  candidates: readonly RefinedMatchCandidate[],
  radius: number,
): MatchBasinClustering | null {
  if (
    !Number.isFinite(radius) ||
    radius < 0 ||
    candidates.length === 0 ||
    candidates.length > MAXIMUM_MATCH_CLUSTER_CANDIDATES ||
    candidates.some((candidate) => !validCandidate(candidate))
  ) {
    return null
  }

  const ordered = candidates
    .map((candidate) => ({ ...candidate }))
    .sort(compareCandidates)
  const maximumSquaredDistance = radius * radius
  const basins: MatchBasin[] = []
  for (const candidate of ordered) {
    let selectedBasin: MatchBasin | null = null
    let selectedSquaredDistance = Number.POSITIVE_INFINITY
    for (const basin of basins) {
      const deltaX = candidate.x - basin.representative.x
      const deltaY = candidate.y - basin.representative.y
      const squaredDistance = deltaX * deltaX + deltaY * deltaY
      if (
        squaredDistance <= maximumSquaredDistance &&
        squaredDistance < selectedSquaredDistance
      ) {
        selectedBasin = basin
        selectedSquaredDistance = squaredDistance
      }
    }

    if (selectedBasin === null) {
      basins.push({
        representative: { ...candidate },
        candidateCount: 1,
      })
      continue
    }
    selectedBasin.candidateCount += 1
  }

  return { radius, basins }
}
