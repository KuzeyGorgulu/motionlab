import {
  selectResidualVisualizationGroup,
  selectVisualizationGroup,
} from '../analysis/series'
import type {
  MotionModelFit,
  TrackKinematics,
  VisualizationGroup,
  VisualizationSeriesKey,
} from '../analysis/types'
import type { FitDiagnostics } from '../analysis/fitDiagnostics'
import {
  REPORT_GRAPH_TYPES,
  type ReportGraph,
  type ReportGraphType,
} from './types'

function singleSeriesGroup(
  group: VisualizationGroup,
  key: VisualizationSeriesKey,
  label: string,
  axisLabel: string,
): VisualizationGroup | null {
  const series = group.series.filter((item) => item.key === key)
  if (series.length === 0 || series.every((item) => item.points.length === 0)) {
    return null
  }
  return {
    ...group,
    label,
    axisLabel,
    series,
    measuredSeries: group.measuredSeries.filter((item) => item.key === key),
    modelSeries: [],
    modelType: 'none',
  }
}

export function buildReportGraphs(input: {
  analysis: TrackKinematics
  rawAnalysis: TrackKinematics
  fit: MotionModelFit | null
  diagnostics: FitDiagnostics | null
  analysisSource: 'raw' | 'smoothed'
  includedGraphs: readonly ReportGraphType[]
}): ReportGraph[] {
  const selected = new Set(input.includedGraphs)
  const graphByType = new Map<ReportGraphType, ReportGraph>()
  const motionOptions = {
    analysisSource: input.analysisSource,
    rawAnalysis: input.rawAnalysis,
    modelFit: null,
  }

  if (selected.has('position-x') || selected.has('position-y')) {
    const position = selectVisualizationGroup(input.analysis, 'position', motionOptions)
    const x = singleSeriesGroup(position, 'position-x', 'Position X vs Time', 'Position X')
    const y = singleSeriesGroup(position, 'position-y', 'Position Y vs Time', 'Position Y')
    if (selected.has('position-x') && x !== null) {
      graphByType.set('position-x', { type: 'position-x', title: x.label, group: x })
    }
    if (selected.has('position-y') && y !== null) {
      graphByType.set('position-y', { type: 'position-y', title: y.label, group: y })
    }
  }

  if (selected.has('speed')) {
    const speed = singleSeriesGroup(
      selectVisualizationGroup(input.analysis, 'velocity', motionOptions),
      'speed',
      'Speed vs Time',
      'Speed',
    )
    if (speed !== null) graphByType.set('speed', { type: 'speed', title: speed.label, group: speed })
  }

  if (selected.has('acceleration-magnitude')) {
    const acceleration = singleSeriesGroup(
      selectVisualizationGroup(input.analysis, 'acceleration', motionOptions),
      'acceleration',
      'Acceleration Magnitude vs Time',
      'Acceleration magnitude',
    )
    if (acceleration !== null) {
      graphByType.set('acceleration-magnitude', {
        type: 'acceleration-magnitude',
        title: acceleration.label,
        group: acceleration,
      })
    }
  }

  if (selected.has('observed-vs-fitted') && input.fit !== null) {
    const group = selectVisualizationGroup(input.analysis, 'position', {
      ...motionOptions,
      modelFit: input.fit,
    })
    graphByType.set('observed-vs-fitted', {
      type: 'observed-vs-fitted',
      title: 'Observed vs Fitted Position',
      group: { ...group, label: 'Observed vs Fitted Position' },
    })
  }

  if (input.diagnostics !== null) {
    const residualDefinitions = [
      ['residual-magnitude', 'residual-magnitude'],
      ['residual-x', 'residual-x'],
      ['residual-y', 'residual-y'],
    ] as const
    for (const [graphType, mode] of residualDefinitions) {
      if (!selected.has(graphType)) continue
      const group = selectResidualVisualizationGroup(input.diagnostics, mode)
      graphByType.set(graphType, { type: graphType, title: group.label, group })
    }
  }

  return REPORT_GRAPH_TYPES.flatMap((type) => {
    const graph = graphByType.get(type)
    return graph === undefined ? [] : [graph]
  })
}
