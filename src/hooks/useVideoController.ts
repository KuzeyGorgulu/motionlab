import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react'

import type { VideoMetadata } from '../types/video'
import {
  clampMediaTime,
  getFrameStepSeconds,
} from '../video/timing'

type StepDirection = -1 | 1

export interface VideoController {
  metadata: VideoMetadata | null
  currentTime: number
  isPlaying: boolean
  playbackRate: number
  mediaError: string | null
  hasUsableDuration: boolean
  togglePlayback: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  step: (direction: StepDirection) => void
  changePlaybackRate: (rate: number) => void
  mediaEvents: {
    onLoadedMetadata: () => void
    onDurationChange: () => void
    onTimeUpdate: () => void
    onSeeking: () => void
    onSeeked: () => void
    onPlay: () => void
    onPause: () => void
    onEnded: () => void
    onError: () => void
  }
}

function usableDuration(duration: number): number | null {
  return Number.isFinite(duration) && duration >= 0 ? duration : null
}

export function describeMediaError(mediaError: Pick<MediaError, 'code'> | null): string {
  switch (mediaError?.code) {
    case 1:
      return 'Video loading was interrupted. Try selecting the file again.'
    case 2:
      return 'The browser could not read the local video file. Select it again or try another copy.'
    case 3:
      return 'The browser could not decode this video. It may be damaged or use an unsupported codec; try a browser-supported MP4 or WebM copy.'
    case 4:
      return 'This video format or codec is not supported by the browser. Try a browser-supported MP4 or WebM copy.'
    default:
      return 'The video could not be loaded. It may be damaged or unsupported; select another copy to continue.'
  }
}

export function useVideoController(
  videoRef: RefObject<HTMLVideoElement | null>,
): VideoController {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const syncCurrentTime = useCallback(() => {
    const video = videoRef.current
    if (video !== null && Number.isFinite(video.currentTime)) {
      setCurrentTime(video.currentTime)
    }
  }, [videoRef])

  const syncMetadata = useCallback(() => {
    const video = videoRef.current
    if (video === null) {
      return
    }

    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      setMediaError('The selected file does not contain a displayable video track. Choose a video with a supported visual track.')
      return
    }

    setMetadata({
      duration: usableDuration(video.duration),
      width: video.videoWidth,
      height: video.videoHeight,
    })
    syncCurrentTime()
    setMediaError(null)
  }, [syncCurrentTime, videoRef])

  const onDurationChange = useCallback(() => {
    const video = videoRef.current
    if (video === null) {
      return
    }

    setMetadata((previous) =>
      previous === null
        ? previous
        : { ...previous, duration: usableDuration(video.duration) },
    )
  }, [videoRef])

  const onPlay = useCallback(() => {
    setIsPlaying(true)
    setMediaError(null)
  }, [])

  const onPause = useCallback(() => {
    setIsPlaying(false)
    syncCurrentTime()
  }, [syncCurrentTime])

  const onEnded = useCallback(() => {
    setIsPlaying(false)
    syncCurrentTime()
  }, [syncCurrentTime])

  const onError = useCallback(() => {
    const video = videoRef.current
    setIsPlaying(false)
    setMediaError(describeMediaError(video?.error ?? null))
  }, [videoRef])

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current
    if (video === null || metadata === null) {
      return
    }

    if (!video.paused && !video.ended) {
      video.pause()
      return
    }

    if (video.ended && metadata.duration !== null) {
      video.currentTime = 0
    }

    try {
      await video.play()
    } catch {
      setMediaError('Playback could not start. Confirm this file plays in the browser, then try again.')
    }
  }, [metadata, videoRef])

  const pause = useCallback(() => {
    videoRef.current?.pause()
  }, [videoRef])

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current
      if (video === null || metadata === null) {
        return
      }

      try {
        const target = clampMediaTime(time, metadata.duration)
        video.currentTime = target
        setCurrentTime(target)
      } catch {
        setMediaError('The browser could not seek to that timestamp. Pause the video and try again from the timeline.')
      }
    },
    [metadata, videoRef],
  )

  const step = useCallback(
    (direction: StepDirection) => {
      const video = videoRef.current
      if (video === null || metadata === null) {
        return
      }

      video.pause()
      seek(video.currentTime + direction * getFrameStepSeconds())
    },
    [metadata, seek, videoRef],
  )

  const changePlaybackRate = useCallback(
    (rate: number) => {
      const video = videoRef.current
      if (video === null || !Number.isFinite(rate) || rate <= 0) {
        return
      }

      video.playbackRate = rate
      setPlaybackRate(rate)
    },
    [videoRef],
  )

  useEffect(() => {
    const video = videoRef.current
    if (video === null || !isPlaying) {
      return
    }

    let cancelled = false
    let videoFrameRequest: number | null = null
    let animationFrameRequest: number | null = null

    if (typeof video.requestVideoFrameCallback === 'function') {
      const updateFromVideoFrame: VideoFrameRequestCallback = (_, frame) => {
        if (cancelled) {
          return
        }

        setCurrentTime(frame.mediaTime)
        if (!video.paused && !video.ended) {
          videoFrameRequest = video.requestVideoFrameCallback(updateFromVideoFrame)
        }
      }

      videoFrameRequest = video.requestVideoFrameCallback(updateFromVideoFrame)
    } else {
      const sampleMediaTime = () => {
        if (cancelled) {
          return
        }

        setCurrentTime(video.currentTime)
        if (!video.paused && !video.ended) {
          animationFrameRequest = requestAnimationFrame(sampleMediaTime)
        }
      }

      animationFrameRequest = requestAnimationFrame(sampleMediaTime)
    }

    return () => {
      cancelled = true
      if (videoFrameRequest !== null) {
        video.cancelVideoFrameCallback(videoFrameRequest)
      }
      if (animationFrameRequest !== null) {
        cancelAnimationFrame(animationFrameRequest)
      }
    }
  }, [isPlaying, videoRef])

  const hasUsableDuration =
    metadata?.duration !== null &&
    metadata?.duration !== undefined &&
    metadata.duration > 0

  const mediaEvents = useMemo(
    () => ({
      onLoadedMetadata: syncMetadata,
      onDurationChange,
      onTimeUpdate: syncCurrentTime,
      onSeeking: syncCurrentTime,
      onSeeked: syncCurrentTime,
      onPlay,
      onPause,
      onEnded,
      onError,
    }),
    [
      onDurationChange,
      onEnded,
      onError,
      onPause,
      onPlay,
      syncCurrentTime,
      syncMetadata,
    ],
  )

  return {
    metadata,
    currentTime,
    isPlaying,
    playbackRate,
    mediaError,
    hasUsableDuration,
    togglePlayback,
    pause,
    seek,
    step,
    changePlaybackRate,
    mediaEvents,
  }
}
