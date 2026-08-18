import type {
  GraphDataPoint,
  GraphSeries,
  GraphSeriesKey,
  TrackKinematics,
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

export function selectGraphSeries(
  analysis: TrackKinematics,
  key: GraphSeriesKey,
): GraphSeries {
  switch (key) {
    case 'position-x':
      return {
        key,
        label: 'Position x',
        axisLabel: 'X',
        unit: analysis.positionUnit,
        points: availablePoints(analysis, (index) =>
          analysis.samples[index]?.position.x ?? null,
        ),
      }
    case 'position-y':
      return {
        key,
        label: 'Position y',
        axisLabel: 'Y',
        unit: analysis.positionUnit,
        points: availablePoints(analysis, (index) =>
          analysis.samples[index]?.position.y ?? null,
        ),
      }
    case 'speed':
      return {
        key,
        label: 'Speed',
        axisLabel: 'Speed',
        unit: analysis.velocityUnit,
        points: availablePoints(analysis, (index) =>
          analysis.samples[index]?.velocity?.magnitude ?? null,
        ),
      }
    case 'acceleration':
      return {
        key,
        label: 'Acceleration magnitude',
        axisLabel: '|a|',
        unit: analysis.accelerationUnit,
        points: availablePoints(analysis, (index) =>
          analysis.samples[index]?.acceleration?.magnitude ?? null,
        ),
      }
  }
}
