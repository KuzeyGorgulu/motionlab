import {
  GOOD_RELATIVE_SCORE_MARGIN,
  MAX_NORMALIZED_MEAN_ABSOLUTE_ERROR,
} from './confidence'
import { matchClusterRadiusFor } from './matchClustering'
import { locateTemplate } from './templateTracker'
import type {
  AssistedTemplateSource,
  GrayImage,
  MatchDiagnostics,
  SearchPixelRegion,
  TrackingMatch,
} from './types'

export const MINIMUM_TEMPLATE_UPDATE_CONFIDENCE = 0.82
export const MAXIMUM_TEMPLATE_UPDATE_ERROR =
  MAX_NORMALIZED_MEAN_ABSOLUTE_ERROR / 2
export const TEMPLATE_UPDATE_ALPHA = 0.1

export interface AdaptiveTemplateState {
  seedTemplate: GrayImage
  currentTemplate: GrayImage
  updateCount: number
}

export interface AdaptiveTemplateLocateOutcome {
  result: TrackingMatch
  pendingTemplateUpdate: GrayImage | null
}

function validGrayImage(image: GrayImage): boolean {
  return (
    Number.isInteger(image.width) &&
    Number.isInteger(image.height) &&
    image.width > 0 &&
    image.height > 0 &&
    image.pixels.length === image.width * image.height
  )
}

function cloneGrayImage(image: GrayImage): GrayImage {
  return {
    width: image.width,
    height: image.height,
    pixels: new Uint8Array(image.pixels),
  }
}

export function createAdaptiveTemplateState(
  seedTemplate: GrayImage,
): AdaptiveTemplateState | null {
  if (!validGrayImage(seedTemplate)) return null
  return {
    seedTemplate: cloneGrayImage(seedTemplate),
    currentTemplate: cloneGrayImage(seedTemplate),
    updateCount: 0,
  }
}

export function shouldUpdateAdaptiveTemplate(
  match: Extract<TrackingMatch, { status: 'match' }>,
): boolean {
  const margin = match.diagnostics?.ambiguityMargin ?? null
  return (
    match.confidence >= MINIMUM_TEMPLATE_UPDATE_CONFIDENCE &&
    match.score <= MAXIMUM_TEMPLATE_UPDATE_ERROR &&
    (margin === null || margin >= GOOD_RELATIVE_SCORE_MARGIN)
  )
}

function withTemplateSource(
  result: TrackingMatch,
  source: AssistedTemplateSource,
): TrackingMatch {
  return { ...result, templateSource: source }
}

function matchedCenter(
  result: Extract<TrackingMatch, { status: 'match' }>,
  searchRegion: Pick<SearchPixelRegion, 'expectedTemplateCenter'>,
) {
  return {
    x: searchRegion.expectedTemplateCenter.x + result.displacement.x,
    y: searchRegion.expectedTemplateCenter.y + result.displacement.y,
  }
}

function compareAcceptedMatches(
  left: Extract<TrackingMatch, { status: 'match' }>,
  right: Extract<TrackingMatch, { status: 'match' }>,
): number {
  return left.score - right.score ||
    right.confidence - left.confidence ||
    (left.templateSource === 'current' ? -1 : 1)
}

function compareRejectedMatches(
  left: Extract<TrackingMatch, { status: 'low-confidence' }>,
  right: Extract<TrackingMatch, { status: 'low-confidence' }>,
): number {
  return right.confidence - left.confidence ||
    (left.score ?? Number.POSITIVE_INFINITY) -
      (right.score ?? Number.POSITIVE_INFINITY) ||
    (left.templateSource === 'current' ? -1 : 1)
}

function combinedAmbiguityDiagnostics(
  best: Extract<TrackingMatch, { status: 'match' }>,
  second: Extract<TrackingMatch, { status: 'match' }>,
  searchRegion: Pick<SearchPixelRegion, 'expectedTemplateCenter' | 'geometry'>,
  separation: number,
): MatchDiagnostics | undefined {
  const bestDiagnostics = best.diagnostics
  const secondDiagnostics = second.diagnostics
  const clusterRadius = matchClusterRadiusFor(searchRegion.geometry)
  if (
    bestDiagnostics === undefined ||
    secondDiagnostics === undefined ||
    clusterRadius === null
  ) {
    return undefined
  }
  const secondScore = second.score
  return {
    refinedCandidateCount:
      bestDiagnostics.refinedCandidateCount +
      secondDiagnostics.refinedCandidateCount,
    retainedRepresentativeCount:
      bestDiagnostics.retainedRepresentativeCount +
      secondDiagnostics.retainedRepresentativeCount,
    clusterCount: Math.max(
      2,
      bestDiagnostics.clusterCount + secondDiagnostics.clusterCount,
    ),
    bestClusterCandidateCount: bestDiagnostics.bestClusterCandidateCount,
    clusterRadius,
    bestClusterScore: best.score,
    secondClusterScore: secondScore,
    bestSecondClusterSeparation: separation,
    ambiguityMargin:
      Math.max(0, secondScore - best.score) /
      Math.max(secondScore, Number.EPSILON),
    motionTieBreakUsed: false,
    bestCandidateCenter: matchedCenter(best, searchRegion),
  }
}

function chooseRecoveryResult(
  current: TrackingMatch,
  seed: TrackingMatch,
  searchRegion: Pick<
    SearchPixelRegion,
    'expectedTemplateCenter' | 'geometry'
  >,
): TrackingMatch {
  if (current.status === 'match' && seed.status === 'match') {
    const currentCenter = matchedCenter(current, searchRegion)
    const seedCenter = matchedCenter(seed, searchRegion)
    const separation = Math.hypot(
      currentCenter.x - seedCenter.x,
      currentCenter.y - seedCenter.y,
    )
    const clusterRadius = matchClusterRadiusFor(searchRegion.geometry)
    const ordered = [current, seed].sort(compareAcceptedMatches)
    const best = ordered[0]!
    const second = ordered[1]!
    if (clusterRadius === null) {
      return {
        status: 'invalid-frame',
        reason: 'The recovery template-cluster geometry is invalid.',
      }
    }
    if (separation > clusterRadius) {
      return {
        status: 'low-confidence',
        confidence: Math.min(current.confidence, seed.confidence),
        score: best.score,
        reason:
          'The current and seed templates found different plausible targets.',
        diagnostics: combinedAmbiguityDiagnostics(
          best,
          second,
          searchRegion,
          separation,
        ),
        templateSource: best.templateSource,
      }
    }
    return best
  }
  if (current.status === 'match') return current
  if (seed.status === 'match') return seed
  if (current.status === 'low-confidence' && seed.status === 'low-confidence') {
    return [current, seed].sort(compareRejectedMatches)[0]!
  }
  if (current.status === 'low-confidence') return current
  if (seed.status === 'low-confidence') return seed
  return current
}

function observedTemplateAtMatch(
  search: GrayImage,
  searchOrigin: SearchPixelRegion['origin'],
  center: SearchPixelRegion['expectedTemplateCenter'],
  templateSize: number,
): GrayImage | null {
  const half = (templateSize - 1) / 2
  const left = Math.round(center.x - searchOrigin.x - half)
  const top = Math.round(center.y - searchOrigin.y - half)
  if (
    left < 0 ||
    top < 0 ||
    left + templateSize > search.width ||
    top + templateSize > search.height
  ) {
    return null
  }
  const pixels = new Uint8Array(templateSize * templateSize)
  for (let y = 0; y < templateSize; y += 1) {
    const sourceRow = (top + y) * search.width + left
    const targetRow = y * templateSize
    for (let x = 0; x < templateSize; x += 1) {
      pixels[targetRow + x] = search.pixels[sourceRow + x]!
    }
  }
  return { width: templateSize, height: templateSize, pixels }
}

function blendTemplate(
  current: GrayImage,
  observed: GrayImage,
): GrayImage | null {
  if (
    !validGrayImage(current) ||
    !validGrayImage(observed) ||
    current.width !== observed.width ||
    current.height !== observed.height
  ) {
    return null
  }
  let changed = false
  const pixels = new Uint8Array(current.pixels.length)
  for (let index = 0; index < pixels.length; index += 1) {
    const blended = Math.round(
      current.pixels[index]! * (1 - TEMPLATE_UPDATE_ALPHA) +
        observed.pixels[index]! * TEMPLATE_UPDATE_ALPHA,
    )
    pixels[index] = blended
    if (blended !== current.pixels[index]) changed = true
  }
  return changed
    ? { width: current.width, height: current.height, pixels }
    : null
}

export function locateWithAdaptiveTemplates(
  state: AdaptiveTemplateState,
  search: GrayImage,
  searchRegion: Pick<
    SearchPixelRegion,
    | 'origin'
    | 'expectedTemplateCenter'
    | 'searchCenter'
    | 'geometry'
    | 'recoveryAttempt'
  >,
): AdaptiveTemplateLocateOutcome {
  const current = withTemplateSource(
    locateTemplate(state.currentTemplate, search, searchRegion),
    'current',
  )
  const result = searchRegion.recoveryAttempt > 0 && state.updateCount > 0
    ? chooseRecoveryResult(
        current,
        withTemplateSource(
          locateTemplate(state.seedTemplate, search, searchRegion),
          'seed',
        ),
        searchRegion,
      )
    : current

  if (result.status !== 'match' || !shouldUpdateAdaptiveTemplate(result)) {
    return { result, pendingTemplateUpdate: null }
  }
  const observation = observedTemplateAtMatch(
    search,
    searchRegion.origin,
    matchedCenter(result, searchRegion),
    state.currentTemplate.width,
  )
  const pendingTemplateUpdate = observation === null
    ? null
    : blendTemplate(state.currentTemplate, observation)
  return {
    result: {
      ...result,
      templateUpdateEligible: pendingTemplateUpdate !== null,
    },
    pendingTemplateUpdate,
  }
}

export function commitAdaptiveTemplateUpdate(
  state: AdaptiveTemplateState,
  pendingTemplateUpdate: GrayImage | null,
): AdaptiveTemplateState {
  if (
    pendingTemplateUpdate === null ||
    !validGrayImage(pendingTemplateUpdate) ||
    pendingTemplateUpdate.width !== state.currentTemplate.width ||
    pendingTemplateUpdate.height !== state.currentTemplate.height
  ) {
    return state
  }
  return {
    seedTemplate: state.seedTemplate,
    currentTemplate: cloneGrayImage(pendingTemplateUpdate),
    updateCount: state.updateCount + 1,
  }
}
