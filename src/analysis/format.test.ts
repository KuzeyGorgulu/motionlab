import { describe, expect, it } from 'vitest'

import { formatAnalysisNumber } from './format'

describe('kinematic value formatting', () => {
  it('keeps small nonzero values visibly nonzero', () => {
    expect(formatAnalysisNumber(0.0000123)).toBe('1.230e-5')
  })

  it('formats ordinary values compactly and preserves true zero', () => {
    expect(formatAnalysisNumber(2.5)).toBe('2.5')
    expect(formatAnalysisNumber(0)).toBe('0')
  })

  it('never renders non-finite values as numbers', () => {
    expect(formatAnalysisNumber(Number.NaN)).toBe('—')
    expect(formatAnalysisNumber(Number.POSITIVE_INFINITY)).toBe('—')
  })
})
