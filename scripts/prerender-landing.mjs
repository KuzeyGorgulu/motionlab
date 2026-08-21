import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const assetsDirectory = fileURLToPath(new URL('../dist/assets/', import.meta.url))
const landingHtmlPath = fileURLToPath(new URL('../dist/index.html', import.meta.url))
const appHtmlPath = fileURLToPath(new URL('../dist/app/index.html', import.meta.url))
const rootPlaceholder = '<div id="root"></div>'
const requiredCrawlerText = [
  'MotionLab',
  'Turn ordinary videos into measurable physics experiments.',
  'MotionLab is a local-first browser tool for turning ordinary videos into measurable physics experiments.',
  'video motion analysis',
  'physics',
  'kinematics',
  'manual tracking',
  'assisted tracking',
  'spatial calibration',
  'position',
  'velocity',
  'acceleration',
  'motion model fitting',
  'residual analysis',
  'local-first',
  'no uploads',
  'no account required',
  'open source',
]

const assetFiles = await readdir(assetsDirectory)
const assistedTrackingDemo = assetFiles.find(
  (fileName) => fileName.startsWith('assisted-tracking-demo-') && fileName.endsWith('.gif'),
)

if (assistedTrackingDemo === undefined) {
  throw new Error(`Could not find the built Assisted Tracking demo in ${assetsDirectory}.`)
}

const vite = await createServer({
  root: projectRoot,
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
})

let landingMarkup

try {
  const serverEntry = await vite.ssrLoadModule('/src/entry-server.tsx')
  landingMarkup = serverEntry.renderLandingPage(`/assets/${assistedTrackingDemo}`)
} finally {
  await vite.close()
}

const landingTemplate = await readFile(landingHtmlPath, 'utf8')

if (!landingTemplate.includes(rootPlaceholder)) {
  throw new Error(`Could not find the landing root placeholder in ${landingHtmlPath}.`)
}

const renderedLandingHtml = landingTemplate.replace(
  rootPlaceholder,
  `<div id="root">${landingMarkup}</div>`,
)
const searchableLandingHtml = renderedLandingHtml.toLocaleLowerCase('en-US')

for (const requiredText of requiredCrawlerText) {
  if (!searchableLandingHtml.includes(requiredText.toLocaleLowerCase('en-US'))) {
    throw new Error(`The prerendered landing page is missing required crawler text: ${requiredText}`)
  }
}

const appHtml = await readFile(appHtmlPath, 'utf8')

if (!appHtml.includes(rootPlaceholder)) {
  throw new Error(`The built /app entry must retain an empty React root in ${appHtmlPath}.`)
}

if (appHtml.includes('Turn ordinary videos into measurable physics experiments.')) {
  throw new Error('The built /app entry unexpectedly contains the landing-page fallback.')
}

await writeFile(landingHtmlPath, renderedLandingHtml, 'utf8')

console.log(`Prerendered crawler-readable landing HTML in ${landingHtmlPath}.`)
console.log(`Verified the separate application entry in ${appHtmlPath}.`)
