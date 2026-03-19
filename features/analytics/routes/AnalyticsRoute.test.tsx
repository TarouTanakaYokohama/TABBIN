// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { Children, Fragment, type ReactNode, isValidElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiSavedUrlRecord } from '@/features/ai-chat/types'
import type { SavedAnalyticsView } from '@/lib/storage/analytics'
import { AnalyticsRoute } from './AnalyticsRoute'

const analyticsRouteMocks = vi.hoisted(() => ({
  deleteViewMock: vi.fn(),
  loadRecordsMock: vi.fn<() => Promise<AiSavedUrlRecord[]>>(),
  loadViewsMock: vi.fn<() => Promise<SavedAnalyticsView[]>>(),
  saveViewsMock: vi.fn(),
  updateMessagesMock: vi.fn(),
}))

vi.mock('@/features/analytics/lib/loadAnalyticsRecords', () => ({
  loadAnalyticsRecords: analyticsRouteMocks.loadRecordsMock,
}))

vi.mock('@/components/ui/select', () => {
  const SelectTrigger = ({ children }: { children?: ReactNode }) => (
    <Fragment>{children}</Fragment>
  )
  const SelectValue = ({
    children,
    placeholder,
  }: {
    children?: ReactNode
    placeholder?: string
  }) => <Fragment>{children ?? placeholder}</Fragment>
  const SelectContent = ({ children }: { children?: ReactNode }) => (
    <Fragment>{children}</Fragment>
  )
  const SelectItem = ({ children }: { children?: ReactNode }) => (
    <Fragment>{children}</Fragment>
  )

  const Select = ({
    children,
    onValueChange,
    value,
  }: {
    children?: ReactNode
    onValueChange?: (value: string) => void
    value?: string
  }) => {
    const [triggerNode, contentNode] =
      Children.toArray(children).filter(isValidElement)
    const triggerProps = isValidElement(triggerNode)
      ? (triggerNode.props as Record<string, unknown>)
      : {}
    const contentChildren = isValidElement<{ children?: ReactNode }>(
      contentNode,
    )
      ? contentNode.props.children
      : undefined
    const items = contentChildren
      ? Children.toArray(contentChildren)
          .filter(isValidElement)
          .map(item => {
            const props = item.props as {
              children?: ReactNode
              value: string
            }

            return {
              children: props.children,
              value: props.value,
            }
          })
      : []

    return (
      <select
        aria-label={triggerProps['aria-label'] as string | undefined}
        className={triggerProps.className as string | undefined}
        id={triggerProps.id as string | undefined}
        onChange={event => onValueChange?.(event.target.value)}
        value={value}
      >
        {items.map(item => (
          <option key={item.value} value={item.value}>
            {item.children}
          </option>
        ))}
      </select>
    )
  }

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  }
})

vi.mock('@/features/ai-chat/components/AiChartRenderer', () => ({
  AiChartRenderer: ({
    charts,
    onChartPointClick,
  }: {
    charts: Array<{ data?: Record<string, unknown>[]; title: string }>
    onChartPointClick?: (point: {
      label: string
      seriesKey?: string
      spec: { title: string }
      value?: number
    }) => void
  }) => (
    <div>
      {charts.map(chart => (
        <div key={chart.title}>
          <div>{chart.title}</div>
          <div>{JSON.stringify(chart.data ?? [])}</div>
        </div>
      ))}
      <button
        onClick={() => {
          onChartPointClick?.({
            label: 'docs.example.com',
            seriesKey: 'count',
            spec: charts[0] ?? { title: '' },
            value: 1,
          })
        }}
        type='button'
      >
        emit-chart-click
      </button>
    </div>
  ),
}))

vi.mock('@/features/ai-chat/components/SavedTabsChatWidget', () => ({
  SavedTabsChatWidget: ({
    historyVariant,
    onMessagesChange,
    onOpenChange,
    title,
  }: {
    historyVariant?: string
    onMessagesChange?: (messages: unknown[]) => void
    onOpenChange?: (isOpen: boolean) => void
    title?: string
  }) => (
    <div>
      <div>{`history-variant:${historyVariant ?? 'none'}`}</div>
      <div>{`active-title:${title ?? ''}`}</div>
      <button onClick={() => onOpenChange?.(true)} type='button'>
        open-sidebar
      </button>
      <button onClick={() => onOpenChange?.(false)} type='button'>
        close-sidebar
      </button>
      <button
        onClick={() =>
          onMessagesChange?.([
            {
              charts: [
                {
                  data: [{ count: 2, label: 'AI Domain' }],
                  series: [
                    {
                      colorToken: 'chart-1',
                      dataKey: 'count',
                      label: '保存数',
                    },
                  ],
                  title: 'AI 生成チャート',
                  type: 'bar',
                  xKey: 'label',
                },
              ],
              content: 'AI result',
              id: 'assistant-1',
              role: 'assistant',
              toolTraces: [
                {
                  input: {},
                  output: {
                    query: {
                      chartType: 'bar',
                      compareBy: 'none',
                      filters: {
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
                      },
                      groupBy: 'domain',
                      limit: 8,
                      mode: 'both',
                      normalize: false,
                      sort: 'value-desc',
                      stacked: false,
                      timeBucket: 'day',
                      timeRange: '30d',
                    },
                  },
                  state: 'output-available',
                  title: '保存分析',
                  toolCallId: 'tool-1',
                  toolName: 'generateSavedTabsAnalytics',
                  type: 'dynamic-tool',
                },
              ],
            },
          ])
        }
        type='button'
      >
        emit-ai-chart
      </button>
      <button
        onClick={() =>
          onMessagesChange?.([
            {
              charts: [
                {
                  data: [{ count: 1, label: 'AI Only' }],
                  series: [
                    {
                      colorToken: 'chart-1',
                      dataKey: 'count',
                      label: '保存数',
                    },
                  ],
                  title: 'クエリなしAIチャート',
                  type: 'bar',
                  xKey: 'label',
                },
              ],
              content: 'AI result without query',
              id: 'assistant-2',
              role: 'assistant',
            },
          ])
        }
        type='button'
      >
        emit-chart-only
      </button>
    </div>
  ),
}))

vi.mock('@/features/ai-chat/hooks/useSharedAiChatHistory', () => ({
  useSharedAiChatHistory: () => ({
    activeConversation: {
      id: 'conversation-1',
      messages: [],
      title: 'Analytics Chat',
    },
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    historyItems: [],
    isLoading: false,
    selectConversation: vi.fn(),
    updateMessages: analyticsRouteMocks.updateMessagesMock,
  }),
}))

vi.mock('@/lib/storage/analytics', () => ({
  createSavedAnalyticsView: ({
    name,
    now = 100,
    query,
  }: {
    name: string
    now?: number
    query: unknown
  }) => ({
    createdAt: now,
    id: `view-${name}`,
    name,
    query,
    updatedAt: now,
  }),
  deleteSavedAnalyticsView: analyticsRouteMocks.deleteViewMock,
  loadSavedAnalyticsViews: analyticsRouteMocks.loadViewsMock,
  saveSavedAnalyticsViews: analyticsRouteMocks.saveViewsMock,
}))

const records: AiSavedUrlRecord[] = [
  {
    id: '1',
    url: 'https://docs.example.com/a',
    title: 'Example Docs',
    domain: 'docs.example.com',
    savedAt: Date.UTC(2026, 2, 13),
    savedInTabGroups: ['docs.example.com'],
    savedInProjects: ['Research'],
    subCategories: ['Docs'],
    projectCategories: ['Reading'],
    parentCategories: ['Work'],
  },
  {
    id: '2',
    url: 'https://news.example.net/a',
    title: 'News Entry',
    domain: 'news.example.net',
    savedAt: Date.UTC(2026, 2, 12),
    savedInTabGroups: [],
    savedInProjects: ['Inbox'],
    subCategories: [],
    projectCategories: ['Catchup'],
    parentCategories: [],
  },
]

describe('AnalyticsRoute', () => {
  beforeEach(() => {
    analyticsRouteMocks.loadRecordsMock.mockResolvedValue(records)
    analyticsRouteMocks.loadViewsMock.mockResolvedValue([])
    analyticsRouteMocks.deleteViewMock.mockReset()
    analyticsRouteMocks.saveViewsMock.mockReset()
    analyticsRouteMocks.updateMessagesMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shared ui コンポーネントを利用する実装になっている', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), './AnalyticsRoute.tsx'),
      {
        encoding: 'utf8',
      },
    )

    expect(source).toContain("from '@/components/ui/button'")
    expect(source).toContain("from '@/components/ui/card'")
    expect(source).toContain("from '@/components/ui/input'")
    expect(source).toContain("from '@/components/ui/label'")
    expect(source).toContain("from '@/components/ui/select'")
    expect(source).toContain("from '@/components/ui/scroll-area'")
    expect(source).toContain("from '@/components/ui/badge'")
  })

  it('初期条件でチャートを表示する', async () => {
    render(<AnalyticsRoute />)

    expect(await screen.findByText('分析条件')).toBeTruthy()
    expect(await screen.findByText('ドメイン別の保存数')).toBeTruthy()
    expect(screen.queryByText('期間')).toBeNull()
    expect(screen.queryByText('現在の期間: 全期間')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'カレンダーで範囲選択' }),
    ).toBeNull()
    expect(screen.queryByLabelText('含めるドメイン')).toBeNull()
    expect(screen.queryByLabelText('除外するドメイン')).toBeNull()
    expect(screen.queryByLabelText('モード')).toBeNull()
    expect(screen.queryByText('モード')).toBeNull()
    expect(screen.queryByLabelText('比較系列')).toBeNull()
    expect(screen.queryByText('比較系列')).toBeNull()
    expect(
      screen.queryByRole('option', { name: 'プロジェクトカテゴリ' }),
    ).toBeNull()
    expect(screen.queryByText('分析プリセット')).toBeNull()
    expect(screen.queryByRole('button', { name: 'トップドメイン' })).toBeNull()
    expect(screen.getByText('history-variant:dropdown')).toBeTruthy()
    expect(screen.getByText('active-title:Analytics Chat')).toBeTruthy()
  })

  it('分析条件と分析キャンバスを個別スクロールする固定レイアウトで描画する', async () => {
    render(<AnalyticsRoute />)

    await screen.findByText('分析条件')

    const layout = screen.getByTestId('analytics-page-layout')
    const sidebarPane = screen.getByTestId('analytics-sidebar-pane')
    const canvasPane = screen.getByTestId('analytics-canvas-pane')
    const stickyChartPanel = screen.getByTestId('analytics-sticky-chart-panel')

    expect(layout.className.includes('h-screen')).toBe(true)
    expect(layout.className.includes('overflow-hidden')).toBe(true)
    expect(sidebarPane.className.includes('overflow-y-auto')).toBe(true)
    expect(sidebarPane.className.includes('overscroll-contain')).toBe(true)
    expect(canvasPane.className.includes('overflow-y-auto')).toBe(true)
    expect(canvasPane.className.includes('overscroll-contain')).toBe(true)
    expect(stickyChartPanel.className.includes('-top-5')).toBe(true)
    expect(stickyChartPanel.className.includes('-mx-5')).toBe(true)
  })

  it('分析条件の操作ボタンを1:1幅の2カラムで表示する', async () => {
    render(<AnalyticsRoute />)

    await screen.findByText('分析条件')

    const saveButton = screen.getByRole('button', { name: '保存する' })
    const resetButton = screen.getByRole('button', { name: '初期化' })
    const buttonRow = saveButton.parentElement

    expect(buttonRow?.className.includes('grid')).toBe(true)
    expect(buttonRow?.className.includes('grid-cols-2')).toBe(true)
    expect(saveButton.className.includes('w-full')).toBe(true)
    expect(resetButton.className.includes('w-full')).toBe(true)
  })

  it('左側の手動フィルタ変更でチャートを更新する', async () => {
    render(<AnalyticsRoute />)

    expect((await screen.findAllByText('ドメイン別の保存数')).length).toBe(1)

    fireEvent.change(screen.getByLabelText('集計軸'), {
      target: { value: 'project' },
    })

    expect(await screen.findByText('プロジェクト別の保存数')).toBeTruthy()
  })

  it('現在の条件を保存できる', async () => {
    render(<AnalyticsRoute />)

    expect((await screen.findAllByText('ドメイン別の保存数')).length).toBe(1)
    fireEvent.change(screen.getByLabelText('ビュー名'), {
      target: { value: 'My Analytics' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存する' }))

    await waitFor(() => {
      expect(analyticsRouteMocks.saveViewsMock).toHaveBeenCalledTimes(1)
    })
  })

  it('保存済みビューを読み込み、削除できる', async () => {
    analyticsRouteMocks.loadViewsMock.mockResolvedValue([
      {
        createdAt: 1,
        id: 'view-1',
        name: 'Saved View',
        query: {
          chartType: 'bar',
          compareBy: 'none',
          filters: {
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
          },
          groupBy: 'domain',
          limit: 8,
          mode: 'both',
          normalize: false,
          sort: 'value-desc',
          stacked: false,
          timeBucket: 'day',
          timeRange: '30d',
        },
        updatedAt: 1,
      },
    ])

    render(<AnalyticsRoute />)

    expect(
      await screen.findByRole('button', { name: 'Saved Viewを削除' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Saved Viewを削除' }))

    await waitFor(() => {
      expect(analyticsRouteMocks.deleteViewMock).toHaveBeenCalledWith('view-1')
    })
  })

  it('保存済みビューを読み込んでもモードは両方固定になる', async () => {
    analyticsRouteMocks.loadViewsMock.mockResolvedValue([
      {
        createdAt: 1,
        id: 'view-1',
        name: 'Domain Only View',
        query: {
          chartType: 'bar',
          compareBy: 'none',
          filters: {
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
          },
          groupBy: 'domain',
          limit: 8,
          mode: 'domain',
          normalize: false,
          sort: 'value-desc',
          stacked: false,
          timeBucket: 'day',
          timeRange: '30d',
        },
        updatedAt: 1,
      },
    ])

    render(<AnalyticsRoute />)

    expect(
      await screen.findByRole('button', { name: 'Domain Only Viewを削除' }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Domain Only View' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          '[{"count":1,"label":"docs.example.com"},{"count":1,"label":"news.example.net"}]',
        ),
      ).toBeTruthy()
    })
  })

  it('AIチャットから渡されたチャートを左側に反映する', async () => {
    render(<AnalyticsRoute />)

    expect((await screen.findAllByText('ドメイン別の保存数')).length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'emit-ai-chart' }))

    expect(await screen.findByText('AI 生成チャート')).toBeTruthy()
    expect(analyticsRouteMocks.updateMessagesMock).toHaveBeenCalledTimes(1)
  })

  it('分析クエリが無い AI チャートでも左側に反映する', async () => {
    render(<AnalyticsRoute />)

    expect((await screen.findAllByText('ドメイン別の保存数')).length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'emit-chart-only' }))

    expect(await screen.findByText('クエリなしAIチャート')).toBeTruthy()
  })

  it('チャートクリックで項目に含まれる保存タブを表示する', async () => {
    render(<AnalyticsRoute />)

    expect((await screen.findAllByText('ドメイン別の保存数')).length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'emit-chart-click' }))

    expect(await screen.findByText('項目に含まれる保存タブ')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'クリア' })).toBeNull()
    expect(screen.getByText('Example Docs')).toBeTruthy()
    expect(screen.queryByText('https://docs.example.com/a')).toBeNull()
    const savedAtText = new Date(records[0].savedAt).toLocaleString('ja-JP')
    expect(screen.getByText(savedAtText)).toBeTruthy()
    const openLink = screen.getByRole('link', { name: 'Example Docs を開く' })
    expect(openLink).toBeTruthy()
    expect(openLink.closest('div')?.className.includes('shrink-0')).toBe(true)
  })

  it('長いタイトルでもドリルダウンの操作列が見切れないレイアウトを使う', async () => {
    analyticsRouteMocks.loadRecordsMock.mockResolvedValue([
      {
        ...records[0],
        title:
          'Extremely long analytics drilldown title that should never push the action area out of view even when the canvas is narrow',
      },
      records[1],
    ])

    render(<AnalyticsRoute />)

    expect((await screen.findAllByText('ドメイン別の保存数')).length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'emit-chart-click' }))

    const openLink = await screen.findByRole('link', {
      name: 'Extremely long analytics drilldown title that should never push the action area out of view even when the canvas is narrow を開く',
    })

    const actionColumn = openLink.closest('div')
    const cardLayout = actionColumn?.parentElement

    expect(cardLayout?.className.includes('grid')).toBe(true)
    expect(
      cardLayout?.className.includes('sm:grid-cols-[minmax(0,1fr)_auto]'),
    ).toBe(true)
    expect(actionColumn?.className.includes('sm:items-end')).toBe(true)
  })
})
