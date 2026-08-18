import { describe, expect, it } from 'vitest'

import { createFrameReference } from '../video/frameReference'
import { createTrackSample } from './model'
import { hitTestTrackSample } from './hitTest'

const first = createTrackSample(
  'first',
  createFrameReference(1),
  { x: 10, y: 10 },
)!
const second = createTrackSample(
  'second',
  createFrameReference(2),
  { x: 14, y: 10 },
)!

describe('track sample hit testing', () => {
  it('returns the closest sample inside the native-coordinate tolerance', () => {
    expect(hitTestTrackSample([first, second], { x: 13, y: 10 }, 5)?.id).toBe(
      'second',
    )
  })

  it('returns null outside tolerance or for an invalid tolerance', () => {
    expect(hitTestTrackSample([first], { x: 30, y: 30 }, 5)).toBeNull()
    expect(hitTestTrackSample([first], { x: 10, y: 10 }, Number.NaN)).toBeNull()
  })
})
