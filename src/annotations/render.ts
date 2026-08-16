import type { Point } from '../video/geometry'
import { angleBetweenThreePoints, distanceBetweenPoints } from './measurement'
import type { Annotation, AnnotationDraft } from './types'

interface RenderOptions {
  selectedId: string | null
  draft: AnnotationDraft | null
  displayScale: number
}

const NORMAL_COLOR = '#55d6be'
const SELECTED_COLOR = '#f0bd63'
const DRAFT_COLOR = '#e5a84d'
const HANDLE_FILL = '#08100f'

function drawHandle(
  context: CanvasRenderingContext2D,
  point: Point,
  unit: number,
  color: string,
  selected: boolean,
) {
  context.beginPath()
  context.arc(point.x, point.y, (selected ? 5.5 : 4) * unit, 0, Math.PI * 2)
  context.fillStyle = HANDLE_FILL
  context.fill()
  context.lineWidth = (selected ? 2 : 1.5) * unit
  context.strokeStyle = color
  context.stroke()
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  point: Point,
  unit: number,
  color: string,
) {
  const fontSize = 11 * unit
  const paddingX = 5 * unit
  const paddingY = 4 * unit
  context.font = `600 ${fontSize}px ui-monospace, Consolas, monospace`
  context.textBaseline = 'middle'
  const width = context.measureText(text).width + paddingX * 2
  const height = fontSize + paddingY * 2
  const x = point.x - width / 2
  const y = point.y - height / 2

  context.fillStyle = 'rgba(6, 10, 12, 0.86)'
  context.fillRect(x, y, width, height)
  context.strokeStyle = color
  context.lineWidth = unit
  context.strokeRect(x, y, width, height)
  context.fillStyle = '#f0f4f6'
  context.fillText(text, x + paddingX, point.y)
}

function drawPointAnnotation(
  context: CanvasRenderingContext2D,
  point: Point,
  unit: number,
  color: string,
  selected: boolean,
) {
  const crossRadius = 9 * unit
  context.beginPath()
  context.moveTo(point.x - crossRadius, point.y)
  context.lineTo(point.x + crossRadius, point.y)
  context.moveTo(point.x, point.y - crossRadius)
  context.lineTo(point.x, point.y + crossRadius)
  context.strokeStyle = color
  context.lineWidth = 1.5 * unit
  context.stroke()
  drawHandle(context, point, unit, color, selected)
}

function drawLineAnnotation(
  context: CanvasRenderingContext2D,
  annotation: Extract<Annotation, { type: 'line' }>,
  unit: number,
  color: string,
  selected: boolean,
) {
  context.beginPath()
  context.moveTo(annotation.a.x, annotation.a.y)
  context.lineTo(annotation.b.x, annotation.b.y)
  context.strokeStyle = color
  context.lineWidth = (selected ? 2.25 : 1.5) * unit
  context.stroke()
  drawHandle(context, annotation.a, unit, color, selected)
  drawHandle(context, annotation.b, unit, color, selected)

  const distance = distanceBetweenPoints(annotation.a, annotation.b)
  drawLabel(
    context,
    distance === null ? 'undefined' : `${distance.toFixed(1)} px`,
    {
      x: (annotation.a.x + annotation.b.x) / 2,
      y: (annotation.a.y + annotation.b.y) / 2 - 13 * unit,
    },
    unit,
    color,
  )
}

function drawAngleAnnotation(
  context: CanvasRenderingContext2D,
  annotation: Extract<Annotation, { type: 'angle' }>,
  unit: number,
  color: string,
  selected: boolean,
) {
  context.beginPath()
  context.moveTo(annotation.a.x, annotation.a.y)
  context.lineTo(annotation.vertex.x, annotation.vertex.y)
  context.lineTo(annotation.b.x, annotation.b.y)
  context.strokeStyle = color
  context.lineWidth = (selected ? 2.25 : 1.5) * unit
  context.stroke()

  const startAngle = Math.atan2(
    annotation.a.y - annotation.vertex.y,
    annotation.a.x - annotation.vertex.x,
  )
  const endAngle = Math.atan2(
    annotation.b.y - annotation.vertex.y,
    annotation.b.x - annotation.vertex.x,
  )
  let delta = endAngle - startAngle
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  const arcRadius = 24 * unit
  context.beginPath()
  context.arc(
    annotation.vertex.x,
    annotation.vertex.y,
    arcRadius,
    startAngle,
    startAngle + delta,
    delta < 0,
  )
  context.stroke()

  drawHandle(context, annotation.a, unit, color, selected)
  drawHandle(context, annotation.vertex, unit, color, selected)
  drawHandle(context, annotation.b, unit, color, selected)

  const angle = angleBetweenThreePoints(
    annotation.a,
    annotation.vertex,
    annotation.b,
  )
  const labelAngle = startAngle + delta / 2
  drawLabel(
    context,
    angle === null ? 'undefined' : `${angle.toFixed(1)}°`,
    {
      x: annotation.vertex.x + Math.cos(labelAngle) * 47 * unit,
      y: annotation.vertex.y + Math.sin(labelAngle) * 47 * unit,
    },
    unit,
    color,
  )
}

function drawDraft(
  context: CanvasRenderingContext2D,
  draft: AnnotationDraft,
  unit: number,
) {
  context.save()
  context.strokeStyle = DRAFT_COLOR
  context.lineWidth = 1.5 * unit
  context.setLineDash([6 * unit, 5 * unit])

  const preview = draft.previewPoint
  if (draft.points.length === 1 && preview !== null) {
    context.beginPath()
    context.moveTo(draft.points[0]!.x, draft.points[0]!.y)
    context.lineTo(preview.x, preview.y)
    context.stroke()
  } else if (draft.points.length === 2 && preview !== null) {
    context.beginPath()
    context.moveTo(draft.points[0]!.x, draft.points[0]!.y)
    context.lineTo(draft.points[1]!.x, draft.points[1]!.y)
    context.lineTo(preview.x, preview.y)
    context.stroke()
  }

  context.setLineDash([])
  for (const point of draft.points) {
    drawHandle(context, point, unit, DRAFT_COLOR, true)
  }
  if (preview !== null) {
    drawHandle(context, preview, unit, DRAFT_COLOR, false)
  }
  context.restore()
}

export function renderAnnotationLayer(
  context: CanvasRenderingContext2D,
  annotations: readonly Annotation[],
  options: RenderOptions,
) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  const unit = 1 / Math.max(options.displayScale, 0.01)

  for (const annotation of annotations) {
    const selected = annotation.id === options.selectedId
    const color = selected ? SELECTED_COLOR : NORMAL_COLOR
    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'

    switch (annotation.type) {
      case 'point':
        drawPointAnnotation(context, annotation.point, unit, color, selected)
        break
      case 'line':
        drawLineAnnotation(context, annotation, unit, color, selected)
        break
      case 'angle':
        drawAngleAnnotation(context, annotation, unit, color, selected)
        break
    }
    context.restore()
  }

  if (options.draft !== null) {
    drawDraft(context, options.draft, unit)
  }
}
