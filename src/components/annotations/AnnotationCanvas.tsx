import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'

import { renderAnnotationLayer } from '../../annotations/render'
import type {
  Annotation,
  AnnotationDraft,
  AnnotationTool,
} from '../../annotations/types'
import { renderCalibrationLayer } from '../../calibration/render'
import type {
  Calibration,
  CalibrationOverlayDraft,
} from '../../calibration/types'
import type { Point, Rect, Size } from '../../video/geometry'
import { displayPointToVideo } from '../../video/geometry'

export interface AnnotationCanvasProps {
  contentRect: Rect
  nativeSize: Size
  annotations: Annotation[]
  selectedId: string | null
  activeTool: AnnotationTool
  draft: AnnotationDraft | null
  calibration: Calibration | null
  calibrationDraft: CalibrationOverlayDraft | null
  onPointerDown: (point: Point, hitTolerance: number) => boolean
  onPointerMove: (point: Point | null) => void
  onPointerUp: (point: Point) => void
  onPointerCancel: () => void
}

function pointerToNative(
  event: PointerEvent<HTMLCanvasElement>,
  nativeSize: Size,
  clampToCanvas: boolean,
): Point | null {
  const bounds = event.currentTarget.getBoundingClientRect()
  let x = event.clientX - bounds.left
  let y = event.clientY - bounds.top
  if (clampToCanvas) {
    x = Math.max(0, Math.min(bounds.width, x))
    y = Math.max(0, Math.min(bounds.height, y))
  }

  return displayPointToVideo(
    { x, y },
    { x: 0, y: 0, width: bounds.width, height: bounds.height },
    nativeSize,
  )
}

export function AnnotationCanvas({
  contentRect,
  nativeSize,
  annotations,
  selectedId,
  activeTool,
  draft,
  calibration,
  calibrationDraft,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const displayScale = contentRect.width / nativeSize.width

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (context === null || context === undefined) {
      return
    }

    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    renderCalibrationLayer(context, calibration, calibrationDraft, displayScale)
    renderAnnotationLayer(context, annotations, {
      selectedId,
      draft,
      displayScale,
      calibration,
      clear: false,
    })
  }, [
    activeTool,
    annotations,
    calibration,
    calibrationDraft,
    displayScale,
    draft,
    selectedId,
  ])

  const overlayStyle = {
    '--overlay-left': `${contentRect.x}px`,
    '--overlay-top': `${contentRect.y}px`,
    '--overlay-width': `${contentRect.width}px`,
    '--overlay-height': `${contentRect.height}px`,
  } as CSSProperties

  const interactionMode = calibrationDraft === null ? activeTool : 'calibration'

  return (
    <canvas
      aria-label={`Video measurement canvas. Active tool: ${interactionMode}`}
      className={`video-stage__overlay annotation-canvas annotation-canvas--${interactionMode}`}
      data-coordinate-space="native-video-pixels"
      height={nativeSize.height}
      onPointerCancel={() => onPointerCancel()}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.focus()
        const point = pointerToNative(event, nativeSize, false)
        if (point === null) return
        const hitTolerance = 10 / Math.max(displayScale, 0.01)
        if (onPointerDown(point, hitTolerance)) {
          event.currentTarget.setPointerCapture(event.pointerId)
        }
      }}
      onPointerLeave={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          onPointerMove(null)
        }
      }}
      onPointerMove={(event) => {
        onPointerMove(pointerToNative(event, nativeSize, true))
      }}
      onPointerUp={(event) => {
        const point = pointerToNative(event, nativeSize, true)
        if (point !== null) onPointerUp(point)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      ref={canvasRef}
      role="application"
      style={overlayStyle}
      tabIndex={0}
      width={nativeSize.width}
    >
      Your browser does not support the annotation canvas.
    </canvas>
  )
}
