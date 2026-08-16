export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect extends Point, Size {}

const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 }

function hasPositiveDimensions(size: Size): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  )
}

/** Returns the visible media rectangle produced by CSS `object-fit: contain`. */
export function getContainedContentRect(container: Size, media: Size): Rect {
  if (!hasPositiveDimensions(container) || !hasPositiveDimensions(media)) {
    return EMPTY_RECT
  }

  const scale = Math.min(
    container.width / media.width,
    container.height / media.height,
  )
  const width = media.width * scale
  const height = media.height * scale

  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  }
}

/**
 * Maps a point measured from the stage's top-left into native video coordinates.
 * Points in the letterbox area return null.
 */
export function displayPointToVideo(
  displayPoint: Point,
  contentRect: Rect,
  nativeVideoSize: Size,
): Point | null {
  if (
    !hasPositiveDimensions(contentRect) ||
    !hasPositiveDimensions(nativeVideoSize) ||
    !Number.isFinite(displayPoint.x) ||
    !Number.isFinite(displayPoint.y)
  ) {
    return null
  }

  const localX = displayPoint.x - contentRect.x
  const localY = displayPoint.y - contentRect.y

  if (
    localX < 0 ||
    localY < 0 ||
    localX > contentRect.width ||
    localY > contentRect.height
  ) {
    return null
  }

  return {
    x: (localX / contentRect.width) * nativeVideoSize.width,
    y: (localY / contentRect.height) * nativeVideoSize.height,
  }
}

/** Maps a native video point into coordinates measured from the stage's top-left. */
export function videoPointToDisplay(
  videoPoint: Point,
  contentRect: Rect,
  nativeVideoSize: Size,
): Point | null {
  if (
    !hasPositiveDimensions(contentRect) ||
    !hasPositiveDimensions(nativeVideoSize) ||
    !Number.isFinite(videoPoint.x) ||
    !Number.isFinite(videoPoint.y) ||
    videoPoint.x < 0 ||
    videoPoint.y < 0 ||
    videoPoint.x > nativeVideoSize.width ||
    videoPoint.y > nativeVideoSize.height
  ) {
    return null
  }

  return {
    x:
      contentRect.x +
      (videoPoint.x / nativeVideoSize.width) * contentRect.width,
    y:
      contentRect.y +
      (videoPoint.y / nativeVideoSize.height) * contentRect.height,
  }
}
