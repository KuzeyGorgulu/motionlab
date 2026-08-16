import type { Point } from '../video/geometry'
import {
  calibrationPixelDistance,
  derivedYAxis,
  unitsPerPixel,
} from './model'
import { formatMeasurementValue } from './measurement'
import type { Calibration, CalibrationOverlayDraft, UnitVector } from './types'

const REFERENCE_COLOR = '#ce8cff'
const X_AXIS_COLOR = '#ff8178'
const Y_AXIS_COLOR = '#78a8ff'
const PREVIEW_COLOR = '#f0bd63'

function drawHandle(
  context: CanvasRenderingContext2D,
  point: Point,
  unit: number,
  color: string,
  label?: string,
) {
  context.beginPath()
  context.arc(point.x, point.y, 5 * unit, 0, Math.PI * 2)
  context.fillStyle = 'rgba(8, 9, 13, 0.9)'
  context.fill()
  context.strokeStyle = color
  context.lineWidth = 2 * unit
  context.stroke()
  if (label !== undefined) {
    context.fillStyle = color
    context.font = `700 ${10 * unit}px ui-monospace, Consolas, monospace`
    context.fillText(label, point.x + 8 * unit, point.y - 8 * unit)
  }
}

function drawArrow(
  context: CanvasRenderingContext2D,
  origin: Point,
  direction: UnitVector,
  length: number,
  unit: number,
  color: string,
  label: string,
) {
  const end = {
    x: origin.x + direction.x * length,
    y: origin.y + direction.y * length,
  }
  const headSize = 7 * unit
  const angle = Math.atan2(direction.y, direction.x)

  context.beginPath()
  context.moveTo(origin.x, origin.y)
  context.lineTo(end.x, end.y)
  context.lineTo(
    end.x - Math.cos(angle - Math.PI / 6) * headSize,
    end.y - Math.sin(angle - Math.PI / 6) * headSize,
  )
  context.moveTo(end.x, end.y)
  context.lineTo(
    end.x - Math.cos(angle + Math.PI / 6) * headSize,
    end.y - Math.sin(angle + Math.PI / 6) * headSize,
  )
  context.strokeStyle = color
  context.lineWidth = 2 * unit
  context.stroke()
  context.fillStyle = color
  context.font = `700 ${10 * unit}px ui-monospace, Consolas, monospace`
  context.fillText(label, end.x + 6 * unit, end.y - 5 * unit)
}

function drawReference(
  context: CanvasRenderingContext2D,
  calibration: Calibration,
  unit: number,
) {
  context.save()
  context.setLineDash([5 * unit, 4 * unit])
  context.beginPath()
  context.moveTo(calibration.referenceA.x, calibration.referenceA.y)
  context.lineTo(calibration.referenceB.x, calibration.referenceB.y)
  context.strokeStyle = REFERENCE_COLOR
  context.lineWidth = 1.5 * unit
  context.stroke()
  context.restore()
  drawHandle(context, calibration.referenceA, unit, REFERENCE_COLOR, 'A')
  drawHandle(context, calibration.referenceB, unit, REFERENCE_COLOR, 'B')

  const midpoint = {
    x: (calibration.referenceA.x + calibration.referenceB.x) / 2,
    y: (calibration.referenceA.y + calibration.referenceB.y) / 2,
  }
  const text = `${formatMeasurementValue(calibration.knownDistance)} ${calibration.unit} · ${calibrationPixelDistance(calibration).toFixed(1)} px`
  context.font = `600 ${9 * unit}px ui-monospace, Consolas, monospace`
  const width = context.measureText(text).width + 8 * unit
  context.fillStyle = 'rgba(11, 7, 15, 0.82)'
  context.fillRect(midpoint.x - width / 2, midpoint.y + 8 * unit, width, 17 * unit)
  context.fillStyle = '#e3c7f2'
  context.fillText(text, midpoint.x - width / 2 + 4 * unit, midpoint.y + 20 * unit)
}

function drawOriginAndAxes(
  context: CanvasRenderingContext2D,
  calibration: Calibration,
  unit: number,
) {
  const origin = calibration.origin
  const radius = 7 * unit
  context.beginPath()
  context.arc(origin.x, origin.y, radius, 0, Math.PI * 2)
  context.moveTo(origin.x - radius * 1.5, origin.y)
  context.lineTo(origin.x + radius * 1.5, origin.y)
  context.moveTo(origin.x, origin.y - radius * 1.5)
  context.lineTo(origin.x, origin.y + radius * 1.5)
  context.strokeStyle = '#f2f5f6'
  context.lineWidth = 1.5 * unit
  context.stroke()

  const axisLength = 58 * unit
  drawArrow(context, origin, calibration.xAxis, axisLength, unit, X_AXIS_COLOR, '+X')
  drawArrow(context, origin, derivedYAxis(calibration), axisLength, unit, Y_AXIS_COLOR, '+Y')
}

function drawDraft(
  context: CanvasRenderingContext2D,
  calibration: Calibration | null,
  draft: CalibrationOverlayDraft,
  unit: number,
) {
  const preview = draft.previewPoint
  if (draft.mode === 'scale-points' || draft.mode === 'scale-values') {
    const a = draft.referencePoints[0]
    if (a !== undefined) {
      const b = draft.referencePoints[1] ?? preview
      drawHandle(context, a, unit, PREVIEW_COLOR, 'A')
      if (b === undefined || b === null) return
      context.save()
      context.setLineDash([6 * unit, 5 * unit])
      context.beginPath()
      context.moveTo(a.x, a.y)
      context.lineTo(b.x, b.y)
      context.strokeStyle = PREVIEW_COLOR
      context.lineWidth = 1.5 * unit
      context.stroke()
      context.restore()
      drawHandle(context, b, unit, PREVIEW_COLOR, 'B')
    }
  } else if (draft.mode === 'origin' && preview !== null) {
    drawHandle(context, preview, unit, PREVIEW_COLOR, 'Origin')
  } else if (
    draft.mode === 'x-axis' &&
    preview !== null &&
    calibration !== null
  ) {
    const dx = preview.x - calibration.origin.x
    const dy = preview.y - calibration.origin.y
    const length = Math.hypot(dx, dy)
    if (length > 0) {
      drawArrow(
        context,
        calibration.origin,
        { x: dx / length, y: dy / length },
        length,
        unit,
        PREVIEW_COLOR,
        '+X',
      )
    }
  }
}

export function renderCalibrationLayer(
  context: CanvasRenderingContext2D,
  calibration: Calibration | null,
  draft: CalibrationOverlayDraft | null,
  displayScale: number,
) {
  const unit = 1 / Math.max(displayScale, 0.01)
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (calibration !== null && unitsPerPixel(calibration) > 0) {
    drawReference(context, calibration, unit)
    drawOriginAndAxes(context, calibration, unit)
  }
  if (draft !== null) {
    drawDraft(context, calibration, draft, unit)
  }
  context.restore()
}
