import { describe, expect, it } from 'vitest'

import {
  FALLBACK_FRAME_RATE,
  clampMediaTime,
  formatTimestamp,
  getFrameStepSeconds,
} from './timing'

describe('getFrameStepSeconds', () => {
  it('uses the documented fallback frame rate by default', () => {
    expect(getFrameStepSeconds()).toBe(1 / FALLBACK_FRAME_RATE)
  })

  it('accepts a future valid detected or user-provided rate', () => {
    expect(getFrameStepSeconds(60)).toBe(1 / 60)
  })

  it('falls back for unusable rates', () => {
    expect(getFrameStepSeconds(0)).toBe(1 / FALLBACK_FRAME_RATE)
    expect(getFrameStepSeconds(Number.NaN)).toBe(1 / FALLBACK_FRAME_RATE)
    expect(getFrameStepSeconds(1000)).toBe(1 / FALLBACK_FRAME_RATE)
  })
})

describe('clampMediaTime', () => {
  it('keeps media time inside the known duration', () => {
    expect(clampMediaTime(-3, 10)).toBe(0)
    expect(clampMediaTime(4.5, 10)).toBe(4.5)
    expect(clampMediaTime(12, 10)).toBe(10)
  })

  it('only applies the lower bound when duration is unknown', () => {
    expect(clampMediaTime(12, null)).toBe(12)
  })
})

describe('formatTimestamp', () => {
  it('shows millisecond precision and carries rounding correctly', () => {
    expect(formatTimestamp(65.1234)).toBe('01:05.123')
    expect(formatTimestamp(59.9996)).toBe('01:00.000')
  })

  it('adds hours when needed', () => {
    expect(formatTimestamp(3661.042)).toBe('01:01:01.042')
  })

  it('shows a placeholder for unavailable values', () => {
    expect(formatTimestamp(null)).toBe('--:--.---')
    expect(formatTimestamp(Number.NaN)).toBe('--:--.---')
  })
})
