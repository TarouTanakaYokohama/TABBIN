import { useEffect, useState } from 'react'
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
  generateAnalyticsResult,
  getDefaultAnalyticsQuery,
  normalizeAnalyticsQuery,
} from '@/features/analytics/lib/analytics'
import { loadAnalyticsRecords } from '@/features/analytics/lib/loadAnalyticsRecords'
import {
  type SavedAnalyticsView,
  createSavedAnalyticsView,
  deleteSavedAnalyticsView,
  loadSavedAnalyticsViews,
  saveSavedAnalyticsViews,
} from '@/lib/storage/analytics'
import type { AiChatToolTrace } from '@/types/background'

const defaultAnalyticsQuery = getDefaultAnalyticsQuery()

const analyticsGroupByOptions = [
  { label: 'ドメイン', value: 'domain' },
  { label: '時系列（直近）', value: 'timeRecent' },
  { label: '時系列（件数順）', value: 'timeTop' },
  { label: '親カテゴリ', value: 'parentCategory' },
  { label: '子カテゴリ', value: 'subCategory' },
  { label: 'プロジェクト', value: 'project' },
] as const satisfies ReadonlyArray<{
  label: string
  value: AnalyticsQuery['groupBy']
}>

const analyticsChartTypeOptions = [
  { label: '棒グラフ', value: 'bar' },
  { label: '折れ線', value: 'line' },
  { label: '面グラフ', value: 'area' },
  { label: '円グラフ', value: 'pie' },
  { label: 'レーダー', value: 'radar' },
] as const satisfies ReadonlyArray<{
  label: string
  value: AnalyticsQuery['chartType']
}>

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

const getDrilldownLabelsForRecord = (
  record: AiSavedUrlRecord,
  query: AnalyticsQuery,
): string[] => {
  switch (query.groupBy) {
    case 'timeRecent':
    case 'timeTop':
      return (
        generateAnalyticsResult([record], {
          ...query,
          compareBy: 'none',
        })
          .chartSpecs[0]?.data.map(datum => String(datum.label ?? ''))
          .filter(Boolean) ?? []
      )
    case 'parentCategory':
      return record.parentCategories.length > 0
        ? record.parentCategories
        : ['未分類']
    case 'subCategory':
      return record.subCategories.length > 0 ? record.subCategories : ['未分類']
    case 'project':
      return record.savedInProjects.length > 0
        ? record.savedInProjects
        : ['未分類']
    case 'projectCategory':
      return record.projectCategories.length > 0
        ? record.projectCategories
        : ['未分類']
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
}: {
  label: string
  query: AnalyticsQuery
  record: AiSavedUrlRecord
  seriesKey?: string
}): boolean => {
  const normalizedLabel = label.trim().toLowerCase()
  if (!normalizedLabel) {
    return false
  }

  if (!matchesDrilldownMode({ record, query, seriesKey })) {
    return false
  }

  return getDrilldownLabelsForRecord(record, query).some(
    value => value.toLowerCase() === normalizedLabel,
  )
}

const AnalyticsRoute = () => {
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
  const [isUsingAiCharts, setIsUsingAiCharts] = useState(false)

  useEffect(() => {
    let cancelled = false

    void Promise.all([loadAnalyticsRecords(), loadSavedAnalyticsViews()]).then(
      ([nextRecords, nextSavedViews]) => {
        if (cancelled) {
          return
        }

        setRecords(nextRecords)
        setSavedViews(nextSavedViews)
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const result = generateAnalyticsResult(records, query)
    setGeneratedChartSpecs(result.chartSpecs)
    setSummary(result.summary)
  }, [query, records])

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
    setSummary('AI が生成した分析チャートです。')
  }

  const handleChartPointClick = ({
    label,
    seriesKey,
    spec,
  }: AiChartPointSelection) => {
    const matchingRecords = records.filter(record =>
      matchesDrilldownLabel({
        label,
        query,
        record,
        seriesKey,
      }),
    )

    setDrilldownSelection({
      label,
      matchingRecords,
      seriesKey,
      specTitle: spec.title,
    })
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
                      <CardTitle className='text-lg'>分析条件</CardTitle>
                    </CardHeader>
                    <CardContent className='mt-4 grid gap-3 p-0'>
                      <div className='grid gap-1.5'>
                        <Label
                          className='text-sm'
                          htmlFor='analytics-view-name'
                        >
                          ビュー名
                        </Label>
                        <Input
                          aria-label='ビュー名'
                          className='rounded-xl bg-background'
                          id='analytics-view-name'
                          onChange={event => setViewName(event.target.value)}
                          value={viewName}
                        />
                      </div>
                      <div className='grid gap-1.5'>
                        <Label className='text-sm' htmlFor='analytics-group-by'>
                          集計軸
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
                            aria-label='集計軸'
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
                          グラフ種別
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
                            aria-label='グラフ種別'
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
                          上位件数
                        </Label>
                        <Input
                          aria-label='上位件数'
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
                        保存する
                      </Button>
                      <Button
                        className='w-full cursor-pointer rounded-xl'
                        onClick={() => applyQuery(defaultAnalyticsQuery)}
                        type='button'
                        variant='outline'
                      >
                        初期化
                      </Button>
                    </div>
                  </Card>

                  <Card className='rounded-3xl border-border p-5 shadow-none'>
                    <CardHeader className='gap-1 p-0'>
                      <CardTitle className='text-lg'>保存済みビュー</CardTitle>
                      <CardDescription>
                        保存した分析条件をここから再利用できます。
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='mt-4 p-0'>
                      {savedViews.length === 0 ? (
                        <p className='text-muted-foreground text-sm'>
                          まだ保存された分析ビューはありません。
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
                                  aria-label={`${view.name}を削除`}
                                  className='cursor-pointer rounded-lg'
                                  onClick={() => void handleDeleteView(view.id)}
                                  size='sm'
                                  type='button'
                                  variant='outline'
                                >
                                  削除
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
                    <h2 className='font-semibold text-lg'>分析キャンバス</h2>
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
                          項目に含まれる保存タブ
                        </h3>
                        <p className='mt-1 text-muted-foreground text-sm'>
                          {drilldownSelection.specTitle} /{' '}
                          {drilldownSelection.label} /{' '}
                          {drilldownSelection.matchingRecords.length}件
                        </p>
                      </div>
                    </div>
                    <div className='mt-4 space-y-3'>
                      {drilldownSelection.matchingRecords.length === 0 ? (
                        <p className='text-muted-foreground text-sm'>
                          該当する保存タブはありません。
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
                              <div className='flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start'>
                                <time className='text-muted-foreground text-xs'>
                                  {new Date(record.savedAt).toLocaleString(
                                    'ja-JP',
                                  )}
                                </time>
                                <Button asChild size='sm' variant='outline'>
                                  <a
                                    aria-label={`${record.title} を開く`}
                                    href={record.url}
                                    rel='noreferrer'
                                    target='_blank'
                                  >
                                    開く
                                  </a>
                                </Button>
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
    </div>
  )
}

export { AnalyticsRoute }
