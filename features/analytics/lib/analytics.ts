import type {
  AiChartSpec,
  AiChartType,
  AiSavedUrlRecord,
} from '@/features/ai-chat/types'

type AnalyticsMode = 'both' | 'custom' | 'domain'
type AnalyticsGroupBy =
  | 'domain'
  | 'parentCategory'
  | 'project'
  | 'projectCategory'
  | 'subCategory'
  | 'time'
type AnalyticsTimeRange = '30d' | '365d' | '7d' | '90d' | 'all' | 'custom'
type AnalyticsTimeBucket = 'day' | 'month' | 'week'
type AnalyticsSort = 'label-asc' | 'label-desc' | 'value-asc' | 'value-desc'
type AnalyticsCompareBy = 'mode' | 'none'

interface AnalyticsDateRange {
  from?: string
  to?: string
}

interface AnalyticsFilters {
  excludedDomains: string[]
  excludedParentCategories: string[]
  excludedProjectCategories: string[]
  excludedProjects: string[]
  excludedSubCategories: string[]
  includedDomains: string[]
  includedParentCategories: string[]
  includedProjectCategories: string[]
  includedProjects: string[]
  includedSubCategories: string[]
}

interface AnalyticsQuery {
  chartType: AiChartType
  compareBy: AnalyticsCompareBy
  customDateRange?: AnalyticsDateRange
  filters: AnalyticsFilters
  groupBy: AnalyticsGroupBy
  limit: number
  mode: AnalyticsMode
  normalize: boolean
  sort: AnalyticsSort
  stacked: boolean
  timeBucket: AnalyticsTimeBucket
  timeRange: AnalyticsTimeRange
  title?: string
}

interface AnalyticsPreset {
  id: string
  description: string
  isReadonly: true
  name: string
  query: AnalyticsQuery
}

interface AnalyticsResult {
  chartSpecs: AiChartSpec[]
  filteredRecordCount: number
  query: AnalyticsQuery
  summary: string
}

interface GenerateAnalyticsResultOptions {
  now?: number
}

const CHART_COLORS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']
const UNCATEGORIZED_LABEL = '未分類'
const DEFAULT_LIMIT = 8
const EMPTY_FILTERS: AnalyticsFilters = {
  excludedDomains: [],
  excludedParentCategories: [],
  excludedProjectCategories: [],
  excludedProjects: [],
  excludedSubCategories: [],
  includedDomains: [],
  includedParentCategories: [],
  includedProjectCategories: [],
  includedProjects: [],
  includedSubCategories: [],
}

const RANGE_IN_DAYS: Record<
  Exclude<AnalyticsTimeRange, 'all' | 'custom'>,
  number
> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
}

const lowerCaseSet = (values: string[]): Set<string> =>
  new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))

const getDefaultAnalyticsQuery = (): AnalyticsQuery => ({
  chartType: 'bar',
  compareBy: 'none',
  filters: {
    ...EMPTY_FILTERS,
  },
  groupBy: 'domain',
  limit: DEFAULT_LIMIT,
  mode: 'both',
  normalize: false,
  sort: 'value-desc',
  stacked: false,
  timeBucket: 'day',
  timeRange: 'all',
})

const parseLocalDateString = (value: string | undefined): number | null => {
  if (!value) {
    return null
  }

  const parts = value.split('-').map(Number)
  if (parts.length !== 3) {
    return null
  }

  return new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1).getTime()
}

const isWithinCustomDateRange = (
  savedAt: number,
  customDateRange: AnalyticsDateRange | undefined,
): boolean => {
  const from = parseLocalDateString(
    customDateRange?.from ?? customDateRange?.to,
  )
  const to = parseLocalDateString(customDateRange?.to ?? customDateRange?.from)

  if (from === null || to === null) {
    return true
  }

  const start = Math.min(from, to)
  const end = Math.max(from, to) + 24 * 60 * 60 * 1000 - 1
  return savedAt >= start && savedAt <= end
}

const matchesMode = (
  record: AiSavedUrlRecord,
  mode: AnalyticsMode,
): boolean => {
  const inDomainMode = record.savedInTabGroups.length > 0
  const inCustomMode = record.savedInProjects.length > 0

  if (mode === 'domain') {
    return inDomainMode
  }

  if (mode === 'custom') {
    return inCustomMode
  }

  return inDomainMode || inCustomMode
}

const isWithinTimeRange = (
  savedAt: number,
  customDateRange: AnalyticsDateRange | undefined,
  timeRange: AnalyticsTimeRange,
  now: number,
): boolean => {
  if (timeRange === 'all') {
    return true
  }

  if (timeRange === 'custom') {
    return isWithinCustomDateRange(savedAt, customDateRange)
  }

  return savedAt >= now - RANGE_IN_DAYS[timeRange] * 24 * 60 * 60 * 1000
}

const arrayMatchesFilters = (
  values: string[],
  included: string[],
  excluded: string[],
): boolean => {
  const normalizedValues = lowerCaseSet(
    values.length > 0 ? values : [UNCATEGORIZED_LABEL],
  )
  const includedSet = lowerCaseSet(included)
  const excludedSet = lowerCaseSet(excluded)

  if (
    includedSet.size > 0 &&
    ![...normalizedValues].some(value => includedSet.has(value))
  ) {
    return false
  }

  if ([...normalizedValues].some(value => excludedSet.has(value))) {
    return false
  }

  return true
}

const matchesFilters = (
  record: AiSavedUrlRecord,
  filters: AnalyticsFilters,
): boolean =>
  arrayMatchesFilters(
    [record.domain],
    filters.includedDomains,
    filters.excludedDomains,
  ) &&
  arrayMatchesFilters(
    record.parentCategories,
    filters.includedParentCategories,
    filters.excludedParentCategories,
  ) &&
  arrayMatchesFilters(
    record.subCategories,
    filters.includedSubCategories,
    filters.excludedSubCategories,
  ) &&
  arrayMatchesFilters(
    record.savedInProjects,
    filters.includedProjects,
    filters.excludedProjects,
  ) &&
  arrayMatchesFilters(
    record.projectCategories,
    filters.includedProjectCategories,
    filters.excludedProjectCategories,
  )

const sortEntries = (
  entries: Array<{ count: number; label: string }>,
  sort: AnalyticsSort,
) => {
  entries.sort((left, right) => {
    switch (sort) {
      case 'label-asc':
        return left.label.localeCompare(right.label, 'ja')
      case 'label-desc':
        return right.label.localeCompare(left.label, 'ja')
      case 'value-asc':
        return (
          left.count - right.count ||
          left.label.localeCompare(right.label, 'ja')
        )
      default:
        return (
          right.count - left.count ||
          left.label.localeCompare(right.label, 'ja')
        )
    }
  })
}

const formatDayBucket = (value: number): string =>
  new Date(value).toISOString().slice(0, 10)

const formatMonthBucket = (value: number): string =>
  new Date(value).toISOString().slice(0, 7)

const getWeekStart = (value: number): number => {
  const date = new Date(value)
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const day = utcDate.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  utcDate.setUTCDate(utcDate.getUTCDate() + diff)
  return utcDate.getTime()
}

const getTimeBucketLabel = (
  savedAt: number,
  bucket: AnalyticsTimeBucket,
): string => {
  if (bucket === 'month') {
    return formatMonthBucket(savedAt)
  }

  if (bucket === 'week') {
    return formatDayBucket(getWeekStart(savedAt))
  }

  return formatDayBucket(savedAt)
}

const getLabelsForGroup = (
  record: AiSavedUrlRecord,
  groupBy: AnalyticsGroupBy,
): string[] => {
  switch (groupBy) {
    case 'domain':
      return [record.domain]
    case 'parentCategory':
      return record.parentCategories.length > 0
        ? record.parentCategories
        : [UNCATEGORIZED_LABEL]
    case 'subCategory':
      return record.subCategories.length > 0
        ? record.subCategories
        : [UNCATEGORIZED_LABEL]
    case 'project':
      return record.savedInProjects.length > 0
        ? record.savedInProjects
        : [UNCATEGORIZED_LABEL]
    case 'projectCategory':
      return record.projectCategories.length > 0
        ? record.projectCategories
        : [UNCATEGORIZED_LABEL]
    case 'time':
      return [getTimeBucketLabel(record.savedAt, 'day')]
  }
}

const getSingleSeriesTitle = (groupBy: AnalyticsGroupBy): string => {
  switch (groupBy) {
    case 'domain':
      return 'ドメイン別の保存数'
    case 'parentCategory':
      return '親カテゴリ別の保存数'
    case 'subCategory':
      return '子カテゴリ別の保存数'
    case 'project':
      return 'プロジェクト別の保存数'
    case 'projectCategory':
      return 'プロジェクトカテゴリ別の保存数'
    case 'time':
      return '日別の保存推移'
  }
}

const getTimeTitle = (bucket: AnalyticsTimeBucket): string => {
  switch (bucket) {
    case 'week':
      return '週別の保存推移'
    case 'month':
      return '月別の保存推移'
    default:
      return '日別の保存推移'
  }
}

const getNormalizedCount = (count: number, total: number): number => {
  if (total === 0) {
    return 0
  }

  return Math.round((count / total) * 100)
}

const createSingleSeriesChart = (
  filteredRecords: AiSavedUrlRecord[],
  query: AnalyticsQuery,
): AiChartSpec => {
  const bucketMap = new Map<string, number>()

  for (const record of filteredRecords) {
    const labels =
      query.groupBy === 'time'
        ? [getTimeBucketLabel(record.savedAt, query.timeBucket)]
        : getLabelsForGroup(record, query.groupBy)

    for (const label of labels) {
      bucketMap.set(label, (bucketMap.get(label) ?? 0) + 1)
    }
  }

  const entries = [...bucketMap.entries()].map(([label, count]) => ({
    count,
    label,
  }))
  sortEntries(entries, query.groupBy === 'time' ? 'label-asc' : query.sort)

  const limitedEntries =
    query.groupBy === 'time' ? entries : entries.slice(0, query.limit)
  const total = limitedEntries.reduce((sum, entry) => sum + entry.count, 0)
  const data = limitedEntries.map(entry => ({
    count: query.normalize
      ? getNormalizedCount(entry.count, total)
      : entry.count,
    label: entry.label,
  }))

  return {
    categoryKey: 'label',
    data,
    description: `${filteredRecords.length} 件の保存データを集計`,
    showLegend: query.chartType !== 'pie',
    series: [
      {
        colorToken: CHART_COLORS[0],
        dataKey: 'count',
        label: query.normalize ? '構成比' : '保存数',
      },
    ],
    stacked: query.stacked,
    title:
      query.title ??
      (query.groupBy === 'time'
        ? getTimeTitle(query.timeBucket)
        : getSingleSeriesTitle(query.groupBy)),
    type: query.chartType,
    valueFormat: query.normalize ? 'percent' : 'count',
    xKey: query.chartType === 'pie' ? undefined : 'label',
  }
}

const createModeComparisonChart = (
  filteredRecords: AiSavedUrlRecord[],
  query: AnalyticsQuery,
): AiChartSpec => {
  const labels =
    query.groupBy === 'time'
      ? [
          ...new Set(
            filteredRecords.map(record =>
              getTimeBucketLabel(record.savedAt, query.timeBucket),
            ),
          ),
        ].sort()
      : []
  const buckets = new Map<
    string,
    {
      custom: number
      domain: number
    }
  >()

  for (const label of labels) {
    buckets.set(label, {
      custom: 0,
      domain: 0,
    })
  }

  for (const record of filteredRecords) {
    const label =
      query.groupBy === 'time'
        ? getTimeBucketLabel(record.savedAt, query.timeBucket)
        : record.domain
    const current = buckets.get(label) ?? {
      custom: 0,
      domain: 0,
    }

    if (record.savedInTabGroups.length > 0) {
      current.domain += 1
    }

    if (record.savedInProjects.length > 0) {
      current.custom += 1
    }

    buckets.set(label, current)
  }

  const rawData = [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ja'))
    .map(([label, counts]) => ({
      ...counts,
      label,
    }))
  const data = query.normalize
    ? rawData.map(entry => {
        const total = entry.domain + entry.custom
        return {
          custom: getNormalizedCount(entry.custom, total),
          domain: getNormalizedCount(entry.domain, total),
          label: entry.label,
        }
      })
    : rawData

  return {
    data,
    description: `${filteredRecords.length} 件の保存データをモード比較`,
    series: [
      {
        colorToken: CHART_COLORS[0],
        dataKey: 'domain',
        label: 'ドメインモード',
      },
      {
        colorToken: CHART_COLORS[1],
        dataKey: 'custom',
        label: 'カスタムモード',
      },
    ],
    stacked: query.stacked,
    title: query.title ?? getTimeTitle(query.timeBucket),
    type: query.chartType,
    valueFormat: query.normalize ? 'percent' : 'count',
    xKey: query.chartType === 'pie' ? undefined : 'label',
  }
}

const generateAnalyticsResult = (
  records: AiSavedUrlRecord[],
  query: AnalyticsQuery,
  options: GenerateAnalyticsResultOptions = {},
): AnalyticsResult => {
  const now = options.now ?? Date.now()
  const filteredRecords = records.filter(
    record =>
      matchesMode(record, query.mode) &&
      isWithinTimeRange(
        record.savedAt,
        query.customDateRange,
        query.timeRange,
        now,
      ) &&
      matchesFilters(record, query.filters),
  )

  const chartSpec =
    query.compareBy === 'mode'
      ? createModeComparisonChart(filteredRecords, query)
      : createSingleSeriesChart(filteredRecords, query)

  return {
    chartSpecs: [chartSpec],
    filteredRecordCount: filteredRecords.length,
    query,
    summary: `${filteredRecords.length} 件の保存データから ${chartSpec.title} を作成しました。`,
  }
}

const getAnalyticsPresets = (): AnalyticsPreset[] => [
  {
    description: '直近30日でよく保存しているドメインを見る',
    id: 'top-domains-30d',
    isReadonly: true,
    name: 'トップドメイン',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'bar',
      groupBy: 'domain',
      mode: 'domain',
      timeRange: '30d',
    },
  },
  {
    description: '直近30日の保存推移を見る',
    id: 'daily-trend-30d',
    isReadonly: true,
    name: '30日推移',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'line',
      groupBy: 'time',
      timeBucket: 'day',
      timeRange: '30d',
    },
  },
  {
    description: '月別の保存増減を見る',
    id: 'monthly-trend',
    isReadonly: true,
    name: '月別推移',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'area',
      groupBy: 'time',
      timeBucket: 'month',
      timeRange: '365d',
    },
  },
  {
    description: '親カテゴリの偏りを見る',
    id: 'top-parent-categories',
    isReadonly: true,
    name: '親カテゴリ構成',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'pie',
      groupBy: 'parentCategory',
      mode: 'domain',
      normalize: true,
    },
  },
  {
    description: 'カスタムプロジェクトの偏りを見る',
    id: 'top-projects',
    isReadonly: true,
    name: 'プロジェクト別保存数',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'bar',
      groupBy: 'project',
      mode: 'custom',
    },
  },
  {
    description: '子カテゴリの偏りを見る',
    id: 'top-sub-categories',
    isReadonly: true,
    name: '子カテゴリ別保存数',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'bar',
      groupBy: 'subCategory',
      mode: 'domain',
    },
  },
  {
    description: 'プロジェクトカテゴリの偏りを見る',
    id: 'top-project-categories',
    isReadonly: true,
    name: 'プロジェクトカテゴリ別保存数',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'bar',
      groupBy: 'projectCategory',
      mode: 'custom',
    },
  },
  {
    description: '直近7日の変化を素早く見る',
    id: 'daily-trend-7d',
    isReadonly: true,
    name: '7日推移',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'line',
      groupBy: 'time',
      timeBucket: 'day',
      timeRange: '7d',
    },
  },
  {
    description: 'カスタムモードの月別推移を見る',
    id: 'custom-monthly-trend',
    isReadonly: true,
    name: 'カスタム月別推移',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'area',
      groupBy: 'time',
      mode: 'custom',
      timeBucket: 'month',
      timeRange: '365d',
    },
  },
  {
    description: 'ドメインモードとカスタムモードの比較を見る',
    id: 'mode-comparison-30d',
    isReadonly: true,
    name: 'モード比較',
    query: {
      ...getDefaultAnalyticsQuery(),
      chartType: 'line',
      compareBy: 'mode',
      groupBy: 'time',
      mode: 'both',
      timeBucket: 'day',
      timeRange: '30d',
    },
  },
]

export type {
  AnalyticsCompareBy,
  AnalyticsDateRange,
  AnalyticsFilters,
  AnalyticsGroupBy,
  AnalyticsMode,
  AnalyticsPreset,
  AnalyticsQuery,
  AnalyticsResult,
  AnalyticsSort,
  AnalyticsTimeBucket,
  AnalyticsTimeRange,
}
export {
  UNCATEGORIZED_LABEL,
  generateAnalyticsResult,
  getAnalyticsPresets,
  getDefaultAnalyticsQuery,
}
