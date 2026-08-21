import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

import { ONBOARDING_PREFERENCE_KEY } from '../src/product/preferences'

const PROJECT = {
  format: 'motionlab',
  version: 1,
  video: { name: 'synthetic.webm' },
  annotations: [],
  calibration: null,
  tracks: [
    {
      id: 'track-1',
      name: 'Restored Ball',
      color: '#4ecdc4',
      samples: [
        {
          id: 'sample-1',
          time: 0,
          frame: {
            scheme: 'timestamp-bucket-v1',
            bucketIndex: 0,
            bucketDuration: 1 / 30,
            anchorTime: 0,
          },
          nativePosition: { x: 40, y: 80 },
        },
        {
          id: 'sample-2',
          time: 0.1,
          frame: {
            scheme: 'timestamp-bucket-v1',
            bucketIndex: 3,
            bucketDuration: 1 / 30,
            anchorTime: 0.1,
          },
          nativePosition: { x: 70, y: 70 },
        },
      ],
    },
  ],
  workspace: {
    activeTrackId: 'track-1',
    trailMode: 'all',
    advanceAfterMark: true,
    analysisMode: 'velocity',
    analysisExpanded: true,
    mediaTime: 0,
  },
}

const PHASE9_PROJECT = {
  ...PROJECT,
  tracks: [
    {
      ...PROJECT.tracks[0],
      name: 'Phase 9 Motion',
      samples: [0, 0.04, 0.09, 0.15, 0.21, 0.27, 0.33].map((time, index) => ({
        id: `phase-9-sample-${index}`,
        time,
        frame: {
          scheme: 'timestamp-bucket-v1',
          bucketIndex: index * 2,
          bucketDuration: 1 / 30,
          anchorTime: time,
        },
        nativePosition: {
          x: 30 + 240 * time + [2, -1, 1.5, -2, 1, -1.5, 2][index]!,
          y: 80 - 35 * time,
        },
      })),
    },
  ],
  workspace: {
    ...PROJECT.workspace,
    analysisMode: 'position',
  },
}

const PHASE11_TIMES = [0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32]
const PHASE11_Y_OFFSETS = [-1, 0.5, -0.7, 1.1, 35, 0.8, -0.6, 0.4, -1.2]
const PHASE11_PROJECT = {
  ...PROJECT,
  tracks: [
    {
      ...PROJECT.tracks[0],
      name: 'Diagnostic Ball',
      samples: PHASE11_TIMES.map((time, index) => ({
        id: `phase-11-sample-${index}`,
        time,
        frame: {
          scheme: 'timestamp-bucket-v1',
          bucketIndex: Math.round(time / (1 / 30)),
          bucketDuration: 1 / 30,
          anchorTime: time,
        },
        nativePosition: {
          x: 40 + 400 * time,
          y: 90 + PHASE11_Y_OFFSETS[index]!,
        },
      })),
    },
  ],
  workspace: {
    ...PROJECT.workspace,
    analysisMode: 'position',
    analysisExpanded: true,
    mediaTime: 0,
  },
}

async function syntheticVideo(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const context = canvas.getContext('2d')!
    const stream = canvas.captureStream(12)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
    })
    recorder.start()
    for (let frame = 0; frame < 8; frame += 1) {
      context.fillStyle = '#101820'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#55d6be'
      context.beginPath()
      context.arc(40 + frame * 25, 90, 15, 0, Math.PI * 2)
      context.fill()
      await new Promise((resolve) => setTimeout(resolve, 45))
    }
    recorder.stop()
    await stopped
    stream.getTracks().forEach((track) => track.stop())
    const buffer = await new Blob(chunks, { type: mimeType }).arrayBuffer()
    return Array.from(new Uint8Array(buffer))
  })
  return {
    name: 'synthetic.webm',
    mimeType: 'video/webm',
    buffer: Buffer.from(bytes),
  }
}

async function openProject(page: Page, project: unknown = PROJECT) {
  await page.getByLabel('Choose MotionLab project file').setInputFiles({
    name: 'experiment.motionlab',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  })
}

async function relinkProjectVideo(page: Page) {
  const video = await syntheticVideo(page)
  await page.getByLabel('Choose video file').setInputFiles(video)
  await expect(page.getByRole('complementary', { name: 'Workspace inspector' }))
    .toBeVisible()
}

async function loadSyntheticVideo(page: Page) {
  await page.getByLabel('Choose video file').setInputFiles(await syntheticVideo(page))
  await expect(page.getByRole('complementary', { name: 'Workspace inspector' }))
    .toBeVisible()
}

async function createTrackAndMarkSamples(page: Page, count: number) {
  await page.getByLabel('New track name').fill('Guided Ball')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByLabel(/Advance after mark/).check()
  await page.getByRole('button', { name: 'Mark point (T)' }).click()
  const canvas = page.getByRole('application', {
    name: /Video measurement canvas\. Active tool: tracking-mark/,
  })
  await expect(canvas).toBeVisible()

  for (let index = 0; index < count; index += 1) {
    const previousTime = await page.getByLabel('Current timestamp').textContent()
    await canvas.click({ position: { x: 90 + index * 24, y: 90 } })
    await expect(page.locator('.track-samples__heading span')).toHaveText(String(index + 1))
    if (index < count - 1) {
      await expect(page.getByLabel('Current timestamp')).not.toHaveText(previousTime ?? '')
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((preferenceKey) => {
    window.localStorage.setItem(preferenceKey, 'true')
  }, ONBOARDING_PREFERENCE_KEY)
  await page.goto('/app')
})

test('basic experiment can load a video, create a track, and save a project', async ({
  page,
}) => {
  await loadSyntheticVideo(page)
  await expect(page.getByRole('heading', { name: 'Tracking' })).toBeVisible()
  await page.getByLabel('New track name').fill('E2E Ball')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  await page.getByText('Project', { exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save project' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('synthetic.motionlab')
  const savedPath = await download.path()
  expect(savedPath).not.toBeNull()
  const saved = JSON.parse(await readFile(savedPath!, 'utf8')) as typeof PROJECT
  expect(saved.format).toBe('motionlab')
  expect(saved.version).toBe(1)
  expect(saved.video).toMatchObject({ name: 'synthetic.webm', width: 320, height: 180 })
  expect(saved.tracks[0]?.name).toBe('E2E Ball')
})

test('project can be opened, relinked, and restored', async ({ page }) => {
  await openProject(page)
  await expect(page.getByRole('heading', { name: 'Select the original video' }))
    .toBeVisible()
  await expect(page.getByText('synthetic.webm', { exact: true })).toBeVisible()
  await relinkProjectVideo(page)
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Restored Ball' }),
  ).toBeVisible()
  const analysis = page.getByRole('region', { name: 'Motion analysis' })
  await expect(analysis.getByText(/2 valid samples/)).toBeVisible()
  await expect(analysis.getByRole('button', { name: 'Velocity', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('restored multi-tool data exports as machine-readable CSV', async ({ page }) => {
  await openProject(page)
  await relinkProjectVideo(page)
  await page.getByText('Export', { exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV data' }).click()
  const download = await downloadPromise
  const savedPath = await download.path()
  expect(savedPath).not.toBeNull()
  const csv = await readFile(savedPath!, 'utf8')
  expect(csv).toContain('track_id,track_name,sample_id,time_s')
  expect(csv).toContain('track-1,Restored Ball,sample-1,0')
  expect(csv).toContain('track-1,Restored Ball,sample-2,0.1')

  const graphDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Current graph (SVG)' }).click()
  const graphDownload = await graphDownloadPromise
  expect(graphDownload.suggestedFilename()).toMatch(/velocity\.svg$/)
  const graphPath = await graphDownload.path()
  expect(graphPath).not.toBeNull()
  const svg = await readFile(graphPath!, 'utf8')
  expect(svg).toContain('Restored Ball — Velocity')
  expect(svg).not.toMatch(/playhead|cursor/)
})

test('malformed project reports an error and preserves current state', async ({ page }) => {
  await page.getByLabel('Choose video file').setInputFiles(await syntheticVideo(page))
  await page.getByLabel('New track name').fill('Protected Track')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  await page.getByLabel('Choose MotionLab project file').setInputFiles({
    name: 'broken.motionlab',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":'),
  })

  await expect(page.getByRole('alert')).toContainText('not valid JSON')
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Protected Track' }),
  ).toBeVisible()
})

test('obvious relink mismatch warns before the project is accepted', async ({ page }) => {
  await openProject(page, {
    ...PROJECT,
    video: { name: 'different-video.mp4', width: 1920, height: 1080 },
  })
  await relinkProjectVideo(page)
  await expect(page.getByRole('alert')).toContainText(
    'This video may not match the saved project',
  )
  await expect(page.getByRole('alert')).toContainText('Filename differs')
  await expect(page.getByRole('alert')).toContainText('Resolution differs')
  await page.getByRole('button', { name: 'Use this video anyway' }).click()
  await expect(page.getByRole('alert')).not.toBeVisible()
})

test('canceling a destructive remove keeps unsaved experiment data', async ({ page }) => {
  await page.getByLabel('Choose video file').setInputFiles(await syntheticVideo(page))
  await page.getByLabel('New track name').fill('Unsaved Track')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  let confirmation = ''
  page.once('dialog', async (dialog) => {
    confirmation = dialog.message()
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Remove' }).click()
  expect(confirmation).toContain('discard unsaved work')
  await expect(page.getByText('Local source')).toBeVisible()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Unsaved Track' }),
  ).toBeVisible()
})

test('smoothing remains a reversible derived view of confirmed samples', async ({ page }) => {
  await openProject(page, PHASE9_PROJECT)
  await relinkProjectVideo(page)
  const analysis = page.getByRole('region', { name: 'Motion analysis' })

  await analysis.getByRole('button', { name: 'Smoothed', exact: true }).click()
  await expect(analysis.getByText('Raw observations are never changed.')).toBeVisible()
  await expect(analysis.getByRole('button', { name: '5', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  const legend = analysis.getByLabel('Series legend')
  await expect(legend.getByText('Measured', { exact: true })).toBeVisible()
  await expect(legend.getByText('Smoothed', { exact: true })).toBeVisible()

  await analysis.getByRole('button', { name: '7', exact: true }).click()
  await expect(analysis.getByRole('button', { name: '7', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')

  await page.getByText('Project', { exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save project' }).click()
  const download = await downloadPromise
  const savedPath = await download.path()
  expect(savedPath).not.toBeNull()
  const saved = JSON.parse(await readFile(savedPath!, 'utf8')) as typeof PHASE9_PROJECT
  expect(saved.tracks[0]?.samples).toEqual(PHASE9_PROJECT.tracks[0]?.samples)
  expect(JSON.stringify(saved)).not.toContain('smoothed')

  await analysis.getByRole('button', { name: 'Raw', exact: true }).click()
  await expect(analysis.getByRole('button', { name: 'Raw', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
})

test('motion model summary and non-interactive overlay appear for deterministic data', async ({ page }) => {
  await openProject(page, PHASE9_PROJECT)
  await relinkProjectVideo(page)
  const analysis = page.getByRole('region', { name: 'Motion analysis' })

  await analysis.getByRole('button', { name: 'Constant velocity', exact: true }).click()
  const summary = page.getByTestId('model-fit-summary')
  await expect(summary).toContainText('Constant velocity fit')
  await expect(summary).toContainText('Raw observations')
  await expect(summary).toContainText('RMSE')
  await expect(analysis.locator('.kinematics-graph__model-line')).toHaveCount(2)
  await expect(analysis.getByText('Model fit', { exact: true })).toBeVisible()
})

test('SVG export reflects smoothing and model layers without interactive chrome', async ({ page }) => {
  await openProject(page, PHASE9_PROJECT)
  await relinkProjectVideo(page)
  const analysis = page.getByRole('region', { name: 'Motion analysis' })
  await analysis.getByRole('button', { name: 'Smoothed', exact: true }).click()
  await analysis.getByRole('button', { name: 'Constant acceleration', exact: true }).click()

  await page.getByText('Export', { exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Current graph (SVG)' }).click()
  const download = await downloadPromise
  const savedPath = await download.path()
  expect(savedPath).not.toBeNull()
  const svg = await readFile(savedPath!, 'utf8')
  expect(svg).toContain('Measured')
  expect(svg).toContain('Smoothed')
  expect(svg).toContain('Model fit')
  expect(svg).toContain('stroke-dasharray="8 6"')
  expect(svg).not.toMatch(/playhead|cursor|interaction-area|point-hit/)
})

test('guided workflow progresses from a first track through manual marking', async ({ page }) => {
  await loadSyntheticVideo(page)
  const guide = page.locator('.getting-started')
  await expect(guide.getByText('Create your first track', { exact: true })).toBeVisible()
  await expect(guide.getByText('Optional', { exact: true })).toBeVisible()

  await page.getByLabel('New track name').fill('Guided Ball')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(guide.locator('.getting-started__task')).toContainText('Mark the object')

  await page.getByLabel(/Advance after mark/).check()
  await page.getByRole('button', { name: 'Mark point (T)' }).click()
  const canvas = page.getByRole('application', {
    name: /Video measurement canvas\. Active tool: tracking-mark/,
  })
  for (let index = 0; index < 3; index += 1) {
    const previousTime = await page.getByLabel('Current timestamp').textContent()
    await canvas.click({ position: { x: 90 + index * 24, y: 90 } })
    await expect(page.locator('.track-samples__heading span')).toHaveText(String(index + 1))
    if (index === 0) {
      await expect(guide.locator('.getting-started__task')).toContainText('Keep tracking')
    }
    if (index < 2) {
      await expect(page.getByLabel('Current timestamp')).not.toHaveText(previousTime ?? '')
    }
  }

  await expect(guide.locator('.getting-started__task')).toContainText('Analyze motion')
  await expect(guide.locator('.inspector__heading-row')).toContainText('3/3')
})

test('secondary inspector details are collapsed, keyboard operable, and state neutral', async ({ page }) => {
  await loadSyntheticVideo(page)
  await page.getByLabel('New track name').fill('Disclosure Track')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  const videoDetails = page.locator('details.inspector-disclosure').filter({ hasText: 'Video details' })
  const videoSummary = videoDetails.locator('summary')
  await expect(videoDetails).not.toHaveAttribute('open', '')
  await expect(videoDetails.getByText('File size', { exact: true })).not.toBeVisible()
  await videoSummary.focus()
  await videoSummary.press('Enter')
  await expect(videoDetails.getByText('File size', { exact: true })).toBeVisible()

  const timingDetails = page.locator('details.inspector-disclosure').filter({ hasText: 'Advanced timing' })
  const timingSummary = timingDetails.locator('summary')
  await expect(timingDetails.getByText(/Exact adjacent-frame access/)).not.toBeVisible()
  await timingSummary.focus()
  await timingSummary.press('Enter')
  await expect(timingDetails.getByText(/Exact adjacent-frame access/)).toBeVisible()

  const shortcutDetails = page.locator('details.inspector-disclosure').filter({ hasText: 'Keyboard shortcuts' })
  await shortcutDetails.locator('summary').click()
  await expect(shortcutDetails.getByText('Play or pause', { exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Disclosure Track' })).toBeVisible()
})

test('guided analysis exposes synchronized graphs and numerical outcomes', async ({ page }) => {
  await loadSyntheticVideo(page)
  await createTrackAndMarkSamples(page, 3)
  await expect(page.locator('.getting-started__task')).toContainText('Analyze motion')

  const analysis = page.getByRole('region', { name: 'Motion analysis' })
  await analysis.getByRole('button', { name: 'Position', exact: true }).click()
  await expect(analysis.getByRole('group', { name: /Position components against media time/ }))
    .toBeVisible()
  await expect(page.getByRole('heading', { name: 'Numerical inspector' })).toBeVisible()
  await expect(page.locator('.kinematics-track-title')).toContainText('3 valid samples')
})

test('fit diagnostics rank an intentionally displaced observation', async ({ page }) => {
  await openProject(page, PHASE11_PROJECT)
  await relinkProjectVideo(page)
  const analysis = page.getByRole('region', { name: 'Motion analysis' })
  await analysis.getByRole('button', { name: 'Constant velocity', exact: true }).click()

  const fitSummary = page.getByTestId('model-fit-summary')
  await expect(fitSummary.getByText('Fit diagnostics', { exact: true })).toBeVisible()
  await expect(fitSummary.getByText('Largest deviations', { exact: true })).toBeVisible()
  await expect(fitSummary.getByRole('button', {
    name: /00:00\.160, fit residual .* potential outlier/i,
  })).toBeVisible()
  await expect(fitSummary.getByText('Source: Raw observations', { exact: true })).toBeVisible()
})

test('largest-deviation seeking supports correction through existing Track Edit', async ({ page }) => {
  await openProject(page, PHASE11_PROJECT)
  await relinkProjectVideo(page)
  const analysis = page.getByRole('region', { name: 'Motion analysis' })
  await analysis.getByRole('button', { name: 'Constant velocity', exact: true }).click()
  const fitSummary = page.getByTestId('model-fit-summary')
  const outlierRow = fitSummary.getByRole('button', {
    name: /00:00\.160, fit residual .* potential outlier/i,
  })
  const before = Number.parseFloat(
    (await fitSummary.getByTestId('fit-max-residual').locator('dd').textContent()) ?? '',
  )
  expect(Number.isFinite(before)).toBe(true)

  await outlierRow.click()
  await expect(page.getByLabel('Current timestamp')).toHaveText('00:00.160')
  await expect(page.getByTestId('selected-fit-observation')).toContainText('00:00.160')
  const editButton = page.getByRole('button', { name: 'Edit current', exact: true })
  await expect(editButton).toBeEnabled()
  await editButton.click()

  const canvas = page.getByRole('application', {
    name: /Video measurement canvas\. Active tool: tracking-edit/,
  })
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  if (bounds === null) return
  const nativeX = 40 + 400 * 0.16
  await page.mouse.move(
    bounds.x + (nativeX / 320) * bounds.width,
    bounds.y + ((90 + PHASE11_Y_OFFSETS[4]!) / 180) * bounds.height,
  )
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + (nativeX / 320) * bounds.width,
    bounds.y + (90 / 180) * bounds.height,
    { steps: 4 },
  )
  await page.mouse.up()

  await expect.poll(async () => Number.parseFloat(
    (await fitSummary.getByTestId('fit-max-residual').locator('dd').textContent()) ?? '',
  )).toBeLessThan(before)
})

test('residual visualization exports diagnostic SVG without interactive chrome', async ({ page }) => {
  await openProject(page, PHASE11_PROJECT)
  await relinkProjectVideo(page)
  const analysis = page.getByRole('region', { name: 'Motion analysis' })
  await analysis.getByRole('button', { name: 'Constant velocity', exact: true }).click()
  await analysis.getByRole('button', { name: 'Residuals', exact: true }).click()
  await expect(analysis.getByRole('group', {
    name: /Residual magnitude against media time in px/,
  })).toBeVisible()

  await page.getByText('Export', { exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Current graph (SVG)' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/residual-magnitude\.svg$/)
  const savedPath = await download.path()
  expect(savedPath).not.toBeNull()
  const svg = await readFile(savedPath!, 'utf8')
  expect(svg).toContain('Diagnostic Ball — Residual magnitude')
  expect(svg).toContain('Fit residual (px)')
  expect(svg).toContain('Potential outlier')
  expect(svg).not.toMatch(/playhead|cursor|interaction-area|point-hit/)
})

test('experiment report edits, exports, saves, and restores report configuration', async ({ page }) => {
  await openProject(page, PHASE11_PROJECT)
  await relinkProjectVideo(page)
  const analysis = page.getByRole('region', { name: 'Motion analysis' })
  await analysis.getByRole('button', { name: 'Constant velocity', exact: true }).click()
  await page.getByRole('button', { name: 'Report', exact: true }).click()

  const report = page.getByRole('article', { name: 'Experiment report' })
  await page.getByLabel('Experiment title').fill('Ball Motion Report')
  await page.getByLabel('Author').fill('Student Scientist')
  await page.getByLabel('Discussion / Notes').fill('Interpretation remains under review.')
  await page.getByRole('group', { name: 'Included graphs' })
    .getByLabel('Residual Magnitude vs Time').check()
  await page.getByRole('group', { name: 'Observation tables' })
    .getByLabel('Diagnostic Ball').check()

  await expect(report.getByRole('heading', { name: 'Ball Motion Report' })).toBeVisible()
  await expect(report.getByRole('heading', { name: 'Model Fit' })).toBeVisible()
  await expect(report.getByRole('heading', { name: 'Potential Deviations' })).toBeVisible()
  await expect(report.getByRole('heading', { name: 'Observations' })).toBeVisible()
  await expect(report).toContainText('Interpretation remains under review.')

  const htmlDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Report · HTML' }).click()
  const htmlDownload = await htmlDownloadPromise
  expect(htmlDownload.suggestedFilename()).toBe('synthetic-experiment-report.html')
  const htmlPath = await htmlDownload.path()
  expect(htmlPath).not.toBeNull()
  const html = await readFile(htmlPath!, 'utf8')
  expect(html).toContain('Ball Motion Report')
  expect(html).toContain('Potential Deviations')
  expect(html).toContain('<svg')
  expect(html).toContain('<th>Pred. X</th>')
  expect(html).not.toMatch(/<(?:video|script|link)\b/i)

  await page.getByText('Project', { exact: true }).click()
  const projectDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save project' }).click()
  const projectDownload = await projectDownloadPromise
  const projectPath = await projectDownload.path()
  expect(projectPath).not.toBeNull()
  const saved = JSON.parse(await readFile(projectPath!, 'utf8')) as {
    report: {
      metadata: { title: string; author: string; notes: string }
      preferences: {
        includedGraphs: string[]
        observationTableTrackIds: string[]
      }
    }
  }
  expect(saved.report.metadata).toMatchObject({
    title: 'Ball Motion Report',
    author: 'Student Scientist',
    notes: 'Interpretation remains under review.',
  })
  expect(saved.report.preferences.includedGraphs).toContain('residual-magnitude')
  expect(saved.report.preferences.observationTableTrackIds).toEqual(['track-1'])

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByLabel('Choose MotionLab project file').setInputFiles(projectPath!)
  await expect(page.getByRole('heading', { name: 'Select the original video' })).toBeVisible()
  await relinkProjectVideo(page)
  await page.getByRole('button', { name: 'Report', exact: true }).click()
  await expect(page.getByLabel('Experiment title')).toHaveValue('Ball Motion Report')
  await expect(page.getByLabel('Author')).toHaveValue('Student Scientist')
  await expect(page.getByLabel('Discussion / Notes')).toHaveValue('Interpretation remains under review.')
  await expect(page.getByRole('group', { name: 'Observation tables' })
    .getByLabel('Diagnostic Ball')).toBeChecked()
})

test('report workspace exposes a clean print-only document layout', async ({ page }) => {
  await openProject(page, PHASE11_PROJECT)
  await relinkProjectVideo(page)
  await page.getByRole('button', { name: 'Report', exact: true }).click()
  await page.setViewportSize({ width: 640, height: 900 })
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true)
  await page.emulateMedia({ media: 'print' })

  await expect(page.locator('.app-header')).toBeHidden()
  await expect(page.locator('.workspace-bar')).toBeHidden()
  await expect(page.getByRole('complementary', { name: 'Report configuration' })).toBeHidden()
  const reportDocument = page.getByRole('article', { name: 'Experiment report' })
  await expect(reportDocument).toBeVisible()
  await expect(reportDocument).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true)
})
