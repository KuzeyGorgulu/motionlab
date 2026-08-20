import { fitPolynomialLeastSquares } from './leastSquares'
import type {
  AnalysisSource,
  ConstantAccelerationFit,
  ConstantVelocityFit,
  MotionModelFit,
  MotionModelFitResult,
  MotionModelType,
  TrackKinematics,
} from './types'

type FittableModelType = Exclude<MotionModelType, 'none'>

function finite(values: readonly number[]): boolean {
  return values.every(Number.isFinite)
}

export function fitMotionModel(
  analysis: TrackKinematics,
  modelType: FittableModelType,
  source: AnalysisSource['type'],
): MotionModelFitResult {
  const degree = modelType === 'constant-velocity' ? 1 : 2
  const minimumSamples = degree + 1
  if (analysis.samples.length < minimumSamples) {
    return {
      ok: false,
      message: `Not enough samples for this model. At least ${minimumSamples} valid observations are required.`,
    }
  }

  const times = analysis.samples.map((sample) => sample.source.time)
  const t0 = Math.min(...times)
  const xValues = analysis.samples.map((sample) => sample.position.x)
  const yValues = analysis.samples.map((sample) => sample.position.y)
  const fitX = fitPolynomialLeastSquares(times, xValues, degree, t0)
  const fitY = fitPolynomialLeastSquares(times, yValues, degree, t0)
  if (fitX === null || fitY === null) {
    return {
      ok: false,
      message: 'Unable to fit this sample set because its timestamps are degenerate or poorly conditioned.',
    }
  }

  const sampleCount = analysis.samples.length
  const timeSpan = Math.max(...times) - t0
  const rmse = Math.sqrt(
    (fitX.residualSumSquares + fitY.residualSumSquares) / sampleCount,
  )
  const shared = {
    t0,
    x0: fitX.coefficients[0]!,
    y0: fitY.coefficients[0]!,
    sampleCount,
    timeSpan,
    rmse,
    rSquaredX: fitX.rSquared,
    rSquaredY: fitY.rSquared,
    source,
  }

  if (modelType === 'constant-velocity') {
    const vx = fitX.coefficients[1]!
    const vy = fitY.coefficients[1]!
    const speed = Math.hypot(vx, vy)
    if (!finite([t0, timeSpan, rmse, shared.x0, shared.y0, vx, vy, speed])) {
      return { ok: false, message: 'Unable to fit this sample set safely.' }
    }
    const fit: ConstantVelocityFit = {
      type: modelType,
      ...shared,
      vx,
      vy,
      speed,
    }
    return { ok: true, fit }
  }

  const vx0 = fitX.coefficients[1]!
  const vy0 = fitY.coefficients[1]!
  const ax = 2 * fitX.coefficients[2]!
  const ay = 2 * fitY.coefficients[2]!
  const initialSpeed = Math.hypot(vx0, vy0)
  const accelerationMagnitude = Math.hypot(ax, ay)
  if (!finite([
    t0,
    timeSpan,
    rmse,
    shared.x0,
    shared.y0,
    vx0,
    vy0,
    ax,
    ay,
    initialSpeed,
    accelerationMagnitude,
  ])) {
    return { ok: false, message: 'Unable to fit this sample set safely.' }
  }
  const fit: ConstantAccelerationFit = {
    type: modelType,
    ...shared,
    vx0,
    vy0,
    ax,
    ay,
    initialSpeed,
    accelerationMagnitude,
  }
  return { ok: true, fit }
}

export interface EvaluatedMotionModel {
  position: { x: number; y: number }
  velocity: { x: number; y: number; magnitude: number }
  acceleration: { x: number; y: number; magnitude: number }
}

export function evaluateMotionModel(
  fit: MotionModelFit,
  time: number,
): EvaluatedMotionModel | null {
  if (!Number.isFinite(time)) return null
  const tau = time - fit.t0
  const result = fit.type === 'constant-velocity'
    ? {
        position: { x: fit.x0 + fit.vx * tau, y: fit.y0 + fit.vy * tau },
        velocity: { x: fit.vx, y: fit.vy, magnitude: fit.speed },
        acceleration: { x: 0, y: 0, magnitude: 0 },
      }
    : {
        position: {
          x: fit.x0 + fit.vx0 * tau + 0.5 * fit.ax * tau * tau,
          y: fit.y0 + fit.vy0 * tau + 0.5 * fit.ay * tau * tau,
        },
        velocity: {
          x: fit.vx0 + fit.ax * tau,
          y: fit.vy0 + fit.ay * tau,
          magnitude: Math.hypot(fit.vx0 + fit.ax * tau, fit.vy0 + fit.ay * tau),
        },
        acceleration: {
          x: fit.ax,
          y: fit.ay,
          magnitude: fit.accelerationMagnitude,
        },
      }
  return finite([
    result.position.x,
    result.position.y,
    result.velocity.x,
    result.velocity.y,
    result.velocity.magnitude,
    result.acceleration.x,
    result.acceleration.y,
    result.acceleration.magnitude,
  ])
    ? result
    : null
}
