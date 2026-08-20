export const ONBOARDING_PREFERENCE_KEY = 'motionlab:onboarding-complete:v1'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export function shouldShowOnboarding(storage: PreferenceStorage): boolean {
  try {
    return storage.getItem(ONBOARDING_PREFERENCE_KEY) !== 'true'
  } catch {
    return true
  }
}

export function rememberOnboardingComplete(storage: PreferenceStorage): boolean {
  try {
    storage.setItem(ONBOARDING_PREFERENCE_KEY, 'true')
    return true
  } catch {
    return false
  }
}
