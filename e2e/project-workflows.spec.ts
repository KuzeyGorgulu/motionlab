import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

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

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('basic experiment can load a video, create a track, and save a project', async ({
  page,
}) => {
  await page.getByLabel('Choose video file').setInputFiles(await syntheticVideo(page))
  await expect(page.getByRole('heading', { name: 'Manual tracking' })).toBeVisible()
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
