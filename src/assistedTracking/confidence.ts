export const MIN_TEMPLATE_STANDARD_DEVIATION = 6
export const GOOD_TEMPLATE_STANDARD_DEVIATION = 24
export const MAX_NORMALIZED_MEAN_ABSOLUTE_ERROR = 0.22
export const MIN_RELATIVE_SCORE_MARGIN = 0.08
export const GOOD_RELATIVE_SCORE_MARGIN = 0.2
export const MIN_TRACKING_CONFIDENCE = 0.55

const CONFIDENCE_COMPARISON_EPSILON = 1e-12

export interface MatchEvidence {
  bestScore: number
  secondBestScore: number | null
  templateStandardDeviation: number
  boundaryCandidate: boolean
}

export interface ConfidenceAssessment {
  accepted: boolean
  confidence: number
  relativeMargin: number | null
  reason: string | null
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function standardDeviation(pixels: Uint8Array): number | null {
  if (pixels.length === 0) return null

  let sum = 0
  for (const pixel of pixels) sum += pixel
  const mean = sum / pixels.length

  let squaredDifferenceSum = 0
  for (const pixel of pixels) {
    const difference = pixel - mean
    squaredDifferenceSum += difference * difference
  }

  const deviation = Math.sqrt(squaredDifferenceSum / pixels.length)
  return Number.isFinite(deviation) ? deviation : null
}

export function evaluateMatchConfidence(
  evidence: MatchEvidence,
): ConfidenceAssessment {
  const { bestScore, secondBestScore, templateStandardDeviation } = evidence
  if (
    !Number.isFinite(bestScore) ||
    bestScore < 0 ||
    !Number.isFinite(templateStandardDeviation) ||
    templateStandardDeviation < 0 ||
    (secondBestScore !== null &&
      (!Number.isFinite(secondBestScore) || secondBestScore < 0))
  ) {
    return {
      accepted: false,
      confidence: 0,
      relativeMargin: null,
      reason: 'The tracker produced invalid confidence evidence.',
    }
  }

  const relativeMargin =
    secondBestScore === null
      ? null
      : Math.max(0, secondBestScore - bestScore) /
        Math.max(secondBestScore, Number.EPSILON)

  const quality = clamp01(
    1 - bestScore / MAX_NORMALIZED_MEAN_ABSOLUTE_ERROR,
  )
  const separation =
    relativeMargin === null
      ? 1
      : clamp01(relativeMargin / GOOD_RELATIVE_SCORE_MARGIN)
  const texture = clamp01(
    (templateStandardDeviation - MIN_TEMPLATE_STANDARD_DEVIATION) /
      (GOOD_TEMPLATE_STANDARD_DEVIATION - MIN_TEMPLATE_STANDARD_DEVIATION),
  )
  const boundaryPenalty = evidence.boundaryCandidate ? 0.9 : 1
  const confidence = clamp01(
    (quality * 0.55 + separation * 0.3 + texture * 0.15) * boundaryPenalty,
  )

  let reason: string | null = null
  if (templateStandardDeviation < MIN_TEMPLATE_STANDARD_DEVIATION) {
    reason = 'The seed patch is too flat or featureless to track reliably.'
  } else if (bestScore > MAX_NORMALIZED_MEAN_ABSOLUTE_ERROR) {
    reason = 'The best candidate differs too much from the seed template.'
  } else if (
    relativeMargin !== null &&
    relativeMargin + CONFIDENCE_COMPARISON_EPSILON < MIN_RELATIVE_SCORE_MARGIN
  ) {
    reason = 'Several candidates look equally plausible in the search area.'
  } else if (confidence < MIN_TRACKING_CONFIDENCE) {
    reason = 'The combined match confidence is below the safe threshold.'
  }

  return {
    accepted: reason === null,
    confidence,
    relativeMargin,
    reason,
  }
}
