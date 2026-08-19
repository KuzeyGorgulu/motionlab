import { describe, expect, it } from 'vitest'

import { assistedTrackingGeometryFor } from './geometry'
import {
  MAXIMUM_MATCH_CLUSTER_CANDIDATES,
  clusterMatchCandidates,
  matchClusterRadiusFor,
} from './matchClustering'
import type { RefinedMatchCandidate } from './matchClustering'

describe('match-basin clustering', () => {
  it('merges nearby candidates from one local optimum', () => {
    const result = clusterMatchCandidates([
      { x: 100, y: 100, score: 0.04 },
      { x: 107, y: 103, score: 0.041 },
      { x: 108, y: 104, score: 0.045 },
    ], 9)

    expect(result?.basins).toEqual([
      {
        representative: { x: 100, y: 100, score: 0.04 },
        candidateCount: 3,
      },
    ])
  })

  it('merges separate coarse hypotheses that refine into one basin', () => {
    const result = clusterMatchCandidates([
      { x: 202, y: 160, score: 0.018 },
      { x: 210, y: 165, score: 0.02 },
    ], 10)

    expect(result?.basins).toHaveLength(1)
    expect(result?.basins[0]).toEqual({
      representative: { x: 202, y: 160, score: 0.018 },
      candidateCount: 2,
    })
  })

  it('does not let a weaker bridge collapse two strong separate basins', () => {
    const result = clusterMatchCandidates([
      { x: 0, y: 0, score: 0.01 },
      { x: 20, y: 0, score: 0.08 },
      { x: 40, y: 0, score: 0.011 },
    ], 21)

    expect(result?.basins).toHaveLength(2)
    expect(result?.basins.map((basin) => basin.representative.x)).toEqual([
      0,
      40,
    ])
  })

  it('retains genuinely separated candidates as separate basins', () => {
    const result = clusterMatchCandidates([
      { x: 20, y: 30, score: 0.03 },
      { x: 120, y: 30, score: 0.031 },
    ], 20)

    expect(result?.basins).toHaveLength(2)
    expect(result?.basins.map((basin) => basin.representative.x)).toEqual([
      20,
      120,
    ])
  })

  it('uses an inclusive cluster-radius boundary', () => {
    const candidates: RefinedMatchCandidate[] = [
      { x: 0, y: 0, score: 0.01 },
      { x: 10, y: 0, score: 0.02 },
    ]
    expect(clusterMatchCandidates(candidates, 10)?.basins).toHaveLength(1)

    candidates[1] = { x: 11, y: 0, score: 0.02 }
    expect(clusterMatchCandidates(candidates, 10)?.basins).toHaveLength(2)
  })

  it.each([
    ['720p', { width: 1280, height: 720 }, 14],
    ['1080p', { width: 1920, height: 1080 }, 22],
    ['1440p', { width: 2560, height: 1440 }, 29],
    ['4K', { width: 4096, height: 2160 }, 42],
  ])('derives a bounded native-pixel radius for %s geometry', (
    _label,
    size,
    expectedRadius,
  ) => {
    const geometry = assistedTrackingGeometryFor(size)!
    expect(matchClusterRadiusFor(geometry)).toBe(expectedRadius)
  })

  it('keeps the best observed integer position instead of averaging', () => {
    const candidates: RefinedMatchCandidate[] = [
      { x: 10, y: 10, score: 0.04 },
      { x: 16, y: 12, score: 0.01 },
    ]
    const before = candidates.map((candidate) => ({ ...candidate }))
    const first = clusterMatchCandidates(candidates, 12)
    const second = clusterMatchCandidates(candidates, 12)

    expect(first).toEqual(second)
    expect(first?.basins[0]?.representative).toEqual({
      x: 16,
      y: 12,
      score: 0.01,
    })
    expect(candidates).toEqual(before)
  })

  it('rejects invalid or unexpectedly unbounded candidate sets', () => {
    expect(clusterMatchCandidates([], 12)).toBeNull()
    expect(clusterMatchCandidates([{ x: 0.5, y: 0, score: 0.1 }], 12)).toBeNull()
    expect(
      clusterMatchCandidates(
        Array.from(
          { length: MAXIMUM_MATCH_CLUSTER_CANDIDATES + 1 },
          (_, index) => ({ x: index, y: 0, score: index / 100 }),
        ),
        12,
      ),
    ).toBeNull()
  })
})
