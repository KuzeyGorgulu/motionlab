import { describe, expect, it } from 'vitest'

import { createMotionLabProject, serializeMotionLabProject } from '../project/serialize'
import { createTrack, createTrackSample } from '../tracking/model'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import {
  ANALYSIS_READY_SAMPLE_COUNT,
  deriveWorkflowGuidance,
} from './workflowGuidance'

function trackWithSamples(count: number, id = 'track-1'): Track {
  return {
    ...createTrack(id, `Object ${id}`, '#4ecdc4')!,
    samples: Array.from({ length: count }, (_, index) => {
      const time = index * 0.1
      return createTrackSample(
        `${id}-sample-${index}`,
        createFrameReference(time),
        { x: 10 + index, y: 20 },
      )!
    }),
  }
}

describe('Getting Started workflow guidance', () => {
  it('guides a video-only workspace to create its first track', () => {
    const guidance = deriveWorkflowGuidance({
      videoLoaded: true,
      hasCalibration: false,
      tracks: [],
      activeTrackId: null,
    })
    expect(guidance.currentTask.title).toBe('Create your first track')
    expect(guidance.steps.map((step) => [step.id, step.statusLabel])).toEqual([
      ['calibration', 'Optional'],
      ['track', 'Next'],
      ['mark', 'Waiting'],
      ['analyze', 'Waiting'],
    ])
    expect(guidance.completedRequiredSteps).toBe(0)
  })

  it('marks optional calibration complete without blocking tracking', () => {
    const guidance = deriveWorkflowGuidance({
      videoLoaded: true,
      hasCalibration: true,
      tracks: [],
      activeTrackId: null,
    })
    expect(guidance.steps[0]).toMatchObject({
      id: 'calibration',
      status: 'complete',
      statusLabel: 'Done',
    })
    expect(guidance.currentTask.title).toBe('Create your first track')
  })

  it('advances a workspace with a track to marking the object', () => {
    const track = trackWithSamples(0)
    const guidance = deriveWorkflowGuidance({
      videoLoaded: true,
      hasCalibration: false,
      tracks: [track],
      activeTrackId: track.id,
    })
    expect(guidance.currentTask.title).toBe('Mark the object')
    expect(guidance.steps[1]?.status).toBe('complete')
    expect(guidance.steps[2]?.status).toBe('current')
  })

  it('asks for more observations when a track has too few samples', () => {
    const track = trackWithSamples(1)
    const guidance = deriveWorkflowGuidance({
      videoLoaded: true,
      hasCalibration: false,
      tracks: [track],
      activeTrackId: track.id,
    })
    expect(guidance.currentTask).toMatchObject({ title: 'Keep tracking' })
    expect(guidance.activeSampleCount).toBe(1)
    expect(guidance.steps[2]?.status).toBe('complete')
    expect(guidance.steps[3]).toMatchObject({
      status: 'current',
      statusLabel: 'Keep tracking',
    })
  })

  it('reports analysis ready at the tested minimum sample count', () => {
    const track = trackWithSamples(ANALYSIS_READY_SAMPLE_COUNT)
    const guidance = deriveWorkflowGuidance({
      videoLoaded: true,
      hasCalibration: false,
      tracks: [track],
      activeTrackId: track.id,
    })
    expect(guidance.analysisReady).toBe(true)
    expect(guidance.currentTask.title).toBe('Analyze motion')
    expect(guidance.steps[3]).toMatchObject({
      status: 'complete',
      statusLabel: 'Ready',
    })
    expect(guidance.completedRequiredSteps).toBe(3)
  })

  it('uses the selected track and leaves guidance/disclosure state out of project files', () => {
    const empty = trackWithSamples(0, 'empty')
    const ready = trackWithSamples(3, 'ready')
    const guidance = deriveWorkflowGuidance({
      videoLoaded: true,
      hasCalibration: false,
      tracks: [ready, empty],
      activeTrackId: empty.id,
    })
    expect(guidance.analysisReady).toBe(false)
    expect(guidance.currentTask.title).toBe('Mark the object')

    const project = createMotionLabProject({
      videoName: 'workflow.webm',
      metadata: { width: 320, height: 180, duration: 2 },
      annotations: [],
      calibration: null,
      tracks: [ready, empty],
      activeTrackId: empty.id,
      trailMode: 'past',
      advanceAfterMark: false,
      analysisMode: 'position',
      analysisExpanded: true,
      mediaTime: 0,
    })
    const serialized = serializeMotionLabProject(project)
    expect(serialized.ok).toBe(true)
    if (!serialized.ok) return
    expect(serialized.text).not.toMatch(/Getting started|currentTask|disclosure/i)
    expect(JSON.parse(serialized.text)).toMatchObject({ version: 1 })
  })
})
