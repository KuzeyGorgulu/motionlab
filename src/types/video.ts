export interface LocalVideoSource {
  url: string
  name: string
  size: number
  type: string
  lastModified: number
}

export interface VideoMetadata {
  duration: number | null
  width: number
  height: number
}
