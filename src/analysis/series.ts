import type {
  AnalysisSource,
  AnalysisTimePoint,
  GraphDataPoint,
  MotionModelFit,
  TrackKinematics,
  VisualizationGroup,
  VisualizationMode,
  VisualizationSeries,
} from './types'
import { evaluateMotionModel } from './modelFit'

const MODEL_DISPLAY_POINT_COUNT = 65

export interface VisualizationOptions {
  analysisSource?: AnalysisSource['type']
  rawAnalysis?: TrackKinematics | null
  modelFit?: MotionModelFit | null
}

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
  options: VisualizationOptions = {},
): VisualizationGroup {
  const timeline = timelineFor(analysis)
  let series: VisualizationSeries[]

  const complete = (
    partial: Omit<VisualizationGroup, 'measuredSeries' | 'modelSeries' | 'analysisSource' | 'modelType'>,
  ): VisualizationGroup => {
    const analysisSource = options.analysisSource ?? 'raw'
    const measuredSeries =
      analysisSource === 'smoothed' && options.rawAnalysis !== null && options.rawAnalysis !== undefined
        ? baseVisualizationSeries(options.rawAnalysis, mode)
        : []
    const modelSeries = options.modelFit === null || options.modelFit === undefined
      ? []
      : modelVisualizationSeries(options.modelFit, mode)
    return {
      ...partial,
      measuredSeries,
      modelSeries,
      analysisSource,
      modelType: options.modelFit?.type ?? 'none',
    }
  }

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
      return complete({
        mode,
        label: 'Position',
        axisLabel: 'Position',
        unit: analysis.positionUnit,
        timeline,
        series,
      })
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
      return complete({
        mode,
        label: 'Velocity',
        axisLabel: 'Velocity',
        unit: analysis.velocityUnit,
        timeline,
        series,
      })
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
      return complete({
        mode,
        label: 'Acceleration',
        axisLabel: 'Acceleration',
        unit: analysis.accelerationUnit,
        timeline,
        series,
      })
  }
}

function baseVisualizationSeries(
  analysis: TrackKinematics,
  mode: VisualizationMode,
): VisualizationSeries[] {
  if (mode === 'position') {
    return [
      {
        key: 'position-x',
        label: 'X',
        marker: 'circle',
        points: availablePoints(analysis, (index) => analysis.samples[index]?.position.x ?? null),
      },
      {
        key: 'position-y',
        label: 'Y',
        marker: 'square',
        points: availablePoints(analysis, (index) => analysis.samples[index]?.position.y ?? null),
      },
    ]
  }
  if (mode === 'velocity') {
    return [
      {
        key: 'velocity-x',
        label: 'vx',
        marker: 'circle',
        points: availablePoints(analysis, (index) => analysis.samples[index]?.velocity?.x ?? null),
      },
      {
        key: 'velocity-y',
        label: 'vy',
        marker: 'square',
        points: availablePoints(analysis, (index) => analysis.samples[index]?.velocity?.y ?? null),
      },
      {
        key: 'speed',
        label: 'Speed',
        marker: 'diamond',
        points: availablePoints(analysis, (index) => analysis.samples[index]?.velocity?.magnitude ?? null),
      },
    ]
  }
  return [
    {
      key: 'acceleration-x',
      label: 'ax',
      marker: 'circle',
      points: availablePoints(analysis, (index) => analysis.samples[index]?.acceleration?.x ?? null),
    },
    {
      key: 'acceleration-y',
      label: 'ay',
      marker: 'square',
      points: availablePoints(analysis, (index) => analysis.samples[index]?.acceleration?.y ?? null),
    },
    {
      key: 'acceleration',
      label: '|a|',
      marker: 'diamond',
      points: availablePoints(analysis, (index) => analysis.samples[index]?.acceleration?.magnitude ?? null),
    },
  ]
}

function modelVisualizationSeries(
  fit: MotionModelFit,
  mode: VisualizationMode,
): VisualizationSeries[] {
  const count = fit.timeSpan > 0 ? MODEL_DISPLAY_POINT_COUNT : 1
  const evaluated = Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1)
    const time = fit.t0 + ratio * fit.timeSpan
    return { time, value: evaluateMotionModel(fit, time) }
  }).filter((item) => item.value !== null)
  const points = (
    key: VisualizationSeries['key'],
    valueFor: (value: NonNullable<(typeof evaluated)[number]['value']>) => number,
  ): GraphDataPoint[] => evaluated.map((item, index) => ({
    sampleId: `model-${key}-${index}`,
    time: item.time,
    value: valueFor(item.value!),
  }))

  if (mode === 'position') {
    return [
      { key: 'position-x', label: 'X', marker: 'circle', points: points('position-x', (value) => value.position.x) },
      { key: 'position-y', label: 'Y', marker: 'square', points: points('position-y', (value) => value.position.y) },
    ]
  }
  if (mode === 'velocity') {
    return [
      { key: 'velocity-x', label: 'vx', marker: 'circle', points: points('velocity-x', (value) => value.velocity.x) },
      { key: 'velocity-y', label: 'vy', marker: 'square', points: points('velocity-y', (value) => value.velocity.y) },
      { key: 'speed', label: 'Speed', marker: 'diamond', points: points('speed', (value) => value.velocity.magnitude) },
    ]
  }
  return [
    { key: 'acceleration-x', label: 'ax', marker: 'circle', points: points('acceleration-x', (value) => value.acceleration.x) },
    { key: 'acceleration-y', label: 'ay', marker: 'square', points: points('acceleration-y', (value) => value.acceleration.y) },
    { key: 'acceleration', label: '|a|', marker: 'diamond', points: points('acceleration', (value) => value.acceleration.magnitude) },
  ]
}
