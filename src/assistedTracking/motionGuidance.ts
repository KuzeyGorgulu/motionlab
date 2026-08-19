import type { Point, Size } from '../video/geometry'

export const MINIMUM_MOTION_INTERVAL_SECONDS = 1e-6
export const MINIMUM_TIME_SCALE = 0.25
export const MAXIMUM_TIME_SCALE = 4

export interface MotionObservation {
  position: Point
  time: number
}

export interface MotionSearchHint {
  searchCenter: Point
  usedMotionGuidance: boolean
  predictedDisplacement: Point | null
  recentDisplacement: Point | null
  recentVelocity: Point | null
  reason: string
}

function validPoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function validSize(size: Size): boolean {
  return (
    Number.isInteger(size.width) &&
    Number.isInteger(size.height) &&
    size.width > 0 &&
    size.height > 0
  )
}

function unguided(last: MotionObservation, reason: string): MotionSearchHint {
  return {
    searchCenter: { ...last.position },
    usedMotionGuidance: false,
    predictedDisplacement: null,
    recentDisplacement: null,
    recentVelocity: null,
    reason,
  }
}

export function motionSearchHint(
  observations: readonly MotionObservation[],
  nextTime: number,
  nativeSize: Size,
  maximumHintDistance: number,
): MotionSearchHint | null {
  const last = observations.at(-1)
  if (
    last === undefined ||
    !validPoint(last.position) ||
    !Number.isFinite(last.time) ||
    !validSize(nativeSize) ||
    !Number.isFinite(nextTime) ||
    !Number.isFinite(maximumHintDistance) ||
    maximumHintDistance <= 0
  ) {
    return null
  }

  const previous = observations.at(-2)
  if (previous === undefined) return unguided(last, 'insufficient-history')
  if (!validPoint(previous.position) || !Number.isFinite(previous.time)) {
    return unguided(last, 'invalid-history')
  }

  const previousInterval = last.time - previous.time
  const nextInterval = nextTime - last.time
  if (
    previousInterval <= MINIMUM_MOTION_INTERVAL_SECONDS ||
    nextInterval <= MINIMUM_MOTION_INTERVAL_SECONDS
  ) {
    return unguided(last, 'invalid-timing')
  }

  const timeScale = nextInterval / previousInterval
  if (
    !Number.isFinite(timeScale) ||
    timeScale < MINIMUM_TIME_SCALE ||
    timeScale > MAXIMUM_TIME_SCALE
  ) {
    return unguided(last, 'unsupported-time-scale')
  }

  const recentDisplacement = {
    x: last.position.x - previous.position.x,
    y: last.position.y - previous.position.y,
  }
  const recentVelocity = {
    x: recentDisplacement.x / previousInterval,
    y: recentDisplacement.y / previousInterval,
  }
  if (!validPoint(recentVelocity)) return unguided(last, 'invalid-motion')

  let predictedX = recentDisplacement.x * timeScale
  let predictedY = recentDisplacement.y * timeScale
  const magnitude = Math.hypot(predictedX, predictedY)
  if (!Number.isFinite(magnitude)) return unguided(last, 'invalid-motion')
  if (magnitude > maximumHintDistance) {
    const boundedScale = maximumHintDistance / magnitude
    predictedX *= boundedScale
    predictedY *= boundedScale
  }

  let searchCenter = {
    x: last.position.x + predictedX,
    y: last.position.y + predictedY,
  }
  const frameMargin = maximumHintDistance
  const lastInsideFrame =
    last.position.x >= 0 &&
    last.position.y >= 0 &&
    last.position.x <= nativeSize.width - 1 &&
    last.position.y <= nativeSize.height - 1
  if (
    !lastInsideFrame &&
    (searchCenter.x < -frameMargin ||
      searchCenter.y < -frameMargin ||
      searchCenter.x > nativeSize.width - 1 + frameMargin ||
      searchCenter.y > nativeSize.height - 1 + frameMargin)
  ) {
    return unguided(last, 'prediction-outside-frame')
  }

  let clampedToFrame = false
  if (lastInsideFrame) {
    const clampedCenter = {
      x: Math.max(0, Math.min(nativeSize.width - 1, searchCenter.x)),
      y: Math.max(0, Math.min(nativeSize.height - 1, searchCenter.y)),
    }
    clampedToFrame =
      clampedCenter.x !== searchCenter.x || clampedCenter.y !== searchCenter.y
    searchCenter = clampedCenter
    predictedX = searchCenter.x - last.position.x
    predictedY = searchCenter.y - last.position.y
  }

  return {
    searchCenter,
    usedMotionGuidance: true,
    predictedDisplacement: { x: predictedX, y: predictedY },
    recentDisplacement,
    recentVelocity,
    reason: clampedToFrame
      ? 'prediction-clamped-to-frame'
      : magnitude > maximumHintDistance
        ? 'bounded-motion'
        : 'observed-motion',
  }
}
