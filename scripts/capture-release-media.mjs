import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const outputDirectory = resolve(scriptDirectory, '../docs/assets')
const baseUrl = process.env.MOTIONLAB_CAPTURE_URL ?? 'http://127.0.0.1:4173'
const appUrl = new URL('/app', baseUrl).toString()
const browser = await chromium.launch({ headless: true })

try {
  await mkdir(outputDirectory, { recursive: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  await page.addInitScript(() => {
    window.localStorage.setItem('motionlab:onboarding-complete:v1', 'true')
  })
  await page.goto(appUrl)
  await page.screenshot({
    path: resolve(outputDirectory, 'v1-empty-import.png'),
  })

  await page.getByRole('button', { name: 'Try sample' }).click()
  await page.getByRole('complementary', { name: 'Workspace inspector' }).waitFor()
  await page.screenshot({
    path: resolve(outputDirectory, 'v1-tracking-workspace.png'),
  })

  const analysis = page.getByRole('region', { name: 'Motion analysis' })
  await analysis.getByRole('button', { name: 'Position', exact: true }).click()
  await page.screenshot({
    path: resolve(outputDirectory, 'v1-analysis-graphs.png'),
  })

  await analysis.getByRole('button', { name: 'Constant velocity', exact: true }).click()
  await analysis.getByRole('button', { name: 'Residuals', exact: true }).click()
  await page.screenshot({
    path: resolve(outputDirectory, 'v1-fit-residuals.png'),
  })

  await page.getByRole('button', { name: 'Report', exact: true }).click()
  await page.getByRole('article', { name: 'Experiment report' }).waitFor()
  await page.screenshot({
    path: resolve(outputDirectory, 'v1-experiment-report.png'),
  })

  console.log(`Captured MotionLab release media in ${outputDirectory}`)
} finally {
  await browser.close()
}
