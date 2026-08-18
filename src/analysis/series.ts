import type {
  AnalysisTimePoint,
  GraphDataPoint,
  TrackKinematics,
  VisualizationGroup,
  VisualizationMode,
  VisualizationSeries,
} from './types'

function availablePoints(
  analysis: TrackKinematics,
  valueFor: (index: number) => number | null,
): GraphDataPoint[] {
  const points: GraphDataPoint[] = []
  for (let index = 0; index < analysis.samples.length; index += 1) {
    const value = valueFor(index)
    const sample = analysis.samples[index]
    if (sample !== undefined && value !== null && Number.isFinite(value)) {
      points.push({ sampleId: sample.source.id, time: sample.source.time, value })
    }
  }
  return points
}

function timelineFor(analysis: TrackKinematics): AnalysisTimePoint[] {
  return analysis.samples
    .filter((sample) => Number.isFinite(sample.source.time) && sample.source.time >= 0)
    .map((sample) => ({
      sampleId: sample.source.id,
      time: sample.source.time,
    }))
}

export function selectVisualizationGroup(
  analysis: TrackKinematics,
  mode: VisualizationMode,
): VisualizationGroup {
  const timeline = timelineFor(analysis)
  let series: VisualizationSeries[]

  switch (mode) {
    case 'position':
      series = [
        {
          key: 'position-x',
          label: 'X',
          marker: 'circle',
          points: availablePoints(analysis, (index) =>
            analysis.samples[index]?.position.x ?? null,
          ),
        },
        {
          key: 'position-y',
          label: 'Y',
          marker: 'square',
          points: availablePoints(analysis, (index) =>
            analysis.samples[index]?.position.y ?? null,
          ),
        },
      ]
      return {
        mode,
        label: 'Position',
        axisLabel: 'Position',
        unit: analysis.positionUnit,
        timeline,
        series,
      }
    case 'velocity':
      series = [
        {
          key: 'velocity-x',
          label: 'vx',
          marker: 'circle',
          points: availablePoints(analysis, (index) =>
            analysis.samples[index]?.velocity?.x ?? null,
          ),
        },
        {
          key: 'velocity-y',
          label: 'vy',
          marker: 'square',
          points: availablePoints(analysis, (index) =>
            analysis.samples[index]?.velocity?.y ?? null,
          ),
        },
        {
          key: 'speed',
          label: 'Speed',
          marker: 'diamond',
          points: availablePoints(analysis, (index) =>
            analysis.samples[index]?.velocity?.magnitude ?? null,
          ),
        },
      ]
      return {
        mode,
        label: 'Velocity',
        axisLabel: 'Velocity',
        unit: analysis.velocityUnit,
        timeline,
        series,
      }
    case 'acceleration':
      series = [
        {
          key: 'acceleration-x',
          label: 'ax',
          marker: 'circle',
          points: availablePoints(analysis, (index) =>
            analysis.samples[index]?.acceleration?.x ?? null,
          ),
        },
        {
          key: 'acceleration-y',
          label: 'ay',
          marker: 'square',
          points: availablePoints(analysis, (index) =>
            analysis.samples[index]?.acceleration?.y ?? null,
          ),
        },
        {
          key: 'acceleration',
          label: '|a|',
          marker: 'diamond',
          points: availablePoints(analysis, (index) =>
            analysis.samples[index]?.acceleration?.magnitude ?? null,
          ),
        },
      ]
      return {
        mode,
        label: 'Acceleration',
        axisLabel: 'Acceleration',
        unit: analysis.accelerationUnit,
        timeline,
        series,
      }
  }
}
