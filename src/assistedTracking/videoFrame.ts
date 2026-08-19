import { clampMediaTime } from '../video/timing'

export type PresentedFrameResult =
  | { ok: true; mediaTime: number }
  | { ok: false; reason: string; cancelled: boolean }

const SEEK_TIMEOUT_MS = 3000

function nextPaint(signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false)
      return
    }
    const frame = requestAnimationFrame(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(true)
    })
    const onAbort = () => {
      cancelAnimationFrame(frame)
      resolve(false)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Serializes a timestamp seek and waits for the browser's decoded-frame seek
 * completion before allowing pixel extraction. This remains timestamp-based;
 * it does not claim exact random access to a source frame number.
 */
export async function seekToPresentedFrame(
  video: HTMLVideoElement,
  requestedTime: number,
  duration: number | null,
  signal: AbortSignal,
): Promise<PresentedFrameResult> {
  if (signal.aborted) {
    return { ok: false, reason: 'Assisted tracking was cancelled.', cancelled: true }
  }

  const target = clampMediaTime(requestedTime, duration)
  const alreadyAtTarget =
    Math.abs(video.currentTime - target) <= 1e-6 &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA

  if (!alreadyAtTarget) {
    const seekResult = await new Promise<PresentedFrameResult>((resolve) => {
      let settled = false
      const finish = (result: PresentedFrameResult) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        video.removeEventListener('seeked', onSeeked)
        video.removeEventListener('error', onError)
        signal.removeEventListener('abort', onAbort)
        resolve(result)
      }
      const onSeeked = () => {
        finish({ ok: true, mediaTime: video.currentTime })
      }
      const onError = () => {
        finish({
          ok: false,
          reason: 'The video failed while seeking to the next timestamp.',
          cancelled: false,
        })
      }
      const onAbort = () => {
        finish({ ok: false, reason: 'Assisted tracking was cancelled.', cancelled: true })
      }
      const timeout = setTimeout(() => {
        finish({
          ok: false,
          reason: 'Timed out while waiting for the next decoded video frame.',
          cancelled: false,
        })
      }, SEEK_TIMEOUT_MS)

      video.addEventListener('seeked', onSeeked, { once: true })
      video.addEventListener('error', onError, { once: true })
      signal.addEventListener('abort', onAbort, { once: true })
      try {
        video.currentTime = target
      } catch {
        finish({
          ok: false,
          reason: 'The browser could not seek to the requested timestamp.',
          cancelled: false,
        })
      }
    })
    if (!seekResult.ok) return seekResult
  }

  const painted = await nextPaint(signal)
  if (!painted) {
    return { ok: false, reason: 'Assisted tracking was cancelled.', cancelled: true }
  }
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    !Number.isFinite(video.currentTime)
  ) {
    return {
      ok: false,
      reason: 'The requested video frame is not available for pixel extraction.',
      cancelled: false,
    }
  }
  return { ok: true, mediaTime: video.currentTime }
}
