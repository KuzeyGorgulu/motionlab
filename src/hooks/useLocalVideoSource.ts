import { useCallback, useEffect, useRef, useState } from 'react'

import type { LocalVideoSource } from '../types/video'

interface LocalVideoSourceState {
  source: LocalVideoSource | null
  importError: string | null
  loadVideo: (file: File) => boolean
  clearVideo: () => void
}

export function useLocalVideoSource(): LocalVideoSourceState {
  const [source, setSource] = useState<LocalVideoSource | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const sourceRef = useRef<LocalVideoSource | null>(null)

  useEffect(() => {
    return () => {
      if (sourceRef.current !== null) {
        URL.revokeObjectURL(sourceRef.current.url)
        sourceRef.current = null
      }
    }
  }, [])

  const loadVideo = useCallback((file: File): boolean => {
    if (file.type !== '' && !file.type.startsWith('video/')) {
      setImportError('Choose a video file. The selected file is not identified as video.')
      return false
    }

    setImportError(null)
    const previousSource = sourceRef.current
    const nextSource = {
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      type: file.type || 'Unknown video type',
      lastModified: file.lastModified,
    }

    sourceRef.current = nextSource
    setSource(nextSource)
    if (previousSource !== null) {
      URL.revokeObjectURL(previousSource.url)
    }
    return true
  }, [])

  const clearVideo = useCallback(() => {
    const previousSource = sourceRef.current
    sourceRef.current = null
    setSource(null)
    setImportError(null)
    if (previousSource !== null) {
      URL.revokeObjectURL(previousSource.url)
    }
  }, [])

  return { source, importError, loadVideo, clearVideo }
}
