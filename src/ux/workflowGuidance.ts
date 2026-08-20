import type { Track } from '../tracking/types'

export const ANALYSIS_READY_SAMPLE_COUNT = 3

export type WorkflowStepId = 'calibration' | 'track' | 'mark' | 'analyze'
export type WorkflowStepStatus = 'complete' | 'current' | 'optional' | 'pending'

export interface WorkflowStep {
  id: WorkflowStepId
  title: string
  description: string
  status: WorkflowStepStatus
  statusLabel: string
}

export interface WorkflowGuidance {
  steps: WorkflowStep[]
  currentTask: {
    title: string
    description: string
  }
  activeSampleCount: number
  analysisReady: boolean
  completedRequiredSteps: number
}

export interface WorkflowFacts {
  videoLoaded: boolean
  hasCalibration: boolean
  tracks: readonly Track[]
  activeTrackId: string | null
}

function selectedTrack(facts: WorkflowFacts): Track | null {
  if (facts.activeTrackId !== null) {
    const active = facts.tracks.find((track) => track.id === facts.activeTrackId)
    if (active !== undefined) return active
  }
  return facts.tracks[0] ?? null
}

export function deriveWorkflowGuidance(
  facts: WorkflowFacts,
): WorkflowGuidance {
  const track = selectedTrack(facts)
  const hasTrack = track !== null
  const activeSampleCount = track?.samples.length ?? 0
  const hasSamples = activeSampleCount > 0
  const analysisReady = activeSampleCount >= ANALYSIS_READY_SAMPLE_COUNT

  const steps: WorkflowStep[] = [
    {
      id: 'calibration',
      title: 'Add a scale',
      description: facts.hasCalibration
        ? 'Physical units are ready.'
        : 'Optional — pixel analysis works without it.',
      status: facts.hasCalibration ? 'complete' : 'optional',
      statusLabel: facts.hasCalibration ? 'Done' : 'Optional',
    },
    {
      id: 'track',
      title: 'Create a track',
      description: hasTrack
        ? `${facts.tracks.length} track${facts.tracks.length === 1 ? '' : 's'} available.`
        : 'Name the object whose motion you want to measure.',
      status: hasTrack ? 'complete' : 'current',
      statusLabel: hasTrack ? 'Done' : 'Next',
    },
    {
      id: 'mark',
      title: 'Mark the object',
      description: hasSamples
        ? `${activeSampleCount} confirmed measurement${activeSampleCount === 1 ? '' : 's'}.`
        : 'Pause and place its position across the video.',
      status: hasSamples ? 'complete' : hasTrack ? 'current' : 'pending',
      statusLabel: hasSamples ? 'Done' : hasTrack ? 'Next' : 'Waiting',
    },
    {
      id: 'analyze',
      title: 'Analyze the motion',
      description: analysisReady
        ? 'Position, velocity, acceleration, smoothing, and models are available.'
        : `Add at least ${ANALYSIS_READY_SAMPLE_COUNT} measurements for useful motion analysis.`,
      status: analysisReady ? 'complete' : hasSamples ? 'current' : 'pending',
      statusLabel: analysisReady ? 'Ready' : hasSamples ? 'Keep tracking' : 'Waiting',
    },
  ]

  const currentTask = !facts.videoLoaded
    ? {
        title: 'Load a video',
        description: 'Choose a local video to begin measuring motion.',
      }
    : !hasTrack
      ? {
          title: 'Create your first track',
          description: 'Choose an object whose motion you want to measure.',
        }
      : !hasSamples
        ? {
            title: 'Mark the object',
            description: 'Pause the video and place the first measurement point.',
          }
        : !analysisReady
          ? {
              title: 'Keep tracking',
              description: `Add ${ANALYSIS_READY_SAMPLE_COUNT - activeSampleCount} more measurement${ANALYSIS_READY_SAMPLE_COUNT - activeSampleCount === 1 ? '' : 's'} across the motion.`,
            }
          : {
              title: 'Analyze motion',
              description: 'Inspect the numerical results and graph, or continue refining the track.',
            }

  return {
    steps,
    currentTask,
    activeSampleCount,
    analysisReady,
    completedRequiredSteps: [hasTrack, hasSamples, analysisReady].filter(Boolean).length,
  }
}
