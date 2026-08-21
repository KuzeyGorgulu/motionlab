import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'

import App from './App'
import { LandingPage } from './components/landing/LandingPage'
import { resolveMotionLabRoute } from './routing'
import './styles.css'

const root = document.getElementById('root')

if (root === null) {
  throw new Error('MotionLab could not find its root element.')
}

const route = resolveMotionLabRoute(window.location.pathname)

document.body.classList.toggle('landing-mode', route === 'landing')

const application = (
  <StrictMode>
    {route === 'app' ? <App /> : <LandingPage />}
  </StrictMode>
)

if (route === 'landing' && root.hasChildNodes()) {
  hydrateRoot(root, application)
} else {
  createRoot(root).render(application)
}
