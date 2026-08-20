import { describe, expect, it } from 'vitest'

import { createCalibration } from '../calibration/model'
import { createMotionLabProject, serializeMotionLabProject } from '../project/serialize'
import { parseMotionLabProject } from '../project/schema'
import { createTrack, createTrackSample, updateTrackSamplePosition } from '../tracking/model'
import type { Track } from '../tracking/types'
import { createFrameReference } from '../video/frameReference'
import { deriveTrackKinematics } from './kinematics'
import { fitMotionModel } from './modelFit'
import { INITIAL_ANALYSIS_PANEL_STATE, reduceAnalysisPanelState } from './panelState'
import { deriveSmoothedTrackKinematics } from './smoothing'

function fixtureTrack(): Track {
  const times = [0, 0.4, 1.1, 2, 3.2, 4.8, 6.5, 8]
  return {
    ...createTrack('track-phase-9', 'Integration', '#4ecdc4')!,
    samples: times.map((time, index) =>
      createTrackSample(
        `integration-${index}`,
        createFrameReference(time),
        {
          x: 4 + 2 * time + [1, -1, 0.6, -0.8, 1.2, -0.5, 0.7, -1][index]!,
          y: 3 + time * time,
        },
      )!,
    ),
  }
}

describe('Phase 9 analysis integration boundaries', () => {
  it('switches Raw to Smoothed without changing confirmed observations', () => {
    const track = fixtureTrack()
    const before = structuredClone(track.samples)
    const raw = deriveTrackKinematics(track, null)
    const smoothed = deriveSmoothedTrackKinematics(track, null, 5)
    expect(smoothed.ok).toBe(true)
    if (!smoothed.ok) return
    expect(smoothed.analysis.samples[3]?.position.x).not.toBe(raw.samples[3]?.position.x)
    expect(smoothed.analysis.samples.map((sample) => sample.source)).toEqual(track.samples)
    expect(track.samples).toEqual(before)
  })

  it('recomputes the derived series when the smoothing window changes', () => {
    const track = fixtureTrack()
    const five = deriveSmoothedTrackKinematics(track, null, 5)
    const nine = deriveSmoothedTrackKinematics(track, null, 9)
    expect(five.ok && nine.ok).toBe(true)
    if (!five.ok || !nine.ok) return
    expect(five.analysis.samples.map((sample) => sample.position.x)).not.toEqual(
      nine.analysis.samples.map((sample) => sample.position.x),
    )
  })

  it('reacts to calibration and reset in correct units without touching native data', () => {
    const track = fixtureTrack()
    const before = structuredClone(track.samples)
    const calibration = createCalibration({
      referenceA: { x: 0, y: 0 },
      referenceB: { x: 20, y: 0 },
      knownDistance: 1,
      unit: 'm',
    })
    if (!calibration.ok) throw new Error('fixture calibration must be valid')
    const pixel = deriveSmoothedTrackKinematics(track, null, 7)
    const world = deriveSmoothedTrackKinematics(track, calibration.calibration, 7)
    expect(pixel.ok && world.ok).toBe(true)
    if (!pixel.ok || !world.ok) return
    expect(pixel.analysis.velocityUnit).toBe('px/s')
    expect(world.analysis.velocityUnit).toBe('m/s')
    expect(world.analysis.samples[3]?.position.x).toBeCloseTo(
      pixel.analysis.samples[3]!.position.x / 20,
    )
    expect(track.samples).toEqual(before)
  })

  it('fits constant velocity and acceleration against the selected derived source', () => {
    const velocityTrack = {
      ...fixtureTrack(),
      samples: [0, 0.5, 1.7, 3, 5].map((time, index) =>
        createTrackSample(
          `velocity-${index}`,
          createFrameReference(time),
          { x: 2 + 4 * time, y: -3 * time },
        )!,
      ),
    }
    const rawVelocity = deriveTrackKinematics(velocityTrack, null)
    const velocityFit = fitMotionModel(rawVelocity, 'constant-velocity', 'raw')
    expect(velocityFit.ok).toBe(true)
    if (velocityFit.ok && velocityFit.fit.type === 'constant-velocity') {
      expect(velocityFit.fit.vx).toBeCloseTo(4)
      expect(velocityFit.fit.vy).toBeCloseTo(-3)
    }

    const accelerationTrack = {
      ...fixtureTrack(),
      samples: [0, 0.5, 1.7, 3, 5].map((time, index) =>
        createTrackSample(
          `acceleration-${index}`,
          createFrameReference(time),
          { x: 1 + 2 * time + time * time, y: -2 * time * time },
        )!,
      ),
    }
    const smoothed = deriveSmoothedTrackKinematics(accelerationTrack, null, 5)
    expect(smoothed.ok).toBe(true)
    if (!smoothed.ok) return
    const accelerationFit = fitMotionModel(
      smoothed.analysis,
      'constant-acceleration',
      'smoothed',
    )
    expect(accelerationFit.ok).toBe(true)
    if (accelerationFit.ok && accelerationFit.fit.type === 'constant-acceleration') {
      expect(accelerationFit.fit.ax).toBeCloseTo(2)
      expect(accelerationFit.fit.ay).toBeCloseTo(-4)
      expect(accelerationFit.fit.source).toBe('smoothed')
    }
  })

  it('recomputes a fit after editing and undo-style restoration of a sample', () => {
    const original = fixtureTrack()
    const beforeFit = fitMotionModel(
      deriveTrackKinematics(original, null),
      'constant-velocity',
      'raw',
    )
    const edited = updateTrackSamplePosition(original, 'integration-3', { x: 100, y: 20 })
    const editedFit = fitMotionModel(
      deriveTrackKinematics(edited, null),
      'constant-velocity',
      'raw',
    )
    const restoredFit = fitMotionModel(
      deriveTrackKinematics(original, null),
      'constant-velocity',
      'raw',
    )
    expect(editedFit).not.toEqual(beforeFit)
    expect(restoredFit).toEqual(beforeFit)
  })

  it('keeps analysis controls outside tracking history and project version 1', () => {
    const track = fixtureTrack()
    const before = structuredClone(track)
    let panel = reduceAnalysisPanelState(INITIAL_ANALYSIS_PANEL_STATE, {
      type: 'select-source',
      source: 'smoothed',
    })
    panel = reduceAnalysisPanelState(panel, { type: 'select-window', windowSize: 9 })
    panel = reduceAnalysisPanelState(panel, {
      type: 'select-model',
      model: 'constant-acceleration',
    })
    expect(track).toEqual(before)

    const project = createMotionLabProject({
      videoName: 'phase-8.webm',
      metadata: { width: 320, height: 180, duration: 8 },
      annotations: [],
      calibration: null,
      tracks: [track],
      activeTrackId: track.id,
      trailMode: 'past',
      advanceAfterMark: true,
      analysisMode: panel.mode,
      analysisExpanded: panel.expanded,
      mediaTime: 0,
    })
    const serialized = serializeMotionLabProject(project)
    expect(serialized.ok).toBe(true)
    if (!serialized.ok) return
    expect(serialized.text).not.toMatch(/smoothed|constant-acceleration|windowSize/)
    const parsed = parseMotionLabProject(serialized.text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.project.version).toBe(1)
  })
})
