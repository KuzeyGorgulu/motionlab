import type { Point } from '../video/geometry'
import type { AssistedSuggestion } from './types'

interface AssistedRenderOptions {
  seedPosition: Point | null
  suggestions: readonly AssistedSuggestion[]
  color: string | null
  displayScale: number
}

function drawHollowDiamond(
  context: CanvasRenderingContext2D,
  point: Point,
  size: number,
) {
  context.beginPath()
  context.moveTo(point.x, point.y - size)
  context.lineTo(point.x + size, point.y)
  context.lineTo(point.x, point.y + size)
  context.lineTo(point.x - size, point.y)
  context.closePath()
  context.stroke()
}

export function renderAssistedTrackingLayer(
  context: CanvasRenderingContext2D,
  options: AssistedRenderOptions,
) {
  if (
    options.seedPosition === null ||
    options.suggestions.length === 0 ||
    options.color === null
  ) {
    return
  }

  const unit = 1 / Math.max(options.displayScale, 0.01)
  const points = [
    options.seedPosition,
    ...options.suggestions.map((suggestion) => suggestion.sample.nativePosition),
  ]

  context.save()
  context.globalAlpha = 0.68
  context.strokeStyle = options.color
  context.lineWidth = 1.7 * unit
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.setLineDash([5 * unit, 4 * unit])
  context.beginPath()
  context.moveTo(points[0]!.x, points[0]!.y)
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index]!.x, points[index]!.y)
  }
  context.stroke()

  context.setLineDash([])
  context.fillStyle = '#0b1014'
  context.lineWidth = 1.8 * unit
  for (const suggestion of options.suggestions) {
    const point = suggestion.sample.nativePosition
    const size = 4.5 * unit
    context.save()
    context.translate(point.x, point.y)
    context.rotate(Math.PI / 4)
    context.fillRect(-3.2 * unit, -3.2 * unit, 6.4 * unit, 6.4 * unit)
    context.restore()
    drawHollowDiamond(context, point, size)
  }
  context.restore()
}
