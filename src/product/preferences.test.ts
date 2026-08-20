import { describe, expect, it } from 'vitest'

import {
  ONBOARDING_PREFERENCE_KEY,
  rememberOnboardingComplete,
  shouldShowOnboarding,
} from './preferences'

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue
  return {
    getItem: (key: string) => key === ONBOARDING_PREFERENCE_KEY ? value : null,
    setItem: (key: string, nextValue: string) => {
      if (key === ONBOARDING_PREFERENCE_KEY) value = nextValue
    },
  }
}

describe('first-run onboarding preference', () => {
  it('shows onboarding until completion is remembered', () => {
    const storage = memoryStorage()
    expect(shouldShowOnboarding(storage)).toBe(true)
    expect(rememberOnboardingComplete(storage)).toBe(true)
    expect(shouldShowOnboarding(storage)).toBe(false)
  })

  it('fails open when browser storage is unavailable', () => {
    const unavailableStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(shouldShowOnboarding(unavailableStorage)).toBe(true)
    expect(rememberOnboardingComplete(unavailableStorage)).toBe(false)
  })
})
