import { describe, expect, it } from 'vitest'

import { createFrameReference } from '../video/frameReference'
import {
  parseMotionLabProject,
  validateMotionLabProject,
} from './schema'
import {
  createMotionLabProject,
  projectFilenameForVideo,
  serializeMotionLabProject,
} from './serialize'
import type { MotionLabProjectV1 } from './types'
import { createDefaultReportProjectState } from '../report/projectState'

function projectFixture(): MotionLabProjectV1 {
  const firstFrame = createFrameReference(0)
  const secondFrame = createFrameReference(0.1)
  return createMotionLabProject({
    videoName: 'bouncing-ball.mp4',
    metadata: { width: 1280, height: 720, duration: 4.5 },
    annotations: [
      {
        id: 'annotation-1',
        type: 'line',
        frame: firstFrame,
        a: { x: 10, y: 20 },
        b: { x: 110, y: 20 },
      },
    ],
    calibration: {
      referenceA: { x: 10, y: 20 },
      referenceB: { x: 110, y: 20 },
      knownDistance: 2,
      unit: 'm',
      origin: { x: 10, y: 20 },
      originSource: 'reference-a',
      xAxis: { x: 1, y: 0 },
      axisSource: 'reference',
    },
    tracks: [
      {
        id: 'track-1',
        name: 'Ball, “primary”',
        color: '#4ecdc4',
        samples: [
          {
            id: 'sample-1',
            time: firstFrame.anchorTime,
            frame: firstFrame,
            nativePosition: { x: 20, y: 40 },
          },
          {
            id: 'sample-2',
            time: secondFrame.anchorTime,
            frame: secondFrame,
            nativePosition: { x: 30, y: 35 },
          },
        ],
      },
    ],
    activeTrackId: 'track-1',
    trailMode: 'all',
    advanceAfterMark: true,
    analysisMode: 'velocity',
    analysisExpanded: false,
    mediaTime: 0.1,
  })
}

describe('MotionLab project schema', () => {
  it('round-trips scientifically relevant project data', () => {
    const project = projectFixture()
    const serialized = serializeMotionLabProject(project)
    expect(serialized.ok).toBe(true)
    if (!serialized.ok) return

    const parsed = parseMotionLabProject(serialized.text)
    expect(parsed).toEqual({ ok: true, project })
  })

  it('accepts project files without optional video measurements', () => {
    const project = projectFixture()
    const parsed = validateMotionLabProject({
      ...project,
      video: { name: project.video.name },
    })
    expect(parsed.ok).toBe(true)
  })

  it('restores report metadata and configuration', () => {
    const report = createDefaultReportProjectState()
    report.metadata.title = 'Pendulum period'
    report.metadata.notes = 'Compare repeated cycles.'
    report.preferences.includedGraphs = ['position-x', 'residual-magnitude']
    report.preferences.observationTableTrackIds = ['track-1']
    const project = projectFixture()
    const serialized = serializeMotionLabProject({ ...project, report })
    expect(serialized.ok).toBe(true)
    if (!serialized.ok) return
    const parsed = parseMotionLabProject(serialized.text)
    expect(parsed).toMatchObject({ ok: true, project: { report } })
  })

  it('opens pre-Phase-12 projects with default report settings', () => {
    const { report: _report, ...legacyProject } = projectFixture()
    const parsed = validateMotionLabProject(legacyProject)
    expect(parsed).toMatchObject({
      ok: true,
      project: { report: createDefaultReportProjectState() },
    })
  })

  it('rejects corrupt report references without weakening project validation', () => {
    const project = projectFixture()
    const parsed = validateMotionLabProject({
      ...project,
      report: {
        ...project.report,
        preferences: {
          ...project.report.preferences,
          excludedTrackIds: ['missing-track'],
        },
      },
    })
    expect(parsed).toMatchObject({ ok: false, code: 'invalid-schema' })
  })

  it('rejects corrupt JSON without throwing', () => {
    const parsed = parseMotionLabProject('{"format":')
    expect(parsed).toMatchObject({ ok: false, code: 'invalid-json' })
    if (parsed.ok) return
    expect(parsed.message).toMatch(/existing work is safe/i)
  })

  it('rejects a newer project version explicitly', () => {
    const parsed = validateMotionLabProject({
      ...projectFixture(),
      version: 2,
    })
    expect(parsed).toMatchObject({ ok: false, code: 'newer-version' })
  })

  it('rejects an unsupported older version', () => {
    const parsed = validateMotionLabProject({
      ...projectFixture(),
      version: 0,
    })
    expect(parsed).toMatchObject({ ok: false, code: 'unsupported-version' })
  })

  it('rejects corrupt annotation geometry', () => {
    const project = projectFixture()
    const parsed = validateMotionLabProject({
      ...project,
      annotations: [{ ...project.annotations[0], a: { x: 'bad', y: 1 } }],
    })
    expect(parsed).toMatchObject({ ok: false, code: 'invalid-schema' })
  })

  it('rejects files missing required project sections', () => {
    const { tracks: _tracks, ...missingTracks } = projectFixture()
    expect(validateMotionLabProject(missingTracks)).toMatchObject({
      ok: false,
      code: 'invalid-schema',
    })
  })

  it('rejects duplicate stable track identities', () => {
    const project = projectFixture()
    const parsed = validateMotionLabProject({
      ...project,
      tracks: [project.tracks[0], project.tracks[0]],
    })
    expect(parsed).toMatchObject({ ok: false, code: 'invalid-schema' })
  })

  it('rejects a workspace active-track reference that does not exist', () => {
    const project = projectFixture()
    const parsed = validateMotionLabProject({
      ...project,
      workspace: { ...project.workspace, activeTrackId: 'missing-track' },
    })
    expect(parsed).toMatchObject({ ok: false, code: 'invalid-schema' })
  })

  it('creates safe project filenames from source video names', () => {
    expect(projectFilenameForVideo('bouncing ball.mp4')).toBe(
      'bouncing-ball.motionlab',
    )
    expect(projectFilenameForVideo('bad:name?.mov')).toBe('bad-name-.motionlab')
  })

  it('never serializes transient assisted-tracking implementation state', () => {
    const serialized = serializeMotionLabProject(projectFixture())
    expect(serialized.ok).toBe(true)
    if (!serialized.ok) return
    expect(serialized.text).not.toMatch(
      /suggestions|diagnostics|prediction|template|worker/i,
    )
  })
})
