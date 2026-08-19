import { describe, expect, it } from 'vitest'

import {
  MIN_RELATIVE_SCORE_MARGIN,
  evaluateMatchConfidence,
} from './confidence'

describe('assisted tracking confidence', () => {
  it('accepts a strong unique textured match', () => {
    const result = evaluateMatchConfidence({
      bestScore: 0.015,
      secondBestScore: 0.28,
      templateStandardDeviation: 42,
      boundaryCandidate: false,
    })
    expect(result.accepted).toBe(true)
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('rejects a poor absolute match', () => {
    const result = evaluateMatchConfidence({
      bestScore: 0.4,
      secondBestScore: 0.5,
      templateStandardDeviation: 42,
      boundaryCandidate: false,
    })
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/differs too much/i)
  })

  it('rejects two similarly strong matches as ambiguous', () => {
    const result = evaluateMatchConfidence({
      bestScore: 0.01,
      secondBestScore: 0.0105,
      templateStandardDeviation: 42,
      boundaryCandidate: false,
    })
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/equally plausible/i)
  })

  it('rejects a low-texture template even with a small score', () => {
    const result = evaluateMatchConfidence({
      bestScore: 0,
      secondBestScore: 0.4,
      templateStandardDeviation: 1,
      boundaryCandidate: false,
    })
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/featureless/i)
  })

  it('treats the documented ambiguity threshold as inclusive', () => {
    const secondBestScore = 0.1
    const atThreshold = evaluateMatchConfidence({
      bestScore: secondBestScore * (1 - MIN_RELATIVE_SCORE_MARGIN),
      secondBestScore,
      templateStandardDeviation: 42,
      boundaryCandidate: false,
    })
    const belowThreshold = evaluateMatchConfidence({
      bestScore: secondBestScore * (1 - MIN_RELATIVE_SCORE_MARGIN / 2),
      secondBestScore,
      templateStandardDeviation: 42,
      boundaryCandidate: false,
    })
    expect(atThreshold.accepted).toBe(true)
    expect(belowThreshold.accepted).toBe(false)
  })
})
