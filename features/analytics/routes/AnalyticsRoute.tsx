import { ExternalLink, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  type AiChartPointSelection,
  AiChartRenderer,
} from '@/features/ai-chat/components/AiChartRenderer'
import { SavedTabsChatWidget } from '@/features/ai-chat/components/SavedTabsChatWidget'
import { useSharedAiChatHistory } from '@/features/ai-chat/hooks/useSharedAiChatHistory'
import type {
  AiChartSpec,
  AiChatConversationMessage,
  AiSavedUrlRecord,
} from '@/features/ai-chat/types'
import {
  type AnalyticsQuery,
  filterAnalyticsRecords,
  generateAnalyticsResult,
  getDefaultAnalyticsQuery,
  normalizeAnalyticsQuery,
} from '@/features/analytics/lib/analytics'
import { loadAnalyticsRecords } from '@/features/analytics/lib/loadAnalyticsRecords'
import { useI18n } from '@/features/i18n/context/I18nProvider'
import {
  type SavedAnalyticsView,
  createSavedAnalyticsView,
  deleteSavedAnalyticsView,
  loadSavedAnalyticsViews,
  saveSavedAnalyticsViews,
} from '@/lib/storage/analytics'
import { defaultSettings, getUserSettings } from '@/lib/storage/settings'
import type { AiChatToolTrace } from '@/types/background'

const defaultAnalyticsQuery = getDefaultAnalyticsQuery()

const isAnalyticsQuery = (value: unknown): value is AnalyticsQuery => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const query = value as Partial<AnalyticsQuery>
  return (
    typeof query.chartType === 'string' &&
    typeof query.groupBy === 'string' &&
    typeof query.mode === 'string'
  )
}

const getLatestAnalyticsQuery = (
  toolTraces: AiChatToolTrace[] | undefined,
): AnalyticsQuery | null => {
  if (!toolTraces) {
    return null
  }

  for (const toolTrace of [...toolTraces].reverse()) {
    if (toolTrace.toolName !== 'generateSavedTabsAnalytics') {
      continue
    }

    const output =
      toolTrace.output && typeof toolTrace.output === 'object'
        ? (toolTrace.output as Record<string, unknown>)
        : null
    if (!output) {
      continue
    }

    const query = output.query
    if (isAnalyticsQuery(query)) {
      return query
    }
  }

  return null
}

const getLatestAssistantCharts = (
  messages: AiChatConversationMessage[],
): {
  charts: AiChartSpec[]
  query: AnalyticsQuery | null
} | null => {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant' || !message.charts?.length) {
      continue
    }

    return {
      charts: message.charts,
      query: getLatestAnalyticsQuery(message.toolTraces),
    }
  }

  return null
}

const awaitableEmptyRecords: Awaited<ReturnType<typeof loadAnalyticsRecords>> =
  []

const removeUrlFromStorage = async (url: string): Promise<void> =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'removeUrlFromStorage',
        url,
      },
      (response?: { error?: string; status?: string }) => {
        if (response?.status === 'removed') {
          resolve()
          return
        }

        reject(new Error(response?.error || 'removeUrlFromStorage failed'))
      },
    )
  })

const normalizeAnalyticsRouteQuery = (
  analyticsQuery: AnalyticsQuery,
): AnalyticsQuery => ({
  ...normalizeAnalyticsQuery(analyticsQuery),
  mode: 'both',
})

interface AnalyticsDrilldownSelection {
  label: string
  matchingRecords: AiSavedUrlRecord[]
  seriesKey?: string
  specTitle: string
}

type AnalyticsChartMessages = NonNullable<
  Parameters<typeof generateAnalyticsResult>[2]
>['messages']

const getDrilldownLabelsForRecord = (
  record: AiSavedUrlRecord,
  query: AnalyticsQuery,
  uncategorizedLabel: string,
  chartMessages: AnalyticsChartMessages,
): string[] => {
  switch (query.groupBy) {
    case 'timeRecent':
    case 'timeTop':
      return (
        generateAnalyticsResult(
          [record],
          {
            ...query,
            compareBy: 'none',
          },
          { messages: chartMessages },
        )
          .chartSpecs[0]?.data.map(datum => String(datum.label ?? ''))
          .filter(Boolean) ?? []
      )
    case 'parentCategory':
      return record.parentCategories.length > 0
        ? record.parentCategories
        : [uncategorizedLabel]
    case 'subCategory':
      return record.subCategories.length > 0
        ? record.subCategories
        : [uncategorizedLabel]
    case 'project':
      return record.savedInProjects.length > 0
        ? record.savedInProjects
        : [uncategorizedLabel]
    case 'projectCategory':
      return record.projectCategories.length > 0
        ? record.projectCategories
        : [uncategorizedLabel]
    default:
      return [record.domain]
  }
}

const matchesDrilldownMode = ({
  record,
  query,
  seriesKey,
}: {
  record: AiSavedUrlRecord
  query: AnalyticsQuery
  seriesKey?: string
}): boolean => {
  if (query.compareBy !== 'mode' || !seriesKey) {
    return true
  }

  if (seriesKey === 'domain') {
    return record.savedInTabGroups.length > 0
  }

  if (seriesKey === 'custom') {
    return record.savedInProjects.length > 0
  }

  return true
}

const matchesDrilldownLabel = ({
  label,
  query,
  record,
  seriesKey,
  uncategorizedLabel,
  chartMessages,
}: {
  label: string
  query: AnalyticsQuery
  record: AiSavedUrlRecord
  seriesKey?: string
  uncategorizedLabel: string
  chartMessages: AnalyticsChartMessages
}): boolean => {
  const normalizedLabel = label.trim().toLowerCase()
  if (!normalizedLabel) {
    return false
  }

  if (!matchesDrilldownMode({ record, query, seriesKey })) {
    return false
  }

  return getDrilldownLabelsForRecord(
    record,
    query,
    uncategorizedLabel,
    chartMessages,
  ).some(value => value.toLowerCase() === normalizedLabel)
}

const AnalyticsRoute = () => {
  const { language, t } = useI18n()
  const {
    activeConversation,
    createConversation,
    deleteConversation,
    historyItems,
    selectConversation,
    updateMessages,
  } = useSharedAiChatHistory()
  const [records, setRecords] = useState(awaitableEmptyRecords)
  const [savedViews, setSavedViews] = useState<SavedAnalyticsView[]>([])
  const [settings, setSettings] = useState(defaultSettings)
  const [query, setQuery] = useState<AnalyticsQuery>(() =>
    normalizeAnalyticsRouteQuery(defaultAnalyticsQuery),
  )
  const [viewName, setViewName] = useState('')
  const [summary, setSummary] = useState('')
  const [generatedChartSpecs, setGeneratedChartSpecs] = useState<AiChartSpec[]>(
    [],
  )
  const [aiChartSpecs, setAiChartSpecs] = useState<AiChartSpec[]>([])
  const [drilldownSelection, setDrilldownSelection] =
    useState<AnalyticsDrilldownSelection | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AiSavedUrlRecord | null>(
    null,
  )
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)
  const [isUsingAiCharts, setIsUsingAiCharts] = useState(false)
  const chartMessages = useMemo<AnalyticsChartMessages>(
    () => ({
      chartDailySavedTrend: t('analytics.chart.dailySavedTrend'),
      chartDescriptionAggregated: t('analytics.chart.descriptionAggregated'),
      chartDescriptionCompareMode: t('analytics.chart.descriptionCompareMode'),
      chartMonthlySavedTrend: t('analytics.chart.monthlySavedTrend'),
      chartSavedCountByDomain: t('analytics.chart.savedCountByDomain'),
      chartSavedCountByParentCategory: t(
        'analytics.chart.savedCountByParentCategory',
      ),
      chartSavedCountByProject: t('analytics.chart.savedCountByProject'),
      chartSavedCountByProjectCategory: t(
        'analytics.chart.savedCountByProjectCategory',
      ),
      chartSavedCountBySubCategory: t(
        'analytics.chart.savedCountBySubCategory',
      ),
      chartSeriesCustomMode: t('analytics.chart.seriesCustomMode'),
      chartSeriesDomainMode: t('analytics.chart.seriesDomainMode'),
      chartSeriesSavedCount: t('analytics.chart.seriesSavedCount'),
      chartSeriesShare: t('analytics.chart.seriesShare'),
      chartSummary: t('analytics.summary'),
      chartWeeklySavedTrend: t('analytics.chart.weeklySavedTrend'),
      uncategorizedLabel: t('analytics.uncategorized'),
    }),
    [language],
  )
  const analyticsGroupByOptions = [
    { label: t('analytics.groupBy.domain'), value: 'domain' },
    { label: t('analytics.groupBy.timeRecent'), value: 'timeRecent' },
    { label: t('analytics.groupBy.timeTop'), value: 'timeTop' },
    { label: t('analytics.groupBy.parentCategory'), value: 'parentCategory' },
    { label: t('analytics.groupBy.subCategory'), value: 'subCategory' },
    { label: t('analytics.groupBy.project'), value: 'project' },
  ] as const satisfies ReadonlyArray<{
    label: string
    value: AnalyticsQuery['groupBy']
  }>
  const analyticsChartTypeOptions = [
    { label: t('analytics.chartType.bar'), value: 'bar' },
    { label: t('analytics.chartType.line'), value: 'line' },
    { label: t('analytics.chartType.area'), value: 'area' },
    { label: t('analytics.chartType.pie'), value: 'pie' },
    { label: t('analytics.chartType.radar'), value: 'radar' },
  ] as const satisfies ReadonlyArray<{
    label: string
    value: AnalyticsQuery['chartType']
  }>

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      loadAnalyticsRecords(),
      loadSavedAnalyticsViews(),
      getUserSettings(),
    ]).then(([nextRecords, nextSavedViews, nextSettings]) => {
      if (cancelled) {
        return
      }

      setRecords(nextRecords)
      setSavedViews(nextSavedViews)
      setSettings(nextSettings)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const result = generateAnalyticsResult(records, query, {
      messages: chartMessages,
    })
    setGeneratedChartSpecs(result.chartSpecs)
    setSummary(result.summary)
  }, [chartMessages, query, records])

  const filteredRecords = useMemo(
    () =>
      filterAnalyticsRecords(records, query, {
        messages: chartMessages,
      }),
    [chartMessages, query, records],
  )

  const applyQuery = (nextQuery: AnalyticsQuery, nextViewName?: string) => {
    setIsUsingAiCharts(false)
    setAiChartSpecs([])
    setDrilldownSelection(null)
    setQuery(normalizeAnalyticsRouteQuery(nextQuery))
    if (nextViewName) {
      setViewName(nextViewName)
    }
  }

  const handleSaveView = async () => {
    const trimmedName = viewName.trim()
    if (!trimmedName) {
      return
    }

    const nextView = createSavedAnalyticsView({
      name: trimmedName,
      query,
    })
    const nextViews = [...savedViews, nextView]
    setSavedViews(nextViews)
    await saveSavedAnalyticsViews(nextViews)
  }

  const handleDeleteView = async (viewId: string) => {
    const nextViews = savedViews.filter(view => view.id !== viewId)
    setSavedViews(nextViews)
    await deleteSavedAnalyticsView(viewId)
  }

  const handleMessagesChange = (messages: AiChatConversationMessage[]) => {
    updateMessages(messages)

    const latestAssistantCharts = getLatestAssistantCharts(messages)
    if (!latestAssistantCharts) {
      return
    }

    if (latestAssistantCharts.query) {
      setQuery(normalizeAnalyticsRouteQuery(latestAssistantCharts.query))
    }
    setIsUsingAiCharts(true)
    setAiChartSpecs(latestAssistantCharts.charts)
    setDrilldownSelection(null)
    setSummary(t('analytics.aiSummary'))
  }

  const handleChartPointClick = ({
    label,
    seriesKey,
    spec,
  }: AiChartPointSelection) => {
    const matchingRecords = filteredRecords.filter(record =>
      matchesDrilldownLabel({
        label,
        query,
        record,
        seriesKey,
        chartMessages,
        uncategorizedLabel: t('analytics.uncategorized'),
      }),
    )

    setDrilldownSelection({
      label,
      matchingRecords,
      seriesKey,
      specTitle: spec.title,
    })
  }

  const refreshRecords = async () => {
    const nextRecords = await loadAnalyticsRecords()
    setRecords(nextRecords)
    return nextRecords
  }

  const rebuildDrilldownSelection = (nextRecords: AiSavedUrlRecord[]) => {
    setDrilldownSelection(currentSelection => {
      if (!currentSelection) {
        return null
      }

      return {
        ...currentSelection,
        matchingRecords: filterAnalyticsRecords(nextRecords, query, {
          messages: chartMessages,
        }).filter(record =>
          matchesDrilldownLabel({
            label: currentSelection.label,
            query,
            record,
            seriesKey: currentSelection.seriesKey,
            chartMessages,
            uncategorizedLabel: t('analytics.uncategorized'),
          }),
        ),
      }
    })
  }

  const performDelete = async (record: AiSavedUrlRecord) => {
    if (deletingUrl) {
      return
    }

    try {
      setDeletingUrl(record.url)
      await removeUrlFromStorage(record.url)
      const nextRecords = await refreshRecords()
      rebuildDrilldownSelection(nextRecords)
    } catch (error) {
      console.error('Failed to delete analytics drilldown url:', error)
    } finally {
      setDeletingUrl(null)
      setDeleteTarget(null)
    }
  }

  const handleDeleteClick = (record: AiSavedUrlRecord) => {
    if (deletingUrl) {
      return
    }

    if (settings.confirmDeleteEach) {
      setDeleteTarget(record)
      return
    }

    void performDelete(record)
  }

  return (
    <div
      className='flex h-screen min-h-0 min-w-0 items-stretch overflow-hidden bg-background'
      data-testid='analytics-page-layout'
    >
      <main className='min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/10 p-4'>
        <div className='mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4'>
          <section className='grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] gap-4'>
            <aside
              className='min-h-0'
              data-testid='analytics-sidebar-pane-container'
            >
              <ScrollArea
                className='h-full overflow-y-auto overscroll-contain'
                data-testid='analytics-sidebar-pane'
              >
                <div className='space-y-4 pr-3'>
                  <Card className='rounded-3xl border-border p-5 shadow-none'>
                    <CardHeader className='gap-1 p-0'>
                      <CardTitle className='text-lg'>
                        {t('analytics.conditionsTitle')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='mt-4 grid gap-3 p-0'>
                      <div className='grid gap-1.5'>
                        <Label
                          className='text-sm'
                          htmlFor='analytics-view-name'
                        >
                          {t('analytics.viewName')}
                        </Label>
                        <Input
                          aria-label={t('analytics.viewName')}
                          className='rounded-xl bg-background'
                          id='analytics-view-name'
                          onChange={event => setViewName(event.target.value)}
                          value={viewName}
                        />
                      </div>
                      <div className='grid gap-1.5'>
                        <Label className='text-sm' htmlFor='analytics-group-by'>
                          {t('analytics.groupByLabel')}
                        </Label>
                        <Select
                          onValueChange={value =>
                            applyQuery({
                              ...query,
                              groupBy: value as AnalyticsQuery['groupBy'],
                            })
                          }
                          value={query.groupBy}
                        >
                          <SelectTrigger
                            aria-label={t('analytics.groupByLabel')}
                            className='rounded-xl bg-background'
                            id='analytics-group-by'
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {analyticsGroupByOptions.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='grid gap-1.5'>
                        <Label
                          className='text-sm'
                          htmlFor='analytics-chart-type'
                        >
                          {t('analytics.chartTypeLabel')}
                        </Label>
                        <Select
                          onValueChange={value =>
                            applyQuery({
                              ...query,
                              chartType: value as AnalyticsQuery['chartType'],
                            })
                          }
                          value={query.chartType}
                        >
                          <SelectTrigger
                            aria-label={t('analytics.chartTypeLabel')}
                            className='rounded-xl bg-background'
                            id='analytics-chart-type'
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {analyticsChartTypeOptions.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='grid gap-1.5'>
                        <Label className='text-sm' htmlFor='analytics-limit'>
                          {t('analytics.limitLabel')}
                        </Label>
                        <Input
                          aria-label={t('analytics.limitLabel')}
                          className='rounded-xl bg-background'
                          id='analytics-limit'
                          min={1}
                          onChange={event =>
                            applyQuery({
                              ...query,
                              limit: Math.max(
                                1,
                                Number(event.target.value) || 1,
                              ),
                            })
                          }
                          type='number'
                          value={query.limit}
                        />
                      </div>
                    </CardContent>
                    <div className='mt-4 grid grid-cols-2 gap-2'>
                      <Button
                        className='w-full cursor-pointer rounded-xl'
                        onClick={handleSaveView}
                        type='button'
                      >
                        {t('analytics.saveView')}
                      </Button>
                      <Button
                        className='w-full cursor-pointer rounded-xl'
                        onClick={() => applyQuery(defaultAnalyticsQuery)}
                        type='button'
                        variant='outline'
                      >
                        {t('common.reset')}
                      </Button>
                    </div>
                  </Card>

                  <Card className='rounded-3xl border-border p-5 shadow-none'>
                    <CardHeader className='gap-1 p-0'>
                      <CardTitle className='text-lg'>
                        {t('analytics.savedViewsTitle')}
                      </CardTitle>
                      <CardDescription>
                        {t('analytics.savedViewsDescription')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='mt-4 p-0'>
                      {savedViews.length === 0 ? (
                        <p className='text-muted-foreground text-sm'>
                          {t('analytics.savedViewsEmpty')}
                        </p>
                      ) : (
                        <div className='space-y-2'>
                          {savedViews.map(view => (
                            <Card
                              className='rounded-2xl border-border p-3 shadow-none'
                              key={view.id}
                            >
                              <div className='flex items-center justify-between gap-2'>
                                <Button
                                  className='min-w-0 flex-1 justify-start px-0 text-left hover:bg-transparent'
                                  onClick={() =>
                                    applyQuery(view.query, view.name)
                                  }
                                  type='button'
                                  variant='ghost'
                                >
                                  <span className='truncate font-medium text-sm'>
                                    {view.name}
                                  </span>
                                </Button>
                                <Button
                                  aria-label={t(
                                    'analytics.deleteViewAria',
                                    undefined,
                                    { name: view.name },
                                  )}
                                  className='cursor-pointer rounded-lg'
                                  onClick={() => void handleDeleteView(view.id)}
                                  size='sm'
                                  type='button'
                                  variant='outline'
                                >
                                  {t('common.delete')}
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </aside>

            <ScrollArea
              className='min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card shadow-none'
              data-testid='analytics-canvas-pane'
            >
              <div className='p-5'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <h2 className='font-semibold text-lg'>
                      {t('analytics.canvasTitle')}
                    </h2>
                    <p className='mt-1 text-muted-foreground text-sm'>
                      {summary}
                    </p>
                  </div>
                </div>
                <div
                  className='-top-5 z-10 -mx-5 bg-card/95 px-5 pt-5 pb-4 backdrop-blur supports-backdrop-filter:bg-card/80'
                  data-testid='analytics-sticky-chart-panel'
                >
                  <Card className='rounded-3xl border-dashed bg-background/70 p-4 shadow-none'>
                    <AiChartRenderer
                      charts={
                        isUsingAiCharts && aiChartSpecs.length > 0
                          ? aiChartSpecs
                          : generatedChartSpecs
                      }
                      onChartPointClick={handleChartPointClick}
                    />
                  </Card>
                </div>
                {drilldownSelection ? (
                  <Card className='mt-4 rounded-3xl bg-background p-4 shadow-none'>
                    <div>
                      <div>
                        <h3 className='font-semibold text-base'>
                          {t('analytics.drilldownTitle')}
                        </h3>
                        <p className='mt-1 text-muted-foreground text-sm'>
                          {drilldownSelection.specTitle} /{' '}
                          {drilldownSelection.label} /{' '}
                          {t('analytics.drilldownCount', undefined, {
                            count: String(
                              drilldownSelection.matchingRecords.length,
                            ),
                          })}
                        </p>
                      </div>
                    </div>
                    <div className='mt-4 space-y-3'>
                      {drilldownSelection.matchingRecords.length === 0 ? (
                        <p className='text-muted-foreground text-sm'>
                          {t('analytics.drilldownEmpty')}
                        </p>
                      ) : (
                        drilldownSelection.matchingRecords.map(record => (
                          <Card
                            className='rounded-2xl border-border bg-card p-3 shadow-none'
                            key={record.id}
                          >
                            <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                              <div className='min-w-0 flex-1'>
                                <p className='truncate font-medium text-sm'>
                                  {record.title}
                                </p>
                                <div className='mt-2 flex flex-wrap gap-2 text-xs'>
                                  <Badge
                                    className='rounded-full'
                                    variant='secondary'
                                  >
                                    {record.domain}
                                  </Badge>
                                  {record.parentCategories.map(category => (
                                    <Badge
                                      className='rounded-full'
                                      key={`${record.id}-${category}`}
                                      variant='secondary'
                                    >
                                      {category}
                                    </Badge>
                                  ))}
                                  {record.savedInProjects.map(project => (
                                    <Badge
                                      className='rounded-full'
                                      key={`${record.id}-${project}`}
                                      variant='secondary'
                                    >
                                      {project}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className='flex shrink-0 flex-col gap-2 sm:items-end'>
                                <time className='text-muted-foreground text-xs'>
                                  {new Date(record.savedAt).toLocaleString(
                                    language === 'ja' ? 'ja-JP' : 'en-US',
                                  )}
                                </time>
                                <TooltipProvider delayDuration={0}>
                                  <div className='flex items-center justify-end gap-1'>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          asChild
                                          size='icon-sm'
                                          variant='ghost'
                                        >
                                          <a
                                            aria-label={t(
                                              'analytics.openAria',
                                              undefined,
                                              { title: record.title },
                                            )}
                                            href={record.url}
                                            rel='noreferrer'
                                            target='_blank'
                                          >
                                            <ExternalLink className='size-4' />
                                          </a>
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side='top'>
                                        {t('analytics.open')}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          aria-label={t(
                                            'savedTabs.url.deleteAria',
                                          )}
                                          disabled={deletingUrl === record.url}
                                          onClick={() =>
                                            handleDeleteClick(record)
                                          }
                                          size='icon-sm'
                                          type='button'
                                          variant='ghost'
                                        >
                                          <Trash2 className='size-4' />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side='top'>
                                        {t('common.delete')}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TooltipProvider>
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  </Card>
                ) : null}
              </div>
            </ScrollArea>
          </section>
        </div>
      </main>

      <SavedTabsChatWidget
        conversationId={activeConversation?.id}
        historyItems={historyItems}
        historyVariant='dropdown'
        initialMessages={activeConversation?.messages}
        onCreateConversation={createConversation}
        onDeleteHistoryItem={deleteConversation}
        onMessagesChange={handleMessagesChange}
        onSelectHistoryItem={selectConversation}
        title={activeConversation?.title}
      />

      <AlertDialog
        onOpenChange={isOpen => {
          if (!isOpen && deletingUrl) {
            return
          }
          if (!isOpen) {
            setDeleteTarget(null)
          }
        }}
        open={Boolean(deleteTarget)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('savedTabs.url.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('savedTabs.url.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault()
                if (!deleteTarget) {
                  return
                }

                void performDelete(deleteTarget)
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export { AnalyticsRoute }
