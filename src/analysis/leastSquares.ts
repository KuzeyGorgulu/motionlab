const SOLVER_EPSILON = 1e-12
export const MIN_REGRESSION_TIME_SPAN_SECONDS = 1e-6

export interface PolynomialLeastSquaresFit {
  /** Coefficients for powers of (time - referenceTime), in ascending order. */
  coefficients: number[]
  predictions: number[]
  residualSumSquares: number
  rSquared: number | null
}

function solveLinearSystem(
  sourceMatrix: readonly (readonly number[])[],
  sourceVector: readonly number[],
): number[] | null {
  const size = sourceVector.length
  if (sourceMatrix.length !== size || size === 0) return null
  const augmented = sourceMatrix.map((row, index) => [
    ...row,
    sourceVector[index]!,
  ])
  if (augmented.some((row) => row.length !== size + 1)) return null

  const matrixScale = Math.max(
    1,
    ...augmented.flatMap((row) => row.slice(0, size).map(Math.abs)),
  )
  const pivotTolerance = matrixScale * SOLVER_EPSILON

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column
    let pivotMagnitude = Math.abs(augmented[column]![column]!)
    for (let row = column + 1; row < size; row += 1) {
      const candidate = Math.abs(augmented[row]![column]!)
      if (candidate > pivotMagnitude) {
        pivotMagnitude = candidate
        pivotRow = row
      }
    }
    if (!Number.isFinite(pivotMagnitude) || pivotMagnitude <= pivotTolerance) {
      return null
    }
    if (pivotRow !== column) {
      const current = augmented[column]!
      augmented[column] = augmented[pivotRow]!
      augmented[pivotRow] = current
    }

    const pivot = augmented[column]![column]!
    for (let row = column + 1; row < size; row += 1) {
      const factor = augmented[row]![column]! / pivot
      if (!Number.isFinite(factor)) return null
      for (let entry = column; entry <= size; entry += 1) {
        augmented[row]![entry] -= factor * augmented[column]![entry]!
      }
    }
  }

  const solution = Array<number>(size).fill(0)
  for (let row = size - 1; row >= 0; row -= 1) {
    let remainder = augmented[row]![size]!
    for (let column = row + 1; column < size; column += 1) {
      remainder -= augmented[row]![column]! * solution[column]!
    }
    const value = remainder / augmented[row]![row]!
    if (!Number.isFinite(value)) return null
    solution[row] = value
  }
  return solution
}

function evaluatePolynomial(coefficients: readonly number[], time: number): number {
  let value = 0
  for (let index = coefficients.length - 1; index >= 0; index -= 1) {
    value = value * time + coefficients[index]!
  }
  return value
}

export function fitPolynomialLeastSquares(
  times: readonly number[],
  values: readonly number[],
  degree: 1 | 2,
  referenceTime: number,
): PolynomialLeastSquaresFit | null {
  const parameterCount = degree + 1
  if (
    times.length !== values.length ||
    times.length < parameterCount ||
    !Number.isFinite(referenceTime) ||
    times.some((time) => !Number.isFinite(time)) ||
    values.some((value) => !Number.isFinite(value))
  ) {
    return null
  }

  const minimumTime = Math.min(...times)
  const maximumTime = Math.max(...times)
  const timeSpan = maximumTime - minimumTime
  if (
    !Number.isFinite(timeSpan) ||
    timeSpan <= MIN_REGRESSION_TIME_SPAN_SECONDS
  ) {
    return null
  }

  const centeredTimes = times.map((time) => time - referenceTime)
  const timeScale = Math.max(...centeredTimes.map(Math.abs))
  if (!Number.isFinite(timeScale) || timeScale <= 0) return null
  const normalizedTimes = centeredTimes.map((time) => time / timeScale)
  const normalMatrix = Array.from({ length: parameterCount }, () =>
    Array<number>(parameterCount).fill(0),
  )
  const normalVector = Array<number>(parameterCount).fill(0)

  for (let sampleIndex = 0; sampleIndex < normalizedTimes.length; sampleIndex += 1) {
    const powers = Array<number>(degree * 2 + 1).fill(1)
    for (let power = 1; power < powers.length; power += 1) {
      powers[power] = powers[power - 1]! * normalizedTimes[sampleIndex]!
    }
    for (let row = 0; row < parameterCount; row += 1) {
      normalVector[row] += values[sampleIndex]! * powers[row]!
      for (let column = 0; column < parameterCount; column += 1) {
        normalMatrix[row]![column] += powers[row + column]!
      }
    }
  }

  const normalizedCoefficients = solveLinearSystem(normalMatrix, normalVector)
  if (normalizedCoefficients === null) return null
  const coefficients = normalizedCoefficients.map(
    (coefficient, power) => coefficient / timeScale ** power,
  )
  if (coefficients.some((coefficient) => !Number.isFinite(coefficient))) {
    return null
  }

  const predictions = centeredTimes.map((time) =>
    evaluatePolynomial(coefficients, time),
  )
  if (predictions.some((prediction) => !Number.isFinite(prediction))) {
    return null
  }
  const residualSumSquares = values.reduce((sum, value, index) => {
    const residual = value - predictions[index]!
    return sum + residual * residual
  }, 0)
  if (!Number.isFinite(residualSumSquares)) return null

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const totalSumSquares = values.reduce((sum, value) => {
    const difference = value - mean
    return sum + difference * difference
  }, 0)
  const varianceScale = Math.max(
    1,
    values.reduce((sum, value) => sum + value * value, 0),
  )
  const rSquared = totalSumSquares <= Number.EPSILON * varianceScale
    ? null
    : 1 - residualSumSquares / totalSumSquares

  return {
    coefficients,
    predictions,
    residualSumSquares,
    rSquared: rSquared === null || Number.isFinite(rSquared) ? rSquared : null,
  }
}
