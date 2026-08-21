import { describe, expect, it } from 'vitest'

import { resolveMotionLabRoute } from './routing'

describe('resolveMotionLabRoute', () => {
  it('serves the public landing page at the root path', () => {
    expect(resolveMotionLabRoute('/')).toBe('landing')
  })

  it('serves the workspace at the app path with or without a trailing slash', () => {
    expect(resolveMotionLabRoute('/app')).toBe('app')
    expect(resolveMotionLabRoute('/app/')).toBe('app')
  })

  it('does not expose the workspace at unrelated paths', () => {
    expect(resolveMotionLabRoute('/about')).toBe('landing')
  })
})
