import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(scriptDirectory, '../public/examples/constant-speed.webm')
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage()
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('Canvas 2D context is unavailable.')

    const stream = canvas.captureStream(10)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    const stopped = new Promise((resolveStopped) => {
      recorder.onstop = resolveStopped
    })

    const drawFrame = (time) => {
      context.fillStyle = '#0c1114'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.strokeStyle = '#1c2a2e'
      context.lineWidth = 1
      for (let x = 20; x < canvas.width; x += 20) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, canvas.height)
        context.stroke()
      }
      for (let y = 10; y < canvas.height; y += 20) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(canvas.width, y)
        context.stroke()
      }

      const x = 40 + 70 * time
      context.fillStyle = '#55d6be'
      context.beginPath()
      context.arc(x, 90, 11, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = '#d7fff7'
      context.lineWidth = 2
      context.stroke()
    }

    drawFrame(0)
    recorder.start(250)
    for (let frame = 0; frame <= 30; frame += 1) {
      drawFrame(frame / 10)
      await new Promise((resolveFrame) => window.setTimeout(resolveFrame, 100))
    }
    recorder.stop()
    await stopped
    stream.getTracks().forEach((track) => track.stop())
    const buffer = await new Blob(chunks, { type: mimeType }).arrayBuffer()
    return Array.from(new Uint8Array(buffer))
  })

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, Buffer.from(result))
  console.log(`Wrote ${result.length} bytes to ${outputPath}`)
} finally {
  await browser.close()
}
