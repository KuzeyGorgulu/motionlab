import { describe, expect, it } from 'vitest'

import sampleProjectText from '../../public/examples/constant-speed.motionlab?raw'
import { parseMotionLabProject } from '../project/schema'
import { SAMPLE_VIDEO_FILENAME } from './sample'

describe('bundled sample experience', () => {
  it('is a normal valid project with calibrated deterministic observations', () => {
    const parsed = parseMotionLabProject(sampleProjectText)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.project.video.name).toBe(SAMPLE_VIDEO_FILENAME)
    expect(parsed.project.calibration).toMatchObject({ knownDistance: 1, unit: 'm' })
    expect(parsed.project.tracks).toHaveLength(1)
    expect(parsed.project.tracks[0]?.samples).toHaveLength(9)
    expect(parsed.project.report.metadata.title).toBe('Constant-Speed Motion')
  })

  it('keeps video bytes outside the project format', () => {
    expect(sampleProjectText).not.toContain('data:video')
    expect(sampleProjectText.length).toBeLessThan(20_000)
  })
})
