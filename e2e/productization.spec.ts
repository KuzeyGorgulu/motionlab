import { expect, test, type Page } from '@playwright/test'

import { ONBOARDING_PREFERENCE_KEY } from '../src/product/preferences'

async function openAsReturningUser(page: Page) {
  await page.addInitScript((preferenceKey) => {
    window.localStorage.setItem(preferenceKey, 'true')
  }, ONBOARDING_PREFERENCE_KEY)
  await page.goto('/app')
}

test('first launch presents dismissible onboarding that can be reopened from Help', async ({ page }) => {
  await page.goto('/app')

  const welcome = page.getByRole('dialog', { name: 'Welcome to MotionLab' })
  await expect(welcome).toBeVisible()
  await expect(welcome.getByText('Your video stays local')).toBeVisible()
  await expect(welcome.getByRole('button', { name: 'Next' })).toBeFocused()
  await welcome.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('dialog', { name: 'A clear experiment workflow' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.reload()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: /Help/ }).click()
  const help = page.getByRole('dialog', { name: 'Help' })
  await help.getByRole('button', { name: 'Reopen getting-started tour' }).click()
  await expect(page.getByRole('dialog', { name: 'Welcome to MotionLab' })).toBeVisible()
})

test('shortcut help is accurate, keyboard accessible, and available with question mark', async ({ page }) => {
  await openAsReturningUser(page)
  await page.keyboard.press('?')

  const shortcuts = page.getByRole('dialog', { name: 'Keyboard Shortcuts' })
  await expect(shortcuts).toBeVisible()
  await expect(shortcuts.getByRole('heading', { name: 'Playback' })).toBeVisible()
  await expect(shortcuts.getByText('Ctrl/Cmd + Shift + Z', { exact: true })).toBeVisible()
  await expect(shortcuts.getByText('Open Keyboard Shortcuts')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(shortcuts).toBeHidden()

  const helpButton = page.getByRole('button', { name: /Help/ })
  await helpButton.click()
  await page.getByRole('button', { name: 'Close Help' }).click()
  await expect(helpButton).toBeFocused()
})

test('About and Privacy present the release version and local-first boundaries', async ({ page }) => {
  await openAsReturningUser(page)
  await page.getByRole('button', { name: /Help/ }).click()
  const help = page.getByRole('dialog')

  await help.getByRole('button', { name: 'About', exact: true }).click()
  await expect(help.getByText('MotionLab v1.0.0', { exact: true })).toBeVisible()
  await expect(help.getByRole('link', { name: 'GitHub repository' })).toHaveAttribute(
    'href',
    'https://github.com/KuzeyGorgulu/motionlab',
  )
  await expect(help.getByAltText('Qzeybei')).toBeVisible()

  await help.getByRole('button', { name: 'Privacy', exact: true }).click()
  await expect(help.getByText(/videos are decoded and processed locally/i)).toBeVisible()
  await expect(help.getByText(/never the source video/i)).toBeVisible()
  await expect(help.getByText(/no account system, telemetry, analytics/i)).toBeVisible()
})

test('bundled sample opens through the normal project workflow and supports analysis and report exploration', async ({ page }) => {
  await openAsReturningUser(page)
  await page.getByRole('button', { name: 'Try sample' }).click()

  const inspector = page.getByRole('complementary', { name: 'Workspace inspector' })
  await expect(inspector).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Constant-speed marker' })).toBeVisible()
  await expect(page.locator('#calibration-panel')).toContainText('Physical measurements are active in m.')
  const analysis = page.getByRole('region', { name: 'Motion analysis' })
  await expect(analysis).toContainText('9 valid samples')
  await analysis.getByRole('button', { name: 'Constant velocity', exact: true }).click()
  await analysis.getByRole('button', { name: 'Residuals', exact: true }).click()
  await expect(analysis.getByRole('group', { name: /Residual magnitude against media time/ })).toBeVisible()

  await page.getByRole('button', { name: 'Report', exact: true }).click()
  const report = page.getByRole('article', { name: 'Experiment report' })
  await expect(report.getByRole('heading', { name: 'Constant-Speed Motion' })).toBeVisible()
  await expect(report).toContainText('MotionLab version')
  await expect(report).toContainText('1.0.0')
})

test('release dialogs and the active workspace avoid horizontal overflow at representative widths', async ({ page }) => {
  await openAsReturningUser(page)
  await page.getByRole('button', { name: 'Try sample' }).click()
  await expect(page.getByRole('complementary', { name: 'Workspace inspector' })).toBeVisible()

  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const layout = await page.evaluate(() => ({
      fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      containers: ['body', '.app-shell', '.workspace', '.workspace__body', '.analysis-area', '.inspector']
        .map((selector) => {
          const element = document.querySelector<HTMLElement>(selector)
          if (element === null) return { selector, missing: true }
          const rect = element.getBoundingClientRect()
          return {
            selector,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          }
        }),
      offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 8)
        .map((element) => ({
          className: element.className,
          right: Math.round(element.getBoundingClientRect().right),
          tagName: element.tagName,
        })),
    }))
    expect(layout.fits, `viewport ${width}px: ${JSON.stringify(layout)}`).toBe(true)
  }

  await page.getByRole('button', { name: /Help/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Help' })
  await expect(dialog).toBeVisible()
  const dialogBox = await dialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390)
})
