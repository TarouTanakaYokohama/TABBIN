// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomProject, TabGroup, ViewMode } from '@/types/storage'

const { toastErrorSpy, toastSuccessSpy, categoryModalSpy, viewModeToggleSpy } =
  vi.hoisted(() => ({
    toastErrorSpy: vi.fn(),
    toastSuccessSpy: vi.fn(),
    categoryModalSpy: vi.fn(),
    viewModeToggleSpy: vi.fn(),
  }))

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorSpy,
    success: toastSuccessSpy,
  },
}))

vi.mock('./CategoryModal', () => ({
  CategoryModal: ({
    onClose,
    tabGroups,
  }: {
    onClose: () => void
    tabGroups: TabGroup[]
  }) => {
    categoryModalSpy({ onClose, tabGroups })
    return (
      <div data-testid='category-modal'>
        <button onClick={onClose} type='button'>
          close-category-modal
        </button>
      </div>
    )
  },
}))

vi.mock('./ViewModeToggle', () => ({
  ViewModeToggle: ({
    currentMode,
    onChange,
  }: {
    currentMode: ViewMode
    onChange: (mode: ViewMode) => void
  }) => {
    viewModeToggleSpy({ currentMode, onChange })
    return (
      <button onClick={() => onChange('custom')} type='button'>
        view-mode-toggle
      </button>
    )
  },
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
  }) => (
    <div data-testid='dialog-root'>
      <button onClick={() => onOpenChange?.(false)} type='button'>
        dialog-close
      </button>
      {open ? children : null}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='dialog-content'>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}))

import { Header } from './Header'

const openSpy = vi.fn()
const getUrlSpy = vi.fn((path: string) => `chrome-extension://id/${path}`)

const createTabGroups = (): TabGroup[] => [
  {
    id: 'group-1',
    domain: 'example.com',
    urls: [
      { url: 'https://example.com/1', title: 'One' },
      { url: 'https://example.com/2', title: 'Two' },
    ],
  },
  {
    id: 'group-2',
    domain: 'example.org',
    urls: [{ url: 'https://example.org/1', title: 'Three' }],
  },
]

const createCustomProjects = (): CustomProject[] => [
  {
    id: 'project-1',
    name: 'Project A',
    categories: ['既存カテゴリ'],
    createdAt: 1,
    updatedAt: 2,
    urls: [],
  },
]

const createProps = (
  overrides: Partial<React.ComponentProps<typeof Header>> = {},
) => ({
  tabGroups: createTabGroups(),
  filteredTabGroups: undefined,
  currentMode: 'domain' as ViewMode,
  onModeChange: vi.fn(),
  searchQuery: '',
  onSearchChange: vi.fn(),
  customProjects: createCustomProjects(),
  onAddCategory: vi.fn(),
  ...overrides,
})

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'open').mockImplementation(openSpy as never)
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      runtime: {
        getURL: getUrlSpy,
      },
    } as unknown as typeof chrome
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('検索入力変更・クリア・件数表示・オプションボタン動作を処理する', () => {
    const onSearchChange = vi.fn()

    render(
      <Header
        {...createProps({
          searchQuery: 'abc',
          onSearchChange,
          filteredTabGroups: [createTabGroups()[0]],
        })}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('検索'), {
      target: { value: 'next' },
    })
    expect(onSearchChange).toHaveBeenCalledWith('next')

    const buttons = screen.getAllByRole('button')
    const clearButton = buttons[0]
    expect(clearButton).toBeTruthy()
    if (!clearButton) {
      throw new Error('clear button not found')
    }
    fireEvent.click(clearButton)
    expect(onSearchChange).toHaveBeenCalledWith('')

    fireEvent.click(screen.getByRole('button', { name: /オプション/ }))
    expect(getUrlSpy).toHaveBeenCalledWith('options.html')
    expect(openSpy).toHaveBeenCalledWith(
      'chrome-extension://id/options.html',
      '_blank',
    )

    expect(screen.getByText('タブ:2')).toBeTruthy()
    expect(screen.getByText('ドメイン:1')).toBeTruthy()
  })

  it('domain モードで親カテゴリ管理モーダルを開閉し ViewModeToggle を描画する', () => {
    render(<Header {...createProps()} />)

    expect(viewModeToggleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        currentMode: 'domain',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /親カテゴリ管理/ }))
    expect(screen.getByTestId('category-modal')).toBeTruthy()
    expect(categoryModalSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tabGroups: createProps().tabGroups,
      }),
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'close-category-modal' }),
    )
    expect(screen.queryByTestId('category-modal')).toBeNull()
  })

  it('custom モードでカテゴリ追加ダイアログの Enter 分岐（空/重複/成功）を処理する', () => {
    const onAddCategory = vi.fn()
    const customProjects = createCustomProjects()

    render(
      <Header
        {...createProps({
          currentMode: 'custom',
          customProjects,
          onAddCategory,
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /カテゴリ追加/ }))
    const input = screen.getByPlaceholderText(
      '例: ツール、ライブラリ、ドキュメント',
    )

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(toastErrorSpy).toHaveBeenCalledWith('カテゴリ名を入力してください')

    fireEvent.change(input, { target: { value: '既存カテゴリ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(toastErrorSpy).toHaveBeenCalledWith('同じカテゴリ名は追加できません')

    fireEvent.change(input, { target: { value: '新カテゴリ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onAddCategory).toHaveBeenCalledWith('project-1', '新カテゴリ')
    expect(toastSuccessSpy).toHaveBeenCalledWith(
      'カテゴリ「新カテゴリ」を追加しました',
    )
    expect(screen.queryByTestId('dialog-content')).toBeNull()
  })

  it('Dialog の onOpenChange で custom カテゴリダイアログを閉じる', () => {
    render(
      <Header
        {...createProps({
          currentMode: 'custom',
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /カテゴリ追加/ }))
    expect(screen.getByTestId('dialog-content')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'dialog-close' }))
    expect(screen.queryByTestId('dialog-content')).toBeNull()
  })

  it('Enter 以外のキーでは追加せず、onAddCategory 未指定時のデフォルト関数でも成功分岐を通る', () => {
    render(
      <Header
        {...(createProps({
          currentMode: 'custom',
          tabGroups: [
            { id: 'g1', domain: 'a.com', urls: undefined },
            { id: 'g2', domain: 'b.com', urls: [] },
          ],
          filteredTabGroups: undefined,
        }) as React.ComponentProps<typeof Header>)}
        onAddCategory={
          undefined as unknown as (
            projectId: string,
            categoryName: string,
          ) => void
        }
      />,
    )

    expect(screen.getByText('タブ:0')).toBeTruthy()
    expect(screen.getByText('ドメイン:2')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /カテゴリ追加/ }))
    const input = screen.getByPlaceholderText(
      '例: ツール、ライブラリ、ドキュメント',
    )

    fireEvent.change(input, { target: { value: 'カテゴリX' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(toastSuccessSpy).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(toastSuccessSpy).toHaveBeenCalledWith(
      'カテゴリ「カテゴリX」を追加しました',
    )
    expect(screen.queryByTestId('dialog-content')).toBeNull()
  })
})
