import { expect, test } from '@playwright/test'

import { ONBOARDING_PREFERENCE_KEY } from '../src/product/preferences'

test('production HTML exposes landing semantics only at the root route', async ({ request }) => {
  const landingResponse = await request.get('/')
  expect(landingResponse.ok()).toBe(true)
  const landingHtml = await landingResponse.text()
  expect(landingHtml).toContain('<h1 id="landing-title">Turn ordinary videos into measurable physics experiments.</h1>')
  expect(landingHtml).toContain(
    'MotionLab is a local-first browser tool for turning ordinary videos into measurable physics experiments.',
  )
  expect(landingHtml).toContain('Manual tracking')
  expect(landingHtml).toContain('Assisted tracking')
  expect(landingHtml).toContain('Motion model fitting')
  expect(landingHtml).toContain('No uploads')
  expect(landingHtml).toContain('No account required')
  expect(landingHtml).toContain('<h2 id="product-demo-title">See MotionLab in action</h2>')
  expect(landingHtml).toContain('poster="/demo/motionlab-demo-poster.jpg"')
  expect(landingHtml).toContain('<source src="/demo/motionlab-demo.mp4" type="video/mp4"/>')
  expect(landingHtml).toContain('preload="none"')
  expect(landingHtml).not.toContain('autoplay')

  const posterResponse = await request.head('/demo/motionlab-demo-poster.jpg')
  expect(posterResponse.ok()).toBe(true)
  expect(posterResponse.headers()['content-type']).toContain('image/jpeg')

  const videoResponse = await request.head('/demo/motionlab-demo.mp4')
  expect(videoResponse.ok()).toBe(true)
  expect(videoResponse.headers()['content-type']).toContain('video/mp4')

  const appResponse = await request.get('/app')
  expect(appResponse.ok()).toBe(true)
  const appHtml = await appResponse.text()
  expect(appHtml).toContain('<div id="root"></div>')
  expect(appHtml).not.toContain('Turn ordinary videos into measurable physics experiments.')
  expect(appHtml).not.toContain('See MotionLab in action')
})

test('root presents the public MotionLab landing page and its primary routes', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Turn ordinary videos into measurable physics experiments.' }),
  ).toBeVisible()
  await expect(
    page.getByText(
      'MotionLab is a local-first browser tool for turning ordinary videos into measurable physics experiments.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'From video to evidence in four steps.' })).toBeVisible()
  await expect(page.getByText('No uploads', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open MotionLab' }).first()).toHaveAttribute('href', '/app')
  await expect(page.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/KuzeyGorgulu/motionlab',
  )
  await expect(page.getByAltText('MotionLab Assisted Tracking following a target across video frames')).toBeVisible()
  await expect(page.getByAltText('Qzeybei')).toBeVisible()

  const demoSection = page.getByRole('region', { name: 'See MotionLab in action' })
  const demoVideo = demoSection.locator('video')
  const playButton = demoSection.getByRole('button', { name: 'Play the MotionLab product demo' })

  await expect(demoSection).toBeVisible()
  await expect(demoVideo).toHaveAttribute('preload', 'none')
  await expect(demoVideo).toHaveAttribute('poster', '/demo/motionlab-demo-poster.jpg')
  await expect(demoVideo).toHaveJSProperty('autoplay', false)
  await expect(demoVideo).toHaveJSProperty('controls', false)
  await expect(demoVideo).toHaveJSProperty('loop', false)
  await expect(demoVideo).toHaveJSProperty('muted', false)
  await expect(playButton).toBeVisible()
  await playButton.focus()
  await expect(playButton).toBeFocused()

  await playButton.click()
  await expect(demoVideo).toHaveJSProperty('controls', true)
  await expect.poll(() => demoVideo.evaluate((video: HTMLVideoElement) => video.paused)).toBe(false)
  await demoVideo.evaluate((video: HTMLVideoElement) => video.pause())

  await expect(demoSection.getByRole('link', { name: /Watch on YouTube/ })).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=guZrnA7kIt8',
  )

  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow, `landing page overflowed at ${width}px`).toBe(false)
  }

  expect(browserErrors).toEqual([])
})

test('the app route opens the existing workspace and survives a direct refresh', async ({ page }) => {
  await page.addInitScript((preferenceKey) => {
    window.localStorage.setItem(preferenceKey, 'true')
  }, ONBOARDING_PREFERENCE_KEY)

  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Load a video to open the workspace' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import video' })).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('heading', { name: 'Load a video to open the workspace' })).toBeVisible()
})
