// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storageMocks = vi.hoisted(() => ({
  getViewMode: vi.fn(),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/features/i18n/components/LanguageSelect', () => ({
  LanguageSelect: () => <div>表示言語</div>,
}))

vi.mock('@/features/i18n/context/I18nProvider', () => ({
  useI18n: () => ({
    language: 'ja',
    t: (key: string) =>
      (
        ({
          'sidebar.analytics': '分析',
          'sidebar.chat': 'チャット',
          'sidebar.collapse': 'サイドバーを小さくする',
          'sidebar.open': 'サイドバーを開く',
          'sidebar.options': 'オプション',
          'sidebar.periodicExecution': '定期実行',
          'sidebar.tabList': 'タブ一覧',
          'savedTabs.viewMode.custom': 'カスタムモード',
          'savedTabs.viewMode.domain': 'ドメインモード',
        }) satisfies Record<string, string>
      )[key] ?? key,
  }),
}))

vi.mock('@/features/saved-tabs/routes/SavedTabsRoute', () => ({
  SavedTabsRoute: ({
    onViewModeNavigate,
    search,
  }: {
    onViewModeNavigate?: (mode: 'custom' | 'domain') => void
    search?: string
  }) => (
    <div>
      <div>{`saved-tabs-route:${search ?? ''}`}</div>
      <button onClick={() => onViewModeNavigate?.('custom')} type='button'>
        navigate-custom
      </button>
      <button onClick={() => onViewModeNavigate?.('domain')} type='button'>
        navigate-domain
      </button>
    </div>
  ),
}))

vi.mock('@/features/ai-chat/routes/AiChatRoute', () => ({
  AiChatRoute: () => <div>ai-chat-route</div>,
}))

vi.mock('@/features/analytics/routes/AnalyticsRoute', () => ({
  AnalyticsRoute: () => <div>analytics-route</div>,
}))

vi.mock('@/features/periodic-execution/routes/PeriodicExecutionRoute', () => ({
  PeriodicExecutionRoute: () => <div>periodic-execution-route</div>,
}))

vi.mock('@/features/options/routes/OptionsRoute', () => ({
  OptionsRoute: () => <div>options-route</div>,
}))

vi.mock('@/lib/storage/projects', () => ({
  getViewMode: storageMocks.getViewMode,
}))

import { AppRouter } from './AppRouter'

describe('AppRouter', () => {
  beforeEach(() => {
    storageMocks.getViewMode.mockReset()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
  })

  it('ルートパスは保存済み viewMode の saved-tabs に redirect する', async () => {
    storageMocks.getViewMode.mockResolvedValue('custom')

    render(<AppRouter initialEntries={['/']} />)

    expect(
      await screen.findByText('saved-tabs-route:?mode=custom'),
    ).toBeTruthy()
  })

  it('サイドバークリックで SPA 遷移する', () => {
    render(<AppRouter initialEntries={['/saved-tabs?mode=domain']} />)

    const analyticsLink = screen.getAllByRole('link', {
      name: '分析',
    })[0]
    if (!analyticsLink) {
      throw new Error('分析リンクが見つかりません')
    }

    fireEvent.click(analyticsLink)

    expect(screen.getByText('analytics-route')).toBeTruthy()
  })

  it('router context では内部リンクが app.html ではなく route を指す', () => {
    render(<AppRouter initialEntries={['/saved-tabs?mode=custom']} />)

    fireEvent.click(screen.getByRole('button', { name: 'サイドバーを開く' }))

    expect(
      screen
        .getAllByRole('link', { name: 'チャット' })[0]
        ?.getAttribute('href'),
    ).toBe('/ai-chat')
    expect(
      screen.getAllByRole('link', { name: '分析' })[0]?.getAttribute('href'),
    ).toBe('/analytics')
    expect(
      screen
        .getAllByRole('link', { name: 'カスタムモード' })[0]
        ?.getAttribute('href'),
    ).toBe('/saved-tabs?mode=custom')
  })

  it('analytics route を開ける', () => {
    render(<AppRouter initialEntries={['/analytics']} />)

    expect(screen.getByText('analytics-route')).toBeTruthy()
  })

  it('options route を開ける', () => {
    render(<AppRouter initialEntries={['/options']} />)

    expect(screen.getByText('options-route')).toBeTruthy()
  })

  it('SavedTabsRoute から別 mode を選ぶと replace navigate する', () => {
    render(<AppRouter initialEntries={['/saved-tabs?mode=domain']} />)

    fireEvent.click(screen.getByRole('button', { name: 'navigate-custom' }))

    expect(screen.getByText('saved-tabs-route:?mode=custom')).toBeTruthy()
  })

  it('SavedTabsRoute から同じ mode を選んだ場合は再 navigate しない', () => {
    render(<AppRouter initialEntries={['/saved-tabs?mode=domain']} />)

    fireEvent.click(screen.getByRole('button', { name: 'navigate-domain' }))

    expect(screen.getByText('saved-tabs-route:?mode=domain')).toBeTruthy()
  })

  it('不明なルートは viewMode 取得失敗時に domain で開く', async () => {
    storageMocks.getViewMode.mockRejectedValue(new Error('storage failed'))

    render(<AppRouter initialEntries={['/unknown']} />)

    expect(
      await screen.findByText('saved-tabs-route:?mode=domain'),
    ).toBeTruthy()
  })

  it('initialEntries が無い場合は HashRouter を使う', () => {
    window.history.replaceState({}, '', '/app.html#/saved-tabs?mode=custom')

    render(<AppRouter />)

    expect(screen.getByText('saved-tabs-route:?mode=custom')).toBeTruthy()
  })

  it('unmount 後に viewMode が解決しても navigate しない', async () => {
    let resolveViewMode: ((mode: 'custom' | 'domain') => void) | undefined
    storageMocks.getViewMode.mockReturnValue(
      new Promise<'custom' | 'domain'>(resolve => {
        resolveViewMode = resolve
      }),
    )

    const { unmount } = render(<AppRouter initialEntries={['/unknown']} />)

    unmount()

    await act(async () => {
      resolveViewMode?.('custom')
      await Promise.resolve()
    })

    expect(storageMocks.getViewMode).toHaveBeenCalledTimes(1)
  })
})
