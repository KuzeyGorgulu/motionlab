export function formatAnalysisNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const magnitude = Math.abs(value)
  if (magnitude === 0) return '0'
  if (magnitude < 0.001 || magnitude >= 1_000_000) {
    return value.toExponential(3).replace(/\.0+(?=e)/, '')
  }

  const decimalPlaces =
    magnitude >= 100 ? 1 : magnitude >= 10 ? 2 : magnitude >= 1 ? 3 : 4
  return value.toFixed(decimalPlaces).replace(/\.?0+$/, '')
}
