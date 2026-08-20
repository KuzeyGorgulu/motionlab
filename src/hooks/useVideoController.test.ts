import { describe, expect, it } from 'vitest'

import { describeMediaError } from './useVideoController'

describe('video error guidance', () => {
  it('explains unsupported codecs and suggests a useful next action', () => {
    expect(describeMediaError({ code: 4 })).toMatch(/not supported/i)
    expect(describeMediaError({ code: 4 })).toMatch(/MP4 or WebM/i)
  })

  it('keeps unknown failures actionable without exposing raw errors', () => {
    expect(describeMediaError(null)).toMatch(/select another copy/i)
  })
})
