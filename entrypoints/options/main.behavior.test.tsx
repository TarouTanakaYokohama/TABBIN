// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OptionsPage } from '@/features/options/routes/OptionsRoute'
import type { UserSettings } from '@/types/storage'

const mocked = vi.hoisted(() => ({
  addExcludePattern: vi.fn(),
  confirmationConfirm: vi.fn(),
  handleCategoryKeyDown: vi.fn(),
  handleColorChange: vi.fn(),
  handleExcludePatternInputChange: vi.fn(),
  handleResetColors: vi.fn(),
  handleSelectAutoDelete: vi.fn(),
  handleSelectClickBehavior: vi.fn(),
  hideConfirmation: vi.fn(),
  inputProps: [] as Record<string, unknown>[],
  removeExcludePattern: vi.fn(),
  selectContentProps: [] as Record<string, unknown>[],
  setExcludePatternInput: vi.fn(),
  setSettings: vi.fn(),
  settings: {
    aiChatEnabled: true,
    aiProvider: 'ollama',
    autoDeletePeriod: 'never',
    clickBehavior: 'saveSameDomainTabs',
    colors: {},
    confirmDeleteAll: false,
    confirmDeleteEach: false,
    enableCategories: true,
    excludePatterns: ['chrome://'],
    excludePinnedTabs: false,
    ollamaModel: 'llama3.2',
    openAllInNewWindow: false,
    openUrlInBackground: false,
    removeTabAfterExternalDrop: false,
    removeTabAfterOpen: false,
    showSavedTime: false,
  } as UserSettings,
  updateSetting: vi.fn(),
  useAutoDeletePeriodResult: {
    confirmationState: {
      isVisible: true,
      message: '確認メッセージ',
      onConfirm: vi.fn(),
    },
    handleAutoDeletePeriodChange: vi.fn(),
    hideConfirmation: vi.fn(),
    pendingAutoDeletePeriod: null,
    prepareAutoDeletePeriod: vi.fn(),
  },
  useSettingsResult: {
    addExcludePattern: vi.fn(),
    excludePatternInput: '',
    handleExcludePatternInputChange: vi.fn(),
    isLoading: false,
    removeExcludePattern: vi.fn(),
    setSettings: vi.fn(),
    settings: {} as UserSettings,
    setExcludePatternInput: vi.fn(),
    updateSetting: vi.fn(),
  },
}))

vi.mock('@/components/mode-toggle', () => ({
  ModeToggle: () => createElement('div', null, 'ModeToggle'),
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

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    id,
    onCheckedChange,
  }: {
    checked?: boolean
    id?: string
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      id={id}
      type='checkbox'
      checked={checked}
      onChange={event => onCheckedChange?.(event.target.checked)}
    />
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: Record<string, unknown>) => {
    mocked.inputProps.push(props)
    return <input {...props} />
  },
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    ...props
  }: {
    children: React.ReactNode
    htmlFor?: string
  } & Record<string, unknown>) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
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
        onClick={() =>
          onValueChange?.(value === 'never' ? '30days' : 'saveWindowTabs')
        }
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

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => createElement('div', null, 'Toaster'),
}))

vi.mock('@/features/options/ImportExportSettings', () => ({
  ImportExportSettings: () =>
    createElement('div', null, 'ImportExportSettings'),
}))

vi.mock('@/features/options/hooks/useSettings', () => ({
  useSettings: () => mocked.useSettingsResult,
}))

vi.mock('@/features/options/hooks/useColorSettings', () => ({
  useColorSettings: () => ({
    handleColorChange: mocked.handleColorChange,
    handleResetColors: mocked.handleResetColors,
  }),
}))

vi.mock('@/features/options/hooks/useCategories', () => ({
  useCategories: () => ({
    handleCategoryKeyDown: mocked.handleCategoryKeyDown,
  }),
}))

vi.mock('@/features/options/hooks/useAutoDeletePeriod', () => ({
  useAutoDeletePeriod: () => mocked.useAutoDeletePeriodResult,
}))

const importBootstrapModule = async () => {
  vi.resetModules()
  return import('./main')
}

const resetHookState = () => {
  mocked.updateSetting.mockResolvedValue(true)
  mocked.handleColorChange.mockReset()
  mocked.handleResetColors.mockReset()
  mocked.hideConfirmation.mockReset()
  mocked.inputProps = []
  mocked.selectContentProps = []
  mocked.addExcludePattern.mockResolvedValue(true)
  mocked.removeExcludePattern.mockResolvedValue(undefined)
  mocked.useSettingsResult = {
    addExcludePattern: mocked.addExcludePattern,
    excludePatternInput: '',
    handleExcludePatternInputChange: mocked.handleExcludePatternInputChange,
    isLoading: false,
    removeExcludePattern: mocked.removeExcludePattern,
    setSettings: mocked.setSettings,
    settings: mocked.settings,
    setExcludePatternInput: mocked.setExcludePatternInput,
    updateSetting: mocked.updateSetting,
  }
  mocked.useAutoDeletePeriodResult = {
    confirmationState: {
      isVisible: true,
      message: '確認メッセージ',
      onConfirm: mocked.confirmationConfirm,
    },
    handleAutoDeletePeriodChange: mocked.handleSelectAutoDelete,
    hideConfirmation: mocked.hideConfirmation,
    pendingAutoDeletePeriod: null,
    prepareAutoDeletePeriod: vi.fn(),
  }
}

describe('options route behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHookState()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://id/${path}`),
      },
    } as unknown as typeof chrome
    vi.spyOn(window, 'open').mockImplementation(vi.fn() as never)
  })

  it('loading 中はローディング表示を返す', () => {
    mocked.useSettingsResult.isLoading = true

    render(createElement(OptionsPage))

    expect(screen.getByText('読み込み中...')).toBeTruthy()
  })

  it('各種ハンドラを UI から呼び出す', () => {
    render(createElement(OptionsPage))

    fireEvent.click(
      screen.getAllByTestId('mock-select-change')[0] as HTMLElement,
    )
    expect(mocked.updateSetting).toHaveBeenCalledWith(
      'clickBehavior',
      'saveWindowTabs',
    )

    fireEvent.click(
      screen.getByLabelText(
        '保存したタブを開いた後、リストから自動的に削除する',
      ),
    )
    fireEvent.click(
      screen.getByLabelText(
        '別ブラウザへドラッグ&ドロップした後、リストから自動的に削除する',
      ),
    )
    fireEvent.click(screen.getByLabelText('固定タブ（ピン留め）を除外する'))
    fireEvent.click(screen.getByLabelText('バックグラウンドタブで開く'))
    fireEvent.click(
      screen.getByLabelText('すべてのタブを新しいウィンドウで開く'),
    )
    fireEvent.click(screen.getByLabelText('保存日時を表示する'))
    fireEvent.click(screen.getByLabelText('タブ削除前に確認する'))
    fireEvent.click(screen.getByLabelText('すべて削除前に確認する'))

    expect(mocked.updateSetting).toHaveBeenCalledWith(
      'removeTabAfterOpen',
      true,
    )
    expect(mocked.updateSetting).toHaveBeenCalledWith(
      'removeTabAfterExternalDrop',
      true,
    )
    expect(mocked.updateSetting).toHaveBeenCalledWith('excludePinnedTabs', true)
    expect(mocked.updateSetting).toHaveBeenCalledWith(
      'openUrlInBackground',
      true,
    )
    expect(mocked.updateSetting).toHaveBeenCalledWith(
      'openAllInNewWindow',
      true,
    )
    expect(mocked.updateSetting).toHaveBeenCalledWith('showSavedTime', true)
    expect(mocked.updateSetting).toHaveBeenCalledWith('confirmDeleteEach', true)
    expect(mocked.updateSetting).toHaveBeenCalledWith('confirmDeleteAll', true)

    const excludeInput = screen.getByPlaceholderText('例: chrome-extension://')
    fireEvent.change(excludeInput, {
      target: { value: 'https://example.com' },
    })
    expect(mocked.handleExcludePatternInputChange).toHaveBeenCalledTimes(1)
    fireEvent.blur(excludeInput)
    expect(mocked.addExcludePattern).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '除外パターンを追加' }))
    expect(mocked.addExcludePattern).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(excludeInput, { key: 'Enter' })
    expect(mocked.addExcludePattern).toHaveBeenCalledTimes(3)

    fireEvent.click(
      screen.getByRole('button', { name: '除外パターン chrome:// を削除' }),
    )
    expect(mocked.removeExcludePattern).toHaveBeenCalledWith('chrome://')

    fireEvent.click(screen.getByRole('button', { name: 'リセット' }))
    expect(mocked.handleResetColors).toHaveBeenCalledTimes(1)

    const colorInput = document.querySelector('input[type="color"]')
    const hexInput = screen.getAllByPlaceholderText('例: #FF5733, #3366CC')[0]
    if (!colorInput) {
      throw new Error('color input not found')
    }
    fireEvent.input(colorInput, { target: { value: '#ffffff' } })
    fireEvent.change(colorInput, { target: { value: '#ffffff' } })
    fireEvent.change(hexInput as HTMLElement, { target: { value: '#000000' } })

    expect(mocked.handleColorChange).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'お問い合わせ' }))
    fireEvent.click(screen.getByRole('button', { name: 'リリースノート' }))

    expect(window.open).toHaveBeenCalledWith(
      'https://forms.gle/c9gBiF2TmgXaeU7J6',
      '_blank',
    )
    expect(window.open).toHaveBeenCalledWith(
      'chrome-extension://id/changelog.html',
      '_blank',
    )
  })

  it('Enter 以外のキー入力では除外パターンを追加しない', () => {
    render(createElement(OptionsPage))

    fireEvent.keyDown(
      screen.getAllByPlaceholderText(
        '例: chrome-extension://',
      )[0] as HTMLElement,
      {
        key: 'Escape',
      },
    )

    expect(mocked.addExcludePattern).not.toHaveBeenCalled()
  })
})

describe('options bootstrap redirect', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('redirect helper は options entrypoint を app route へ変換する', async () => {
    const { redirectToApp } = await importBootstrapModule()
    const replace = vi.fn()

    expect(redirectToApp('/options.html', '', replace)).toBe(
      'app.html#/options',
    )
    expect(replace).toHaveBeenCalledWith('app.html#/options')
  })

  it('DOMContentLoaded の redirect handler を登録する', async () => {
    let domReadyHandler: EventListener | undefined

    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      callback: EventListenerOrEventListenerObject | null,
    ) => {
      if (type === 'DOMContentLoaded' && typeof callback === 'function') {
        domReadyHandler = callback
      }
    }) as typeof document.addEventListener)

    await importBootstrapModule()

    expect(domReadyHandler).toBeTypeOf('function')
  })
})
