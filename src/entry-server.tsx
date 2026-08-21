import { renderToString } from 'react-dom/server'

import { LandingPage } from './components/landing/LandingPage'

export function renderLandingPage(assistedTrackingDemoUrl: string) {
  return renderToString(<LandingPage assistedTrackingDemoUrl={assistedTrackingDemoUrl} />)
}
