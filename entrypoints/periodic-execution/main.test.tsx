// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserSettings } from '@/types/storage'

const mocked = vi.hoisted(() => ({
  confirmationConfirm: vi.fn(),
  handleSelectAutoDelete: vi.fn(),
  hideConfirmation: vi.fn(),
  prepareAutoDeletePeriod: vi.fn(),
  settings: {
    aiChatEnabled: true,
    aiProvider: 'ollama',
    autoDeletePeriod: 'never',
    clickBehavior: 'saveSameDomainTabs',
    colors: {},
    confirmDeleteAll: false,
    confirmDeleteEach: false,
    enableCategories: true,
    excludePatterns: [],
    excludePinnedTabs: true,
    ollamaModel: 'llama3.2',
    openAllInNewWindow: false,
    openUrlInBackground: true,
    removeTabAfterExternalDrop: true,
    removeTabAfterOpen: true,
    showSavedTime: false,
  } as UserSettings,
  setSettings: vi.fn(),
  selectContentProps: [] as Record<string, unknown>[],
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
    ...props
  }: {
    children: React.ReactNode
    onClick?: () => void
    type?: 'button' | 'submit'
  } & Record<string, unknown>) => (
    <button onClick={onClick} type={type} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    ...props
  }: {
    children: React.ReactNode
  } & Record<string, unknown>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode
    onValueChange?: (value: string) => void
    value?: string
  }) => (
    <div>
      <button
        data-testid='mock-select-change'
        onClick={() => onValueChange?.(value === 'never' ? '30days' : 'never')}
        type='button'
      >
        change-select
      </button>
      {children}
    </div>
  ),
  SelectContent: ({
    children,
    ...props
  }: {
    children: React.ReactNode
  } & Record<string, unknown>) => {
    mocked.selectContentProps.push(props)
    return <div>{children}</div>
  },
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode
    value: string
  }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({
    children,
    ...props
  }: {
    children: React.ReactNode
  } & Record<string, unknown>) => <div {...props}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
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

vi.mock('@/features/options/hooks/useSettings', () => ({
  useSettings: () => ({
    handleExcludePatternsBlur: vi.fn(),
    handleExcludePatternsChange: vi.fn(),
    isLoading: false,
    setSettings: mocked.setSettings,
    settings: mocked.settings,
    updateSetting: vi.fn(),
  }),
}))

vi.mock('@/features/options/hooks/useAutoDeletePeriod', () => ({
  useAutoDeletePeriod: () => ({
    confirmationState: {
      isVisible: true,
      message: '確認メッセージ',
      onConfirm: mocked.confirmationConfirm,
    },
    handleAutoDeletePeriodChange: mocked.handleSelectAutoDelete,
    hideConfirmation: mocked.hideConfirmation,
    pendingAutoDeletePeriod: null,
    prepareAutoDeletePeriod: mocked.prepareAutoDeletePeriod,
  }),
}))

import { PeriodicExecutionPage } from './main'

describe('PeriodicExecutionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.selectContentProps = []
  })

  afterEach(() => {
    cleanup()
  })

  it('定期実行ページと自動削除設定を表示する', () => {
    render(createElement(PeriodicExecutionPage))

    expect(screen.getAllByText('定期実行').length).toBeGreaterThan(0)
    expect(screen.getByText('タブの自動削除期間')).toBeTruthy()
    expect(screen.getByText('朝8時のAIレビュー')).toBeTruthy()
    expect(screen.getByText('今後追加する自動整理')).toBeTruthy()
  })

  it('自動削除期間の変更と確認操作を処理する', () => {
    render(createElement(PeriodicExecutionPage))

    fireEvent.click(
      screen.getAllByTestId('mock-select-change')[0] as HTMLElement,
    )
    expect(mocked.handleSelectAutoDelete).toHaveBeenCalledWith('30days')

    fireEvent.click(screen.getByRole('button', { name: '設定する' }))
    expect(mocked.prepareAutoDeletePeriod).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    fireEvent.click(screen.getByRole('button', { name: '確定' }))
    expect(mocked.hideConfirmation).toHaveBeenCalledTimes(1)
    expect(mocked.confirmationConfirm).toHaveBeenCalledTimes(1)
  })
})
