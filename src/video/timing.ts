export const FALLBACK_FRAME_RATE = 30

const MAX_REASONABLE_FRAME_RATE = 240

export function getFrameStepSeconds(
  framesPerSecond: number = FALLBACK_FRAME_RATE,
): number {
  const isUsableFrameRate =
    Number.isFinite(framesPerSecond) &&
    framesPerSecond >= 1 &&
    framesPerSecond <= MAX_REASONABLE_FRAME_RATE

  return 1 / (isUsableFrameRate ? framesPerSecond : FALLBACK_FRAME_RATE)
}

export function clampMediaTime(time: number, duration: number | null): number {
  if (!Number.isFinite(time)) {
    return 0
  }

  const nonNegativeTime = Math.max(0, time)
  if (duration === null || !Number.isFinite(duration) || duration < 0) {
    return nonNegativeTime
  }

  return Math.min(nonNegativeTime, duration)
}

export function formatTimestamp(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '--:--.---'
  }

  const totalMilliseconds = Math.round(seconds * 1000)
  const milliseconds = totalMilliseconds % 1000
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const wholeSeconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  const time = `${String(minutes).padStart(2, '0')}:${String(
    wholeSeconds,
  ).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`

  return hours > 0 ? `${String(hours).padStart(2, '0')}:${time}` : time
}
