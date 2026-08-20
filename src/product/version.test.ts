import { describe, expect, it } from 'vitest'

import { MOTIONLAB_RELEASE, MOTIONLAB_VERSION } from './version'

describe('release version', () => {
  it('uses the package version as the v1 release identifier', () => {
    expect(MOTIONLAB_VERSION).toBe('1.0.0')
    expect(MOTIONLAB_RELEASE).toBe('v1.0.0')
    expect(MOTIONLAB_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
