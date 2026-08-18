import { pixelToWorld } from '../calibration/transform'
import type { Calibration } from '../calibration/types'
import { orderTrackSamples, validateTrackSample } from '../tracking/model'
import type { Track, TrackSample } from '../tracking/types'
import type { Point } from '../video/geometry'
import type {
  KinematicSample,
  PositionUnit,
  TrackKinematics,
  VectorQuantity,
} from './types'

export const MIN_TIME_DELTA_SECONDS = 1e-6

function isUsableDelta(delta: number): boolean {
  return Number.isFinite(delta) && delta > MIN_TIME_DELTA_SECONDS
}

function vectorQuantity(x: number, y: number): VectorQuantity | null {
  const magnitude = Math.hypot(x, y)
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(magnitude)
    ? { x, y, magnitude }
    : null
}

function twoPointDerivative(
  firstTime: number,
  first: Point,
  secondTime: number,
  second: Point,
): VectorQuantity | null {
  const dt = secondTime - firstTime
  if (!isUsableDelta(dt)) return null
  return vectorQuantity((second.x - first.x) / dt, (second.y - first.y) / dt)
}

/**
 * Differentiates the quadratic interpolant through three irregularly spaced
 * observations. At an interior sample this is a non-uniform centered estimate;
 * at a track endpoint it is a second-order one-sided estimate.
 */
function threePointDerivative(
  times: readonly [number, number, number],
  points: readonly [Point, Point, Point],
  targetTime: number,
): VectorQuantity | null {
  const [t0, t1, t2] = times
  if (!isUsableDelta(t1 - t0) || !isUsableDelta(t2 - t1)) return null

  const denominator0 = (t0 - t1) * (t0 - t2)
  const denominator1 = (t1 - t0) * (t1 - t2)
  const denominator2 = (t2 - t0) * (t2 - t1)
  if (
    denominator0 === 0 ||
    denominator1 === 0 ||
    denominator2 === 0
  ) {
    return null
  }

  const weight0 = (2 * targetTime - t1 - t2) / denominator0
  const weight1 = (2 * targetTime - t0 - t2) / denominator1
  const weight2 = (2 * targetTime - t0 - t1) / denominator2

  return vectorQuantity(
    weight0 * points[0].x + weight1 * points[1].x + weight2 * points[2].x,
    weight0 * points[0].y + weight1 * points[1].y + weight2 * points[2].y,
  )
}

export function normalizeSamplesForAnalysis(
  samples: readonly TrackSample[],
): TrackSample[] {
  return orderTrackSamples(
    samples.filter((sample) => validateTrackSample(sample).length === 0),
  )
}

export function deriveVelocitySeries(
  times: readonly number[],
  positions: readonly Point[],
): Array<VectorQuantity | null> {
  if (times.length !== positions.length || times.length < 2) {
    return positions.map(() => null)
  }

  if (positions.length === 2) {
    const derivative = twoPointDerivative(
      times[0]!,
      positions[0]!,
      times[1]!,
      positions[1]!,
    )
    return [derivative, derivative]
  }

  return positions.map((_, index) => {
    if (index === 0) {
      return (
        threePointDerivative(
          [times[0]!, times[1]!, times[2]!],
          [positions[0]!, positions[1]!, positions[2]!],
          times[0]!,
        ) ??
        twoPointDerivative(
          times[0]!,
          positions[0]!,
          times[1]!,
          positions[1]!,
        )
      )
    }

    if (index === positions.length - 1) {
      const last = positions.length - 1
      return (
        threePointDerivative(
          [times[last - 2]!, times[last - 1]!, times[last]!],
          [positions[last - 2]!, positions[last - 1]!, positions[last]!],
          times[last]!,
        ) ??
        twoPointDerivative(
          times[last - 1]!,
          positions[last - 1]!,
          times[last]!,
          positions[last]!,
        )
      )
    }

    return threePointDerivative(
      [times[index - 1]!, times[index]!, times[index + 1]!],
      [positions[index - 1]!, positions[index]!, positions[index + 1]!],
      times[index]!,
    )
  })
}

export function deriveAccelerationSeries(
  times: readonly number[],
  velocities: readonly (VectorQuantity | null)[],
): Array<VectorQuantity | null> {
  if (times.length !== velocities.length || times.length < 3) {
    return velocities.map(() => null)
  }

  return velocities.map((velocity, index) => {
    // Acceleration is deliberately unavailable at track boundaries: estimating
    // it there would require extrapolating already-derived velocity data.
    if (index === 0 || index === velocities.length - 1 || velocity === null) {
      return null
    }
    const previous = velocities[index - 1]
    const next = velocities[index + 1]
    if (previous === null || next === null) return null

    return threePointDerivative(
      [times[index - 1]!, times[index]!, times[index + 1]!],
      [previous, velocity, next],
      times[index]!,
    )
  })
}

function unitMetadata(positionUnit: PositionUnit) {
  return {
    positionUnit,
    velocityUnit: `${positionUnit}/s` as const,
    accelerationUnit: `${positionUnit}/s²` as const,
  }
}

export function deriveTrackKinematics(
  track: Track,
  calibration: Calibration | null,
): TrackKinematics {
  const sourceSamples = normalizeSamplesForAnalysis(track.samples)
  const samplesWithPositions = sourceSamples.flatMap((source) => {
    const position =
      calibration === null
        ? source.nativePosition
        : pixelToWorld(source.nativePosition, calibration)
    if (position === null) return []
    const positionVector = vectorQuantity(position.x, position.y)
    return positionVector === null
      ? []
      : [{ source, position, positionMagnitude: positionVector.magnitude }]
  })
  const times = samplesWithPositions.map(({ source }) => source.time)
  const positions = samplesWithPositions.map(({ position }) => position)
  const velocities = deriveVelocitySeries(times, positions)
  const accelerations = deriveAccelerationSeries(times, velocities)
  const derivedSamples: KinematicSample[] = []
  let cumulativeDistance: number | null = 0

  for (let index = 0; index < samplesWithPositions.length; index += 1) {
    const { source, position, positionMagnitude } = samplesWithPositions[index]!
    const previous = samplesWithPositions[index - 1]
    let displacementFromPrevious = null

    if (previous !== undefined) {
      const dt = source.time - previous.source.time
      if (isUsableDelta(dt)) {
        const displacement = vectorQuantity(
          position.x - previous.position.x,
          position.y - previous.position.y,
        )
        if (displacement !== null) {
          displacementFromPrevious = { ...displacement, dt }
          if (cumulativeDistance !== null) {
            const nextDistance: number =
              cumulativeDistance + displacement.magnitude
            cumulativeDistance = Number.isFinite(nextDistance)
              ? nextDistance
              : null
          }
        }
      }
    }

    derivedSamples.push({
      source,
      position,
      positionMagnitude,
      displacementFromPrevious,
      cumulativeDistance,
      velocity: velocities[index] ?? null,
      acceleration: accelerations[index] ?? null,
    })
  }

  const positionUnit: PositionUnit = calibration?.unit ?? 'px'
  return {
    trackId: track.id,
    space: calibration === null ? 'pixel' : 'world',
    ...unitMetadata(positionUnit),
    samples: derivedSamples,
  }
}

export function kinematicsForSample(
  analysis: TrackKinematics,
  sampleId: string | null,
): KinematicSample | null {
  if (sampleId === null) return null
  return analysis.samples.find((sample) => sample.source.id === sampleId) ?? null
}
