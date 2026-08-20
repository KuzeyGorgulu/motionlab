import type { Calibration } from '../calibration/types'
import type { Track } from '../tracking/types'
import type { Point } from '../video/geometry'
import {
  createTrackKinematicsFromSeries,
  createVectorQuantity,
  deriveTrackKinematics,
} from './kinematics'
import { fitPolynomialLeastSquares } from './leastSquares'
import type {
  SmoothedKinematicSample,
  SmoothingResult,
  SmoothingWindowSize,
  TrackKinematics,
  VectorQuantity,
} from './types'

interface LocalPolynomialSample {
  position: Point
  velocity: VectorQuantity
  acceleration: VectorQuantity
}

function nearestWindow(
  analysis: TrackKinematics,
  targetIndex: number,
  windowSize: SmoothingWindowSize,
) {
  const target = analysis.samples[targetIndex]!
  return analysis.samples
    .map((sample) => ({
      sample,
      distance: Math.abs(sample.source.time - target.source.time),
    }))
    .sort(
      (first, second) =>
        first.distance - second.distance ||
        first.sample.source.time - second.sample.source.time ||
        first.sample.source.id.localeCompare(second.sample.source.id),
    )
    .slice(0, Math.min(windowSize, analysis.samples.length))
    .map(({ sample }) => sample)
    .sort(
      (first, second) =>
        first.source.time - second.source.time ||
        first.source.id.localeCompare(second.source.id),
    )
}

function fitLocalQuadratic(
  analysis: TrackKinematics,
  targetIndex: number,
  windowSize: SmoothingWindowSize,
): LocalPolynomialSample | null {
  const targetTime = analysis.samples[targetIndex]!.source.time
  const window = nearestWindow(analysis, targetIndex, windowSize)
  const times = window.map((sample) => sample.source.time)
  const fitX = fitPolynomialLeastSquares(
    times,
    window.map((sample) => sample.position.x),
    2,
    targetTime,
  )
  const fitY = fitPolynomialLeastSquares(
    times,
    window.map((sample) => sample.position.y),
    2,
    targetTime,
  )
  if (fitX === null || fitY === null) return null

  const position = {
    x: fitX.coefficients[0]!,
    y: fitY.coefficients[0]!,
  }
  const velocity = createVectorQuantity(
    fitX.coefficients[1]!,
    fitY.coefficients[1]!,
  )
  const acceleration = createVectorQuantity(
    2 * fitX.coefficients[2]!,
    2 * fitY.coefficients[2]!,
  )
  return velocity === null || acceleration === null
    ? null
    : { position, velocity, acceleration }
}

/**
 * Fits independent local quadratics at genuine observation timestamps. The
 * source TrackSamples are referenced but never copied into tracking state or
 * mutated, and no timestamps are inserted between observations.
 */
export function deriveSmoothedTrackKinematics(
  track: Track,
  calibration: Calibration | null,
  windowSize: SmoothingWindowSize,
): SmoothingResult {
  const raw = deriveTrackKinematics(track, calibration)
  if (raw.samples.length < 5) {
    return {
      ok: false,
      message: 'Not enough samples for smoothing. At least 5 valid observations are required.',
    }
  }

  const localFits = raw.samples.map((_, index) =>
    fitLocalQuadratic(raw, index, windowSize),
  )
  const validFits = localFits.filter(
    (fit): fit is LocalPolynomialSample => fit !== null,
  )
  if (validFits.length !== raw.samples.length) {
    return {
      ok: false,
      message: 'Unable to smooth this sample set because its timestamps are degenerate or poorly conditioned.',
    }
  }

  const base = createTrackKinematicsFromSeries(
    raw.trackId,
    raw.space,
    raw.positionUnit,
    raw.samples.map((sample, index) => {
      const fit = validFits[index]!
      return {
        source: sample.source,
        position: fit.position,
        velocity: fit.velocity,
        acceleration: fit.acceleration,
      }
    }),
  )
  const samples: SmoothedKinematicSample[] = base.samples.flatMap((sample, index) => {
    const rawSample = raw.samples[index]!
    const velocity = sample.velocity
    const acceleration = sample.acceleration
    if (velocity === null || acceleration === null) {
      return []
    }
    return [{
      ...sample,
      velocity,
      acceleration,
      rawNativePosition: { ...rawSample.source.nativePosition },
      rawPosition: { ...rawSample.position },
      smoothedPosition: { ...sample.position },
      smoothedVelocity: velocity,
      smoothedAcceleration: acceleration,
    }]
  })
  if (samples.length !== raw.samples.length) {
    return {
      ok: false,
      message: 'Unable to smooth this sample set safely.',
    }
  }

  return {
    ok: true,
    analysis: {
      ...base,
      analysisSource: { type: 'smoothed', windowSize },
      samples,
    },
  }
}
