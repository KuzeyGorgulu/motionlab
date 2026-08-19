import {
  MIN_TEMPLATE_STANDARD_DEVIATION,
  evaluateMatchConfidence,
  standardDeviation,
} from './confidence'
import { isValidAssistedTrackingSearchGeometry } from './geometry'
import {
  clusterMatchCandidates,
  matchClusterRadiusFor,
} from './matchClustering'
import type { RefinedMatchCandidate } from './matchClustering'
import { MAX_CONSECUTIVE_MISSES } from './recovery'
import type {
  AssistedTrackingGeometry,
  GrayImage,
  MatchDiagnostics,
  PixelRegion,
  SearchPixelRegion,
  TemplateMatch,
  TrackingMatch,
} from './types'
import type { Point } from '../video/geometry'

interface Candidate {
  x: number
  y: number
  score: number
}

export interface MatcherSearchPolicy {
  candidateStep: 1
  pixelStep: 1 | 2 | 4
  maximumRefinementSeeds: number
}

export interface MatcherWorkEstimate {
  coarsePixelComparisons: number
  maximumFinePixelComparisons: number
  maximumTotalPixelComparisons: number
}

const MAXIMUM_REFINEMENT_SEEDS = 12
export const MAXIMUM_COARSE_HYPOTHESES = 8

function validGrayImage(image: GrayImage): boolean {
  return (
    Number.isInteger(image.width) &&
    Number.isInteger(image.height) &&
    image.width > 0 &&
    image.height > 0 &&
    image.pixels.length === image.width * image.height
  )
}

export function grayscaleFromRgba(region: PixelRegion): GrayImage | null {
  if (
    !Number.isInteger(region.width) ||
    !Number.isInteger(region.height) ||
    region.width <= 0 ||
    region.height <= 0 ||
    !Number.isFinite(region.origin.x) ||
    !Number.isFinite(region.origin.y) ||
    region.pixels.length !== region.width * region.height * 4
  ) {
    return null
  }

  const pixels = new Uint8Array(region.width * region.height)
  for (let source = 0, target = 0; source < region.pixels.length; source += 4) {
    const red = region.pixels[source]!
    const green = region.pixels[source + 1]!
    const blue = region.pixels[source + 2]!
    pixels[target] = Math.round(red * 0.299 + green * 0.587 + blue * 0.114)
    target += 1
  }

  return { width: region.width, height: region.height, pixels }
}

function candidateScore(
  template: GrayImage,
  search: GrayImage,
  offsetX: number,
  offsetY: number,
  pixelStep: 1 | 2 | 4,
): number {
  let difference = 0
  if (pixelStep === 1) {
    for (let y = 0; y < template.height; y += 1) {
      const templateRow = y * template.width
      const searchRow = (offsetY + y) * search.width + offsetX
      for (let x = 0; x < template.width; x += 1) {
        difference += Math.abs(
          template.pixels[templateRow + x]! - search.pixels[searchRow + x]!,
        )
      }
    }
    return difference / (template.pixels.length * 255)
  }

  let sampleCount = 0
  for (let y = 0; y < template.height; y += 1) {
    const templateRow = y * template.width
    const searchRow = (offsetY + y) * search.width + offsetX
    for (let x = 0; x < template.width; x += 1) {
      if ((x + y) % pixelStep !== 0) continue
      difference += Math.abs(
        template.pixels[templateRow + x]! - search.pixels[searchRow + x]!,
      )
      sampleCount += 1
    }
  }
  return difference / (sampleCount * 255)
}

function compareCandidates(left: Candidate, right: Candidate): number {
  return left.score - right.score || left.y - right.y || left.x - right.x
}

function sampledTemplatePixelCount(
  template: GrayImage,
  pixelStep: MatcherSearchPolicy['pixelStep'],
): number {
  let count = 0
  for (let y = 0; y < template.height; y += 1) {
    for (let x = 0; x < template.width; x += 1) {
      if ((x + y) % pixelStep === 0) count += 1
    }
  }
  return count
}

function sampledOffsets(maximum: number, step: number): number[] {
  const offsets: number[] = []
  for (let offset = 0; offset <= maximum; offset += step) offsets.push(offset)
  if (offsets.at(-1) !== maximum) offsets.push(maximum)
  return offsets
}

export function matcherSearchPolicy(
  template: GrayImage,
  search: GrayImage,
): MatcherSearchPolicy {
  const maximumOffset = Math.max(
    0,
    search.width - template.width,
    search.height - template.height,
  )
  const minimumTemplateExtent = Math.min(template.width, template.height)
  if (minimumTemplateExtent >= 51 || maximumOffset > 128) {
    return {
      candidateStep: 1,
      pixelStep: 4,
      maximumRefinementSeeds: MAXIMUM_REFINEMENT_SEEDS,
    }
  }
  if (minimumTemplateExtent >= 31 || maximumOffset > 64) {
    return {
      candidateStep: 1,
      pixelStep: 2,
      maximumRefinementSeeds: MAXIMUM_REFINEMENT_SEEDS,
    }
  }
  return {
    candidateStep: 1,
    pixelStep: 1,
    maximumRefinementSeeds: MAXIMUM_REFINEMENT_SEEDS,
  }
}

export function estimateMatcherWork(
  template: GrayImage,
  search: GrayImage,
): MatcherWorkEstimate {
  const policy = matcherSearchPolicy(template, search)
  const candidateColumns = Math.max(0, search.width - template.width + 1)
  const candidateRows = Math.max(0, search.height - template.height + 1)
  const candidateCount = candidateColumns * candidateRows
  const coarsePixelComparisons = candidateCount *
    sampledTemplatePixelCount(template, policy.pixelStep)
  const maximumFinePixelComparisons = policy.pixelStep === 1
    ? 0
    : policy.maximumRefinementSeeds *
      (policy.candidateStep * 2 + 1) ** 2 *
      template.width * template.height
  return {
    coarsePixelComparisons,
    maximumFinePixelComparisons,
    maximumTotalPixelComparisons:
      coarsePixelComparisons + maximumFinePixelComparisons,
  }
}

function exhaustiveCandidates(
  template: GrayImage,
  search: GrayImage,
  maxX: number,
  maxY: number,
): Candidate[] {
  const candidates: Candidate[] = []
  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      candidates.push({
        x,
        y,
        score: candidateScore(template, search, x, y, 1),
      })
    }
  }
  return candidates
}

function refinementSeeds(
  candidates: readonly Candidate[],
  policy: MatcherSearchPolicy,
  minimumTemplateExtent: number,
): Candidate[] {
  const selected: Candidate[] = []
  const minimumSeparation = Math.max(
    policy.candidateStep * 2,
    minimumTemplateExtent / 2,
  )
  for (const candidate of candidates) {
    if (
      selected.some((item) =>
        Math.hypot(item.x - candidate.x, item.y - candidate.y) <
          minimumSeparation,
      )
    ) {
      continue
    }
    selected.push(candidate)
    if (selected.length === policy.maximumRefinementSeeds) break
  }
  return selected
}

function coarseToFineCandidates(
  template: GrayImage,
  search: GrayImage,
  maxX: number,
  maxY: number,
  policy: MatcherSearchPolicy,
): Candidate[] {
  const coarse: Candidate[] = []
  for (const y of sampledOffsets(maxY, policy.candidateStep)) {
    for (const x of sampledOffsets(maxX, policy.candidateStep)) {
      coarse.push({
        x,
        y,
        score: candidateScore(template, search, x, y, policy.pixelStep),
      })
    }
  }
  coarse.sort(compareCandidates)

  const refined = new Map<string, Candidate>()
  for (const seed of refinementSeeds(
    coarse,
    policy,
    Math.min(template.width, template.height),
  )) {
    const left = Math.max(0, seed.x - policy.candidateStep)
    const right = Math.min(maxX, seed.x + policy.candidateStep)
    const top = Math.max(0, seed.y - policy.candidateStep)
    const bottom = Math.min(maxY, seed.y + policy.candidateStep)
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const key = `${x}:${y}`
        if (refined.has(key)) continue
        refined.set(key, {
          x,
          y,
          score: candidateScore(template, search, x, y, 1),
        })
      }
    }
  }
  return [...refined.values()]
}

export function matchTemplate(
  template: GrayImage,
  search: GrayImage,
  searchOrigin = { x: 0, y: 0 },
): TemplateMatch {
  if (
    !validGrayImage(template) ||
    !validGrayImage(search) ||
    !Number.isFinite(searchOrigin.x) ||
    !Number.isFinite(searchOrigin.y) ||
    template.width > search.width ||
    template.height > search.height
  ) {
    return {
      status: 'invalid-frame',
      reason: 'Template or search-region dimensions are invalid.',
    }
  }

  const texture = standardDeviation(template.pixels)
  if (texture === null) {
    return { status: 'invalid-frame', reason: 'The seed template is empty.' }
  }

  const maxX = search.width - template.width
  const maxY = search.height - template.height
  const policy = matcherSearchPolicy(template, search)
  const candidates = policy.pixelStep === 1
    ? exhaustiveCandidates(template, search, maxX, maxY)
    : coarseToFineCandidates(template, search, maxX, maxY, policy)
  candidates.sort(compareCandidates)
  const best = candidates[0] ?? null

  if (best === null || !Number.isFinite(best.score)) {
    return { status: 'invalid-frame', reason: 'No valid match candidates exist.' }
  }

  const distinctDistance = Math.max(
    2,
    Math.min(template.width, template.height) / 2,
  )
  let secondBest: Candidate | null = null
  for (const candidate of candidates) {
    if (
      Math.hypot(candidate.x - best.x, candidate.y - best.y) < distinctDistance
    ) {
      continue
    }
    if (secondBest === null || compareCandidates(candidate, secondBest) < 0) {
      secondBest = candidate
    }
  }

  const assessment = evaluateMatchConfidence({
    bestScore: best.score,
    secondBestScore: secondBest?.score ?? null,
    templateStandardDeviation: texture,
    boundaryCandidate:
      best.x === 0 || best.y === 0 || best.x === maxX || best.y === maxY,
  })

  if (!assessment.accepted) {
    return {
      status: 'low-confidence',
      confidence: assessment.confidence,
      score: best.score,
      reason: assessment.reason ?? 'The match confidence is too low.',
    }
  }

  return {
    status: 'match',
    matchedCenter: {
      x: searchOrigin.x + best.x + (template.width - 1) / 2,
      y: searchOrigin.y + best.y + (template.height - 1) / 2,
    },
    confidence: assessment.confidence,
    score: best.score,
  }
}

export function downsampleGrayImage(
  image: GrayImage,
  scale: number,
): GrayImage | null {
  if (!validGrayImage(image) || !Number.isInteger(scale) || scale <= 0) {
    return null
  }
  if (scale === 1) {
    return {
      width: image.width,
      height: image.height,
      pixels: new Uint8Array(image.pixels),
    }
  }

  const width = Math.floor(image.width / scale)
  const height = Math.floor(image.height / scale)
  if (width <= 0 || height <= 0) return null

  const pixels = new Uint8Array(width * height)
  const sampleCount = scale * scale
  for (let targetY = 0; targetY < height; targetY += 1) {
    const sourceTop = targetY * scale
    for (let targetX = 0; targetX < width; targetX += 1) {
      const sourceLeft = targetX * scale
      let sum = 0
      for (let offsetY = 0; offsetY < scale; offsetY += 1) {
        const sourceRow = (sourceTop + offsetY) * image.width + sourceLeft
        for (let offsetX = 0; offsetX < scale; offsetX += 1) {
          sum += image.pixels[sourceRow + offsetX]!
        }
      }
      pixels[targetY * width + targetX] = Math.round(sum / sampleCount)
    }
  }
  return { width, height, pixels }
}

export interface CoarseToFineWorkEstimate {
  coarsePixelComparisons: number
  maximumFinePixelComparisons: number
  maximumTotalPixelComparisons: number
}

export function estimateCoarseToFineWork(
  template: GrayImage,
  search: GrayImage,
  geometry: AssistedTrackingGeometry,
): CoarseToFineWorkEstimate | null {
  if (
    !validGrayImage(template) ||
    !validGrayImage(search) ||
    !isValidAssistedTrackingSearchGeometry(geometry)
  ) {
    return null
  }
  const coarseTemplateWidth = Math.floor(template.width / geometry.coarseScale)
  const coarseTemplateHeight = Math.floor(template.height / geometry.coarseScale)
  const coarseSearchWidth = Math.floor(search.width / geometry.coarseScale)
  const coarseSearchHeight = Math.floor(search.height / geometry.coarseScale)
  if (
    coarseTemplateWidth <= 0 ||
    coarseTemplateHeight <= 0 ||
    coarseTemplateWidth > coarseSearchWidth ||
    coarseTemplateHeight > coarseSearchHeight
  ) {
    return null
  }
  const candidateColumns =
    Math.floor(
      (coarseSearchWidth - coarseTemplateWidth) / geometry.coarseStep,
    ) + 1
  const candidateRows =
    Math.floor(
      (coarseSearchHeight - coarseTemplateHeight) / geometry.coarseStep,
    ) + 1
  const coarsePixelComparisons = candidateColumns * candidateRows *
    coarseTemplateWidth * coarseTemplateHeight
  const refinementExtent = geometry.refinementRadius * 2 + 1
  const maximumFinePixelComparisons = MAXIMUM_COARSE_HYPOTHESES *
    refinementExtent * refinementExtent * template.width * template.height
  return {
    coarsePixelComparisons,
    maximumFinePixelComparisons,
    maximumTotalPixelComparisons:
      coarsePixelComparisons + maximumFinePixelComparisons,
  }
}

function isBetterCandidate(
  score: number,
  x: number,
  y: number,
  bestScore: number,
  bestX: number,
  bestY: number,
): boolean {
  return score < bestScore ||
    (score === bestScore && (y < bestY || (y === bestY && x < bestX)))
}

export function matchTemplateCoarseToFine(
  template: GrayImage,
  search: GrayImage,
  geometry: AssistedTrackingGeometry,
  searchOrigin = { x: 0, y: 0 },
): TemplateMatch {
  if (
    !validGrayImage(template) ||
    !validGrayImage(search) ||
    !isValidAssistedTrackingSearchGeometry(geometry) ||
    !Number.isFinite(searchOrigin.x) ||
    !Number.isFinite(searchOrigin.y) ||
    template.width !== geometry.templateSize ||
    template.height !== geometry.templateSize ||
    template.width > search.width ||
    template.height > search.height
  ) {
    return {
      status: 'invalid-frame',
      reason: 'Template, search-region, or coarse-search geometry is invalid.',
    }
  }

  const texture = standardDeviation(template.pixels)
  if (texture === null) {
    return { status: 'invalid-frame', reason: 'The seed template is empty.' }
  }
  if (texture < MIN_TEMPLATE_STANDARD_DEVIATION) {
    return {
      status: 'low-confidence',
      confidence: 0,
      score: null,
      reason: 'The seed patch is too flat or featureless to track reliably.',
    }
  }

  const coarseTemplate = downsampleGrayImage(template, geometry.coarseScale)
  const coarseSearch = downsampleGrayImage(search, geometry.coarseScale)
  if (
    coarseTemplate === null ||
    coarseSearch === null ||
    coarseTemplate.width > coarseSearch.width ||
    coarseTemplate.height > coarseSearch.height
  ) {
    return {
      status: 'invalid-frame',
      reason: 'The coarse grayscale search region is invalid.',
    }
  }

  const coarseMaxX = coarseSearch.width - coarseTemplate.width
  const coarseMaxY = coarseSearch.height - coarseTemplate.height
  const coarseColumns = Math.floor(coarseMaxX / geometry.coarseStep) + 1
  const coarseRows = Math.floor(coarseMaxY / geometry.coarseStep) + 1
  const coarseScores = new Float64Array(coarseColumns * coarseRows)
  let coarseIndex = 0
  for (let row = 0; row < coarseRows; row += 1) {
    const y = row * geometry.coarseStep
    for (let column = 0; column < coarseColumns; column += 1) {
      const x = column * geometry.coarseStep
      coarseScores[coarseIndex] = candidateScore(
        coarseTemplate,
        coarseSearch,
        x,
        y,
        1,
      )
      coarseIndex += 1
    }
  }

  const hypotheses = new Int32Array(MAXIMUM_COARSE_HYPOTHESES).fill(-1)
  let hypothesisCount = 0
  const distinctDistance = Math.max(
    2,
    Math.min(template.width, template.height) / 2,
  )
  for (let slot = 0; slot < hypotheses.length; slot += 1) {
    let selectedIndex = -1
    let selectedScore = Number.POSITIVE_INFINITY
    let selectedX = Number.POSITIVE_INFINITY
    let selectedY = Number.POSITIVE_INFINITY
    for (let index = 0; index < coarseScores.length; index += 1) {
      const coarseX = (index % coarseColumns) * geometry.coarseStep
      const coarseY = Math.floor(index / coarseColumns) * geometry.coarseStep
      const nativeX = coarseX * geometry.coarseScale
      const nativeY = coarseY * geometry.coarseScale
      let spatiallyDistinct = true
      for (let prior = 0; prior < hypothesisCount; prior += 1) {
        const priorIndex = hypotheses[prior]!
        const priorX = (priorIndex % coarseColumns) *
          geometry.coarseStep * geometry.coarseScale
        const priorY = Math.floor(priorIndex / coarseColumns) *
          geometry.coarseStep * geometry.coarseScale
        if (Math.hypot(nativeX - priorX, nativeY - priorY) < distinctDistance) {
          spatiallyDistinct = false
          break
        }
      }
      if (
        spatiallyDistinct &&
        isBetterCandidate(
          coarseScores[index]!,
          nativeX,
          nativeY,
          selectedScore,
          selectedX,
          selectedY,
        )
      ) {
        selectedIndex = index
        selectedScore = coarseScores[index]!
        selectedX = nativeX
        selectedY = nativeY
      }
    }
    if (selectedIndex < 0) break
    hypotheses[hypothesisCount] = selectedIndex
    hypothesisCount += 1
  }

  if (hypothesisCount === 0) {
    return { status: 'invalid-frame', reason: 'No coarse match candidates exist.' }
  }

  const fullMaxX = search.width - template.width
  const fullMaxY = search.height - template.height
  const representatives: RefinedMatchCandidate[] = []
  let fineCount = 0
  for (let hypothesis = 0; hypothesis < hypothesisCount; hypothesis += 1) {
    const index = hypotheses[hypothesis]!
    const coarseX = (index % coarseColumns) * geometry.coarseStep
    const coarseY = Math.floor(index / coarseColumns) * geometry.coarseStep
    const centerX = coarseX * geometry.coarseScale
    const centerY = coarseY * geometry.coarseScale
    const left = Math.max(0, centerX - geometry.refinementRadius)
    const right = Math.min(fullMaxX, centerX + geometry.refinementRadius)
    const top = Math.max(0, centerY - geometry.refinementRadius)
    const bottom = Math.min(fullMaxY, centerY + geometry.refinementRadius)
    let hypothesisBestScore = Number.POSITIVE_INFINITY
    let hypothesisBestX = Number.POSITIVE_INFINITY
    let hypothesisBestY = Number.POSITIVE_INFINITY
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const score = candidateScore(template, search, x, y, 1)
        fineCount += 1
        if (
          isBetterCandidate(
            score,
            x,
            y,
            hypothesisBestScore,
            hypothesisBestX,
            hypothesisBestY,
          )
        ) {
          hypothesisBestScore = score
          hypothesisBestX = x
          hypothesisBestY = y
        }
      }
    }
    if (
      Number.isFinite(hypothesisBestScore) &&
      Number.isFinite(hypothesisBestX) &&
      Number.isFinite(hypothesisBestY)
    ) {
      representatives.push({
        x: hypothesisBestX,
        y: hypothesisBestY,
        score: hypothesisBestScore,
      })
    }
  }

  const clusterRadius = matchClusterRadiusFor(geometry)
  const clustering = clusterRadius === null
    ? null
    : clusterMatchCandidates(representatives, clusterRadius)
  if (clustering === null || clustering.basins.length === 0) {
    return { status: 'invalid-frame', reason: 'No refined match candidates exist.' }
  }

  const bestBasin = clustering.basins[0]!
  const best = bestBasin.representative
  const secondBasin = clustering.basins[1] ?? null
  const secondBestScore = secondBasin?.representative.score ?? null

  const assessment = evaluateMatchConfidence({
    bestScore: best.score,
    secondBestScore,
    templateStandardDeviation: texture,
    boundaryCandidate:
      best.x === 0 || best.y === 0 || best.x === fullMaxX ||
      best.y === fullMaxY,
  })
  const bestCandidateCenter = {
    x: searchOrigin.x + best.x + (template.width - 1) / 2,
    y: searchOrigin.y + best.y + (template.height - 1) / 2,
  }
  const diagnostics: MatchDiagnostics = {
    refinedCandidateCount: fineCount,
    retainedRepresentativeCount: representatives.length,
    clusterCount: clustering.basins.length,
    bestClusterCandidateCount: bestBasin.candidateCount,
    clusterRadius: clustering.radius,
    bestClusterScore: best.score,
    secondClusterScore: secondBestScore,
    bestSecondClusterSeparation: secondBasin === null
      ? null
      : Math.hypot(
          best.x - secondBasin.representative.x,
          best.y - secondBasin.representative.y,
        ),
    ambiguityMargin: assessment.relativeMargin,
    motionTieBreakUsed: false,
    bestCandidateCenter,
  }
  if (!assessment.accepted) {
    return {
      status: 'low-confidence',
      confidence: assessment.confidence,
      score: best.score,
      reason: assessment.reason ?? 'The refined match confidence is too low.',
      diagnostics,
    }
  }

  return {
    status: 'match',
    matchedCenter: bestCandidateCenter,
    confidence: assessment.confidence,
    score: best.score,
    diagnostics,
  }
}

export function locateTemplate(
  template: GrayImage,
  search: GrayImage,
  searchRegion: Pick<
    SearchPixelRegion,
    'origin' | 'expectedTemplateCenter' | 'searchCenter' | 'geometry'
  > & Partial<Pick<SearchPixelRegion, 'recoveryAttempt'>>,
): TrackingMatch {
  const recoveryAttempt = searchRegion.recoveryAttempt ?? 0
  if (
    !Number.isFinite(searchRegion.expectedTemplateCenter.x) ||
    !Number.isFinite(searchRegion.expectedTemplateCenter.y) ||
    !Number.isFinite(searchRegion.searchCenter.x) ||
    !Number.isFinite(searchRegion.searchCenter.y) ||
    !isValidAssistedTrackingSearchGeometry(searchRegion.geometry) ||
    !Number.isInteger(recoveryAttempt) ||
    recoveryAttempt < 0 ||
    recoveryAttempt > MAX_CONSECUTIVE_MISSES
  ) {
    return {
      status: 'invalid-frame',
      reason: 'The expected template position or search geometry is invalid.',
    }
  }
  const result = matchTemplateCoarseToFine(
    template,
    search,
    searchRegion.geometry,
    searchRegion.origin,
  )
  if (result.status !== 'match') return result
  const displacement = {
    x: result.matchedCenter.x - searchRegion.expectedTemplateCenter.x,
    y: result.matchedCenter.y - searchRegion.expectedTemplateCenter.y,
  }
  const withinSearchCenter =
      Math.abs(result.matchedCenter.x - searchRegion.searchCenter.x) <=
        searchRegion.geometry.nativeSearchRadius &&
      Math.abs(result.matchedCenter.y - searchRegion.searchCenter.y) <=
        searchRegion.geometry.nativeSearchRadius
  const withinObservationCenter = recoveryAttempt === 0 &&
      Math.abs(result.matchedCenter.x - searchRegion.expectedTemplateCenter.x) <=
        searchRegion.geometry.nativeSearchRadius &&
      Math.abs(result.matchedCenter.y - searchRegion.expectedTemplateCenter.y) <=
        searchRegion.geometry.nativeSearchRadius
  if (!withinSearchCenter && !withinObservationCenter) {
    return {
      status: 'low-confidence',
      confidence: result.confidence,
      score: result.score,
      reason:
        'No reliable match was found within the assisted tracking search range.',
      diagnostics: result.diagnostics,
    }
  }
  return {
    status: 'match',
    displacement,
    confidence: result.confidence,
    score: result.score,
    diagnostics: result.diagnostics,
  }
}

export function applyTrackedDisplacement(
  anchor: Point,
  displacement: Point,
): Point | null {
  if (
    !Number.isFinite(anchor.x) ||
    !Number.isFinite(anchor.y) ||
    !Number.isFinite(displacement.x) ||
    !Number.isFinite(displacement.y)
  ) {
    return null
  }
  return {
    x: anchor.x + displacement.x,
    y: anchor.y + displacement.y,
  }
}
