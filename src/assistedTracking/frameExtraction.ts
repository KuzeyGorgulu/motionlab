import type { Point, Size } from '../video/geometry'
import {
  assistedTrackingGeometryFor,
  isValidAssistedTrackingGeometry,
  isValidAssistedTrackingSearchGeometry,
} from './geometry'
import { MAX_CONSECUTIVE_MISSES } from './recovery'
import type {
  AssistedTrackingGeometry,
  PixelRegion,
  SearchPixelRegion,
} from './types'

export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
}

export type FrameExtractionResult =
  | { ok: true; region: PixelRegion }
  | { ok: false; reason: string }

export type SearchFrameExtractionResult =
  | { ok: true; region: SearchPixelRegion }
  | { ok: false; reason: string }

function validSize(size: Size): boolean {
  return (
    Number.isInteger(size.width) &&
    Number.isInteger(size.height) &&
    size.width > 0 &&
    size.height > 0
  )
}

export function templateRectForPoint(
  nativeSize: Size,
  point: Point,
  templateSize = assistedTrackingGeometryFor(nativeSize)?.templateSize ?? 0,
): PixelRect | null {
  if (
    !validSize(nativeSize) ||
    !Number.isInteger(templateSize) ||
    templateSize <= 0 ||
    templateSize % 2 === 0 ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    return null
  }

  const half = Math.floor(templateSize / 2)
  const centerX = Math.round(point.x)
  const centerY = Math.round(point.y)
  const rect = {
    x: centerX - half,
    y: centerY - half,
    width: templateSize,
    height: templateSize,
  }
  return rect.x < 0 || rect.y < 0 ||
    rect.x + rect.width > nativeSize.width ||
    rect.y + rect.height > nativeSize.height
    ? null
    : rect
}

export function searchRectForPoint(
  nativeSize: Size,
  point: Point,
  templateSize = assistedTrackingGeometryFor(nativeSize)?.templateSize ?? 0,
  searchRadius =
    assistedTrackingGeometryFor(nativeSize)?.nativeSearchRadius ?? -1,
): PixelRect | null {
  return searchRectForPoints(
    nativeSize,
    [point],
    templateSize,
    searchRadius,
  )
}

export function searchRectForPoints(
  nativeSize: Size,
  points: readonly Point[],
  templateSize = assistedTrackingGeometryFor(nativeSize)?.templateSize ?? 0,
  searchRadius =
    assistedTrackingGeometryFor(nativeSize)?.nativeSearchRadius ?? -1,
): PixelRect | null {
  if (
    !validSize(nativeSize) ||
    points.length === 0 ||
    !Number.isInteger(templateSize) ||
    templateSize <= 0 ||
    templateSize % 2 === 0 ||
    !Number.isInteger(searchRadius) ||
    searchRadius < 0 ||
    points.some((point) =>
      !Number.isFinite(point.x) || !Number.isFinite(point.y),
    )
  ) {
    return null
  }

  const half = Math.floor(templateSize / 2)
  const centerXs = points.map((point) => Math.round(point.x))
  const centerYs = points.map((point) => Math.round(point.y))
  const left = Math.max(0, Math.min(...centerXs) - half - searchRadius)
  const top = Math.max(0, Math.min(...centerYs) - half - searchRadius)
  const right = Math.min(
    nativeSize.width,
    Math.max(...centerXs) + half + searchRadius + 1,
  )
  const bottom = Math.min(
    nativeSize.height,
    Math.max(...centerYs) + half + searchRadius + 1,
  )
  const width = right - left
  const height = bottom - top

  return width < templateSize || height < templateSize
    ? null
    : { x: left, y: top, width, height }
}

export function searchRectForTracking(
  nativeSize: Size,
  anchorPoint: Point,
  searchCenter: Point,
  geometry: AssistedTrackingGeometry,
  recoveryAttempt: number,
): PixelRect | null {
  if (
    !isValidAssistedTrackingSearchGeometry(geometry) ||
    !Number.isInteger(recoveryAttempt) ||
    recoveryAttempt < 0 ||
    recoveryAttempt > MAX_CONSECUTIVE_MISSES
  ) {
    return null
  }
  return searchRectForPoints(
    nativeSize,
    recoveryAttempt === 0 ? [anchorPoint, searchCenter] : [searchCenter],
    geometry.templateSize,
    geometry.nativeSearchRadius + geometry.refinementRadius,
  )
}

export class VideoFrameExtractor {
  private readonly canvas = document.createElement('canvas')
  private readonly context = this.canvas.getContext('2d', {
    willReadFrequently: true,
  })

  private extract(
    video: HTMLVideoElement,
    rect: PixelRect,
  ): FrameExtractionResult {
    if (
      this.context === null ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return { ok: false, reason: 'The decoded video frame is not ready.' }
    }

    this.canvas.width = rect.width
    this.canvas.height = rect.height
    try {
      this.context.clearRect(0, 0, rect.width, rect.height)
      this.context.drawImage(
        video,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        rect.width,
        rect.height,
      )
      const image = this.context.getImageData(0, 0, rect.width, rect.height)
      return {
        ok: true,
        region: {
          width: rect.width,
          height: rect.height,
          origin: { x: rect.x, y: rect.y },
          pixels: image.data,
        },
      }
    } catch {
      return { ok: false, reason: 'The browser could not read pixels from this frame.' }
    }
  }

  extractTemplate(
    video: HTMLVideoElement,
    point: Point,
    geometry = assistedTrackingGeometryFor({
      width: video.videoWidth,
      height: video.videoHeight,
    }),
  ): FrameExtractionResult {
    if (geometry === null || !isValidAssistedTrackingGeometry(geometry)) {
      return {
        ok: false,
        reason: 'The video has invalid assisted-tracking geometry.',
      }
    }
    const rect = templateRectForPoint(
      { width: video.videoWidth, height: video.videoHeight },
      point,
      geometry.templateSize,
    )
    return rect === null
      ? {
          ok: false,
          reason:
            'The adaptive seed template would be clipped by the video boundary.',
        }
      : this.extract(video, rect)
  }

  extractSearch(
    video: HTMLVideoElement,
    anchorPoint: Point,
    searchCenter: Point,
    geometry: AssistedTrackingGeometry,
    recoveryAttempt = 0,
  ): SearchFrameExtractionResult {
    if (!isValidAssistedTrackingSearchGeometry(geometry)) {
      return {
        ok: false,
        reason: 'The video has invalid assisted-tracking geometry.',
      }
    }
    const rect = searchRectForTracking(
      { width: video.videoWidth, height: video.videoHeight },
      anchorPoint,
      searchCenter,
      geometry,
      recoveryAttempt,
    )
    if (rect === null) {
      return { ok: false, reason: 'The target search area has left the video frame.' }
    }
    const extracted = this.extract(video, rect)
    return extracted.ok
      ? {
          ok: true,
          region: {
            ...extracted.region,
            expectedTemplateCenter: {
              x: Math.round(anchorPoint.x),
              y: Math.round(anchorPoint.y),
            },
            searchCenter: {
              x: Math.round(searchCenter.x),
              y: Math.round(searchCenter.y),
            },
            geometry,
            recoveryAttempt,
          },
        }
      : extracted
  }
}
