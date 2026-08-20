import {
  REPORT_GRAPH_TYPES,
  REPORT_SCHEMA_VERSION,
  type ReportGraphType,
  type ReportMetadata,
  type ReportProjectState,
} from './types'

const DEFAULT_INCLUDED_GRAPHS: ReportGraphType[] = [
  'position-x',
  'position-y',
  'speed',
]

const METADATA_LIMITS: Record<keyof ReportMetadata, number> = {
  title: 240,
  author: 160,
  date: 40,
  course: 160,
  instructor: 160,
  description: 4_000,
  notes: 20_000,
}

export function createDefaultReportProjectState(): ReportProjectState {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    metadata: {
      title: '',
      author: '',
      date: '',
      course: '',
      instructor: '',
      description: '',
      notes: '',
    },
    preferences: {
      excludedTrackIds: [],
      includedGraphs: [...DEFAULT_INCLUDED_GRAPHS],
      observationTableTrackIds: [],
    },
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function boundedText(value: unknown, maximumLength: number): string | null {
  return typeof value === 'string' && value.length <= maximumLength
    ? value
    : null
}

function uniqueKnownIds(value: unknown, trackIds: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(value)) return null
  const ids = value.map((item) => typeof item === 'string' ? item : null)
  if (
    ids.some((id) => id === null || !trackIds.has(id)) ||
    new Set(ids).size !== ids.length
  ) {
    return null
  }
  return ids as string[]
}

export function parseReportProjectState(
  value: unknown,
  trackIds: ReadonlySet<string>,
): ReportProjectState | null {
  const candidate = record(value)
  const metadataCandidate = record(candidate?.metadata)
  const preferencesCandidate = record(candidate?.preferences)
  if (
    candidate === null ||
    candidate.schemaVersion !== REPORT_SCHEMA_VERSION ||
    metadataCandidate === null ||
    preferencesCandidate === null
  ) {
    return null
  }

  const metadataEntries = Object.entries(METADATA_LIMITS).map(([key, limit]) => [
    key,
    boundedText(metadataCandidate[key], limit),
  ] as const)
  if (metadataEntries.some(([, text]) => text === null)) return null
  const metadata = Object.fromEntries(metadataEntries) as unknown as ReportMetadata
  if (metadata.date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) {
    return null
  }

  const excludedTrackIds = uniqueKnownIds(
    preferencesCandidate.excludedTrackIds,
    trackIds,
  )
  const observationTableTrackIds = uniqueKnownIds(
    preferencesCandidate.observationTableTrackIds,
    trackIds,
  )
  if (!Array.isArray(preferencesCandidate.includedGraphs)) return null
  const includedGraphs = preferencesCandidate.includedGraphs.map((item) =>
    typeof item === 'string' && REPORT_GRAPH_TYPES.includes(item as ReportGraphType)
      ? item as ReportGraphType
      : null,
  )
  if (
    excludedTrackIds === null ||
    observationTableTrackIds === null ||
    includedGraphs.some((item) => item === null) ||
    new Set(includedGraphs).size !== includedGraphs.length
  ) {
    return null
  }

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    metadata,
    preferences: {
      excludedTrackIds,
      includedGraphs: includedGraphs as ReportGraphType[],
      observationTableTrackIds,
    },
  }
}

export function cloneReportProjectState(state: ReportProjectState): ReportProjectState {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    metadata: { ...state.metadata },
    preferences: {
      excludedTrackIds: [...state.preferences.excludedTrackIds],
      includedGraphs: [...state.preferences.includedGraphs],
      observationTableTrackIds: [...state.preferences.observationTableTrackIds],
    },
  }
}

export function reportProjectStateForTracks(
  state: ReportProjectState,
  trackIds: ReadonlySet<string>,
): ReportProjectState {
  const cloned = cloneReportProjectState(state)
  return {
    ...cloned,
    preferences: {
      ...cloned.preferences,
      excludedTrackIds: cloned.preferences.excludedTrackIds.filter((id) => trackIds.has(id)),
      observationTableTrackIds: cloned.preferences.observationTableTrackIds.filter((id) => trackIds.has(id)),
    },
  }
}

export function hasMeaningfulReportState(state: ReportProjectState): boolean {
  const defaults = createDefaultReportProjectState()
  return (
    Object.values(state.metadata).some((value) => value.trim() !== '') ||
    state.preferences.excludedTrackIds.length > 0 ||
    state.preferences.observationTableTrackIds.length > 0 ||
    state.preferences.includedGraphs.join('|') !== defaults.preferences.includedGraphs.join('|')
  )
}
