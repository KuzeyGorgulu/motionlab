import { parseMotionLabProject } from '../project/schema'
import type { MotionLabProjectV1 } from '../project/types'

export const SAMPLE_PROJECT_URL = '/examples/constant-speed.motionlab'
export const SAMPLE_VIDEO_URL = '/examples/constant-speed.webm'
export const SAMPLE_VIDEO_FILENAME = 'motionlab-constant-speed.webm'

export type BundledSampleResult =
  | { ok: true; project: MotionLabProjectV1; video: File }
  | { ok: false; message: string }

export async function loadBundledSample(): Promise<BundledSampleResult> {
  try {
    const [projectResponse, videoResponse] = await Promise.all([
      fetch(SAMPLE_PROJECT_URL),
      fetch(SAMPLE_VIDEO_URL),
    ])
    if (!projectResponse.ok || !videoResponse.ok) {
      return {
        ok: false,
        message: 'The sample experiment could not be loaded. Check the connection and try again, or import your own video.',
      }
    }
    const parsed = parseMotionLabProject(await projectResponse.text())
    if (!parsed.ok) {
      return {
        ok: false,
        message: 'The bundled sample project is unavailable or invalid. Import your own video to continue.',
      }
    }
    const videoBlob = await videoResponse.blob()
    return {
      ok: true,
      project: parsed.project,
      video: new File([videoBlob], SAMPLE_VIDEO_FILENAME, {
        type: videoBlob.type || 'video/webm',
      }),
    }
  } catch {
    return {
      ok: false,
      message: 'The sample experiment could not be loaded. Check the connection and try again, or import your own video.',
    }
  }
}
