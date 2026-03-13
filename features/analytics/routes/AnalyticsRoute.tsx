import { useEffect, useState } from 'react'
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
  ...analyticsQuery,
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
    case 'time':
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
  const [query, setQuery] = useState<AnalyticsQuery>(
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
          <section className='grid min-h-0 flex-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]'>
            <aside
              className='min-h-0 space-y-4 overflow-y-auto overscroll-contain'
              data-testid='analytics-sidebar-pane'
            >
              <section className='rounded-3xl border border-border bg-card p-5'>
                <h2 className='font-semibold text-lg'>分析条件</h2>
                <div className='mt-4 grid gap-3'>
                  <label className='grid gap-1.5 text-sm'>
                    <span>ビュー名</span>
                    <input
                      aria-label='ビュー名'
                      className='rounded-xl border border-input bg-background px-3 py-2'
                      onChange={event => setViewName(event.target.value)}
                      value={viewName}
                    />
                  </label>
                  <label className='grid gap-1.5 text-sm'>
                    <span>集計軸</span>
                    <select
                      aria-label='集計軸'
                      className='rounded-xl border border-input bg-background px-3 py-2'
                      onChange={event =>
                        applyQuery({
                          ...query,
                          groupBy: event.target
                            .value as AnalyticsQuery['groupBy'],
                        })
                      }
                      value={query.groupBy}
                    >
                      <option value='domain'>ドメイン</option>
                      <option value='time'>時系列</option>
                      <option value='parentCategory'>親カテゴリ</option>
                      <option value='subCategory'>子カテゴリ</option>
                      <option value='project'>プロジェクト</option>
                    </select>
                  </label>
                  <label className='grid gap-1.5 text-sm'>
                    <span>グラフ種別</span>
                    <select
                      aria-label='グラフ種別'
                      className='rounded-xl border border-input bg-background px-3 py-2'
                      onChange={event =>
                        applyQuery({
                          ...query,
                          chartType: event.target
                            .value as AnalyticsQuery['chartType'],
                        })
                      }
                      value={query.chartType}
                    >
                      <option value='bar'>棒グラフ</option>
                      <option value='line'>折れ線</option>
                      <option value='area'>面グラフ</option>
                      <option value='pie'>円グラフ</option>
                      <option value='radar'>レーダー</option>
                    </select>
                  </label>
                  <label className='grid gap-1.5 text-sm'>
                    <span>上位件数</span>
                    <input
                      aria-label='上位件数'
                      className='rounded-xl border border-input bg-background px-3 py-2'
                      min={1}
                      onChange={event =>
                        applyQuery({
                          ...query,
                          limit: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      type='number'
                      value={query.limit}
                    />
                  </label>
                </div>
                <div className='mt-4 flex gap-2'>
                  <button
                    className='rounded-xl bg-foreground px-4 py-2 font-medium text-background'
                    onClick={handleSaveView}
                    type='button'
                  >
                    保存する
                  </button>
                  <button
                    className='rounded-xl border border-border px-4 py-2'
                    onClick={() => applyQuery(defaultAnalyticsQuery)}
                    type='button'
                  >
                    初期化
                  </button>
                </div>
              </section>

              <section className='rounded-3xl border border-border bg-card p-5'>
                <h2 className='font-semibold text-lg'>保存済みビュー</h2>
                <div className='mt-4 space-y-2'>
                  {savedViews.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                      まだ保存された分析ビューはありません。
                    </p>
                  ) : (
                    savedViews.map(view => (
                      <div
                        className='flex items-center justify-between gap-2 rounded-2xl border border-border p-3'
                        key={view.id}
                      >
                        <button
                          className='min-w-0 flex-1 text-left'
                          onClick={() => applyQuery(view.query, view.name)}
                          type='button'
                        >
                          <p className='truncate font-medium text-sm'>
                            {view.name}
                          </p>
                        </button>
                        <button
                          aria-label={`${view.name}を削除`}
                          className='rounded-lg border border-border px-2 py-1 text-sm'
                          onClick={() => void handleDeleteView(view.id)}
                          type='button'
                        >
                          削除
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </aside>

            <section
              className='min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-5'
              data-testid='analytics-canvas-pane'
            >
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <h2 className='font-semibold text-lg'>分析キャンバス</h2>
                  <p className='mt-1 text-muted-foreground text-sm'>
                    {summary}
                  </p>
                </div>
              </div>
              <div
                className='sticky top-[-1.25rem] z-10 -mx-5 bg-card/95 px-5 pt-5 pb-4 backdrop-blur supports-[backdrop-filter]:bg-card/80'
                data-testid='analytics-sticky-chart-panel'
              >
                <div className='rounded-3xl border border-border border-dashed bg-background/70 p-4'>
                  <AiChartRenderer
                    charts={
                      isUsingAiCharts && aiChartSpecs.length > 0
                        ? aiChartSpecs
                        : generatedChartSpecs
                    }
                    onChartPointClick={handleChartPointClick}
                  />
                </div>
              </div>
              {drilldownSelection ? (
                <section className='mt-4 rounded-3xl border border-border bg-background p-4'>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <h3 className='font-semibold text-base'>
                        ドリルダウン結果
                      </h3>
                      <p className='mt-1 text-muted-foreground text-sm'>
                        {drilldownSelection.specTitle} /{' '}
                        {drilldownSelection.label} /{' '}
                        {drilldownSelection.matchingRecords.length}件
                      </p>
                    </div>
                    <button
                      className='rounded-xl border border-border px-3 py-2 text-sm'
                      onClick={() => setDrilldownSelection(null)}
                      type='button'
                    >
                      クリア
                    </button>
                  </div>
                  <div className='mt-4 space-y-3'>
                    {drilldownSelection.matchingRecords.length === 0 ? (
                      <p className='text-muted-foreground text-sm'>
                        該当する保存タブはありません。
                      </p>
                    ) : (
                      drilldownSelection.matchingRecords.map(record => (
                        <article
                          className='rounded-2xl border border-border bg-card p-3'
                          key={record.id}
                        >
                          <div className='flex flex-wrap items-start justify-between gap-3'>
                            <div className='min-w-0 flex-1'>
                              <p className='truncate font-medium text-sm'>
                                {record.title}
                              </p>
                              <p className='mt-1 break-all text-muted-foreground text-xs'>
                                {record.url}
                              </p>
                              <div className='mt-2 flex flex-wrap gap-2 text-xs'>
                                <span className='rounded-full bg-muted px-2 py-1'>
                                  {record.domain}
                                </span>
                                {record.savedInProjects.map(project => (
                                  <span
                                    className='rounded-full bg-muted px-2 py-1'
                                    key={`${record.id}-${project}`}
                                  >
                                    {project}
                                  </span>
                                ))}
                                {record.parentCategories.map(category => (
                                  <span
                                    className='rounded-full bg-muted px-2 py-1'
                                    key={`${record.id}-${category}`}
                                  >
                                    {category}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className='flex flex-col items-end gap-2'>
                              <time className='text-muted-foreground text-xs'>
                                {new Date(record.savedAt).toLocaleString(
                                  'ja-JP',
                                )}
                              </time>
                              <a
                                aria-label={`${record.title} を開く`}
                                className='rounded-xl border border-border px-3 py-2 text-sm'
                                href={record.url}
                                rel='noreferrer'
                                target='_blank'
                              >
                                開く
                              </a>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              ) : null}
            </section>
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
