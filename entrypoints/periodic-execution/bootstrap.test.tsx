// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  createRoot: vi.fn(),
  renderRoot: vi.fn(),
}))

vi.mock('react-dom/client', () => ({
  createRoot: mocked.createRoot,
}))

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}))

vi.mock('@/features/options/hooks/useSettings', () => ({
  useSettings: () => ({
    isLoading: false,
    setSettings: vi.fn(),
    settings: {
      autoDeletePeriod: 'never',
    },
  }),
}))

vi.mock('@/features/options/hooks/useAutoDeletePeriod', () => ({
  useAutoDeletePeriod: () => ({
    confirmationState: {
      isVisible: false,
      message: '',
      onConfirm: vi.fn(),
    },
    handleAutoDeletePeriodChange: vi.fn(),
    hideConfirmation: vi.fn(),
    pendingAutoDeletePeriod: null,
    prepareAutoDeletePeriod: vi.fn(),
  }),
}))

const importModule = async () => {
  vi.resetModules()
  mocked.createRoot.mockReturnValue({
    render: mocked.renderRoot,
  })
  return import('./main')
}

describe('periodic-execution bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('PeriodicExecutionPage を描画できる', async () => {
    const { PeriodicExecutionPage } = await importModule()

    render(createElement(PeriodicExecutionPage))

    expect(screen.getAllByText('定期実行').length).toBeGreaterThan(0)
    expect(screen.getByText('タブの自動削除期間')).toBeTruthy()
  })

  it('DOMContentLoaded で app 要素へ render する', async () => {
    let domReadyHandler: EventListener | undefined

    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      callback: EventListenerOrEventListenerObject | null,
    ) => {
      if (type === 'DOMContentLoaded' && typeof callback === 'function') {
        domReadyHandler = callback
      }
    }) as typeof document.addEventListener)

    await importModule()
    document.body.innerHTML = '<div id="app"></div>'
    domReadyHandler?.(new Event('DOMContentLoaded'))

    expect(mocked.createRoot).toHaveBeenCalledWith(
      document.getElementById('app'),
    )
    expect(mocked.renderRoot).toHaveBeenCalledTimes(1)
  })
})
