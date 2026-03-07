import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_CHAT_TOOL_DEFINITIONS } from '@/constants/aiChatTools'
import type { UserSettings } from '@/types/storage'

const mocked = vi.hoisted(() => ({
  connectRuntimePort: vi.fn(),
  conversationScrollButtonClick: vi.fn(),
  conversationScrollButtonVisible: false,
  getUserSettings: vi.fn(),
  platformOs: 'mac',
  saveUserSettings: vi.fn(),
  sendRuntimeMessage: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  writeClipboardText: vi.fn(),
}))

vi.mock('@/lib/storage/settings', () => ({
  defaultSettings: {
    removeTabAfterOpen: true,
    removeTabAfterExternalDrop: true,
    excludePatterns: ['chrome-extension://', 'chrome://'],
    enableCategories: true,
    autoDeletePeriod: 'never',
    showSavedTime: false,
    clickBehavior: 'saveSameDomainTabs',
    excludePinnedTabs: true,
    openUrlInBackground: true,
    openAllInNewWindow: false,
    confirmDeleteAll: false,
    confirmDeleteEach: false,
    colors: {},
    aiChatEnabled: false,
    aiProvider: 'none',
    activeAiSystemPromptId: 'default-system-prompt',
    aiSystemPrompts: [
      {
        createdAt: 0,
        id: 'default-system-prompt',
        name: 'デフォルト',
        template:
          'あなたは TABBIN に保存された URL だけを根拠に答えるアシスタントです。',
        updatedAt: 0,
      },
    ],
    ollamaModel: '',
  },
  getUserSettings: mocked.getUserSettings,
  saveUserSettings: mocked.saveUserSettings,
}))

vi.mock('@/lib/browser/runtime', () => ({
  connectRuntimePort: mocked.connectRuntimePort,
  sendRuntimeMessage: mocked.sendRuntimeMessage,
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocked.toastError,
    success: mocked.toastSuccess,
  },
}))

vi.mock('@/components/ai-elements/conversation', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/ai-elements/conversation')
  >('@/components/ai-elements/conversation')

  return {
    ...actual,
    ConversationScrollButton: ({
      'aria-label': ariaLabel,
      className,
    }: {
      'aria-label'?: string
      className?: string
    }) =>
      mocked.conversationScrollButtonVisible ? (
        <button
          aria-label={ariaLabel}
          className={className}
          data-testid='conversation-scroll-button'
          onClick={() => {
            mocked.conversationScrollButtonClick()
          }}
          type='button'
        />
      ) : null,
  }
})

import { SavedTabsChatWidget } from './SavedTabsChatWidget'

type StorageListener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string,
) => void

const storageListeners: StorageListener[] = []

const createChromeMock = () =>
  ({
    runtime: {
      getPlatformInfo: vi.fn(
        (callback: (info: chrome.runtime.PlatformInfo) => void) => {
          callback({
            arch: 'x86-64',
            // biome-ignore lint/style/useNamingConvention: Chrome PlatformInfo uses nacl_arch
            nacl_arch: 'x86-64',
            os: mocked.platformOs as chrome.runtime.PlatformOs,
          })
        },
      ),
    },
    storage: {
      onChanged: {
        addListener: vi.fn((listener: StorageListener) => {
          storageListeners.push(listener)
        }),
        removeListener: vi.fn((listener: StorageListener) => {
          const index = storageListeners.indexOf(listener)
          if (index >= 0) {
            storageListeners.splice(index, 1)
          }
        }),
      },
    },
  }) as unknown as typeof chrome

const buildConfiguredSettings = (): UserSettings =>
  ({
    activeAiSystemPromptId: 'default-system-prompt',
    aiChatEnabled: false,
    aiProvider: 'none',
    aiSystemPrompts: [
      {
        createdAt: 0,
        id: 'default-system-prompt',
        name: 'デフォルト',
        template:
          'あなたは TABBIN に保存された URL だけを根拠に答えるアシスタントです。',
        updatedAt: 0,
      },
      {
        createdAt: 1,
        id: 'research-system-prompt',
        name: 'リサーチ',
        template: '保存 URL の比較観点を多めに出してください。',
        updatedAt: 1,
      },
    ],
    autoDeletePeriod: 'never',
    clickBehavior: 'saveSameDomainTabs',
    colors: {},
    confirmDeleteAll: false,
    confirmDeleteEach: false,
    enableCategories: true,
    excludePatterns: ['chrome://'],
    excludePinnedTabs: true,
    ollamaModel: 'llama3.2',
    openAllInNewWindow: false,
    openUrlInBackground: true,
    removeTabAfterExternalDrop: true,
    removeTabAfterOpen: true,
    showSavedTime: false,
  }) as UserSettings

describe('SavedTabsChatWidget', () => {
  beforeEach(() => {
    storageListeners.length = 0
    vi.clearAllMocks()
    mocked.connectRuntimePort.mockResolvedValue(null)
    mocked.conversationScrollButtonVisible = false
    mocked.platformOs = 'mac'
    mocked.saveUserSettings.mockResolvedValue(undefined)
    mocked.toastError.mockReset()
    mocked.toastSuccess.mockReset()
    mocked.writeClipboardText.mockResolvedValue(undefined)
    window.localStorage.clear()
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    )
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mocked.writeClipboardText,
      },
    })
    ;(globalThis as unknown as { chrome: typeof chrome }).chrome =
      createChromeMock()
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn((file: Blob) => {
          if (file.type === 'text/plain') {
            return 'data:text/plain;base64,SGVsbG8='
          }

          return 'data:application/octet-stream;base64,AAAA'
        }),
        revokeObjectURL: vi.fn(),
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('右下ランチャーからサイドバーを開ける', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    const onOpenChange = vi.fn()

    render(<SavedTabsChatWidget onOpenChange={onOpenChange} />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(screen.getByLabelText('AIチャットサイドバー')).toBeTruthy()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByText('(preview)Chat')).toBeTruthy()
    expect(screen.getByText('今月追加したURLを教えて')).toBeTruthy()
  })

  it('サイドバーの X ボタンで閉じられる', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    const onOpenChange = vi.fn()

    render(<SavedTabsChatWidget onOpenChange={onOpenChange} />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(screen.getByLabelText('AIチャットサイドバー')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'AIチャットを閉じる' }))

    expect(screen.queryByLabelText('AIチャットサイドバー')).toBeNull()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('ドラッグでサイドバー幅を変更し、次回表示時に復元する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
      writable: true,
    })

    const { unmount } = render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const sidebar = screen.getByLabelText('AIチャットサイドバー')
    const resizeHandle = screen.getByLabelText('AIチャットの幅を調整')

    expect(sidebar.style.width).toBe('420px')

    fireEvent.pointerDown(resizeHandle, { clientX: 780 })
    fireEvent.pointerMove(window, { clientX: 700 })
    fireEvent.pointerUp(window)

    expect(sidebar.style.width).toBe('500px')
    expect(window.localStorage.getItem('tabbin-ai-chat-sidebar-width')).toBe(
      '500',
    )

    unmount()

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(screen.getByLabelText('AIチャットサイドバー').style.width).toBe(
      '500px',
    )
  })

  it('狭い幅では送信ボタンをテキスト表示にして入力 UI を維持する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    window.localStorage.setItem('tabbin-ai-chat-sidebar-width', '320')

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(
      screen.getByRole('button', {
        name: '送信',
      }),
    ).toBeTruthy()
  })

  it('初期表示では説明文と候補質問を入力欄の近くにまとめて出す', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const intro = screen.getByTestId('ai-chat-intro')

    expect(within(intro).getByText('保存済みタブを質問できます。')).toBeTruthy()
    expect(within(intro).getByText('今月追加したURLを教えて')).toBeTruthy()
  })

  it('入力欄まわりは bottom dock として下端に寄せる', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(
      screen.getByTestId('ai-chat-bottom-dock').className.includes('mt-auto'),
    ).toBe(true)
  })

  it('会話領域で ConversationScrollButton を描画する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.conversationScrollButtonVisible = true

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const scrollButton = screen.getByRole('button', {
      name: '最新メッセージへ移動',
    })

    fireEvent.click(scrollButton)

    expect(mocked.conversationScrollButtonClick).toHaveBeenCalledTimes(1)
  })

  it('会話スクロール領域は overscroll を contain して左側へ伝播させない', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const log = screen.getByRole('log')
    const scrollContainer = log.firstElementChild

    expect(scrollContainer?.className.includes('overscroll-contain')).toBe(true)
  })

  it('チャット shell 自体も独立した scroll 領域として左側へ伝播させない', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const sidebar = screen.getByLabelText('AIチャットサイドバー')
    const shell = sidebar.parentElement

    expect(shell?.className.includes('h-screen')).toBe(true)
    expect(shell?.className.includes('overflow-hidden')).toBe(true)
    expect(shell?.className.includes('overscroll-none')).toBe(true)
  })

  it('ヘッダーではモデル名 badge を表示しない', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(screen.queryByText('Ollama: llama3.2')).toBeNull()
  })

  it('ヘッダーのタイトルはサイドバー中央に寄せる', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(
      screen.getByText('(preview)Chat').className.includes('justify-center'),
    ).toBe(true)
  })

  it('ヘッダー左に system prompt 設定アイコンと selector を表示する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(
      screen.getByRole('button', { name: 'システムプロンプト設定を開く' }),
    ).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'デフォルト' })).toBeTruthy()
  })

  it('chrome.storage.onChanged で userSettings が変わると再読み込みなしで反映する', async () => {
    const initialSettings = buildConfiguredSettings()
    const importedSettings = {
      ...buildConfiguredSettings(),
      activeAiSystemPromptId: 'imported-system-prompt',
      aiSystemPrompts: [
        ...(buildConfiguredSettings().aiSystemPrompts ?? []),
        {
          createdAt: 2,
          id: 'imported-system-prompt',
          name: 'インポート済み',
          template: 'インポートしたシステムプロンプト',
          updatedAt: 2,
        },
      ],
      ollamaModel: 'qwen3:latest',
    } satisfies UserSettings
    mocked.getUserSettings.mockResolvedValue(initialSettings)

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(screen.getByRole('combobox', { name: 'デフォルト' })).toBeTruthy()

    storageListeners[0](
      {
        userSettings: {
          oldValue: initialSettings,
          newValue: importedSettings,
        },
      },
      'local',
    )

    expect(
      await screen.findByRole('combobox', { name: 'インポート済み' }),
    ).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'qwen3:latest' })).toBeTruthy()
  })

  it('システムプロンプト設定モーダルを開き、新規作成と複製を保存できる', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'システムプロンプト設定を開く' }),
    )

    expect(
      await screen.findByRole('dialog', { name: 'システムプロンプト管理' }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '新規作成' }))

    fireEvent.change(screen.getByLabelText('プロンプト名'), {
      target: { value: '分析用' },
    })
    fireEvent.change(screen.getByLabelText('システムプロンプト本文'), {
      target: { value: '保存傾向を分析してください。' },
    })

    fireEvent.click(screen.getByRole('button', { name: '複製' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mocked.saveUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          aiSystemPrompts: expect.arrayContaining([
            expect.objectContaining({
              name: '分析用',
              template: '保存傾向を分析してください。',
            }),
            expect.objectContaining({
              name: expect.stringContaining('分析用'),
            }),
          ]),
        }),
      )
    })
  })

  it('システムプロンプト管理に利用できるツール一覧を表示する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'システムプロンプト設定を開く' }),
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'システムプロンプト管理',
    })

    expect(within(dialog).getByText('利用できるツール')).toBeTruthy()

    for (const toolDefinition of AI_CHAT_TOOL_DEFINITIONS) {
      expect(
        within(dialog).getByText(toolDefinition.name, {
          exact: false,
        }),
      ).toBeTruthy()
      expect(within(dialog).getByText(toolDefinition.description)).toBeTruthy()
    }
  })

  it('システムプロンプト selector 切替で active preset を保存し、会話をリセットする', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.sendRuntimeMessage.mockResolvedValue({
      answer: '最初の返答',
      recordCount: 1,
      status: 'ok',
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '今月追加したURLを教えて',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('最初の返答')).toBeTruthy()

    fireEvent.click(screen.getByRole('combobox', { name: 'デフォルト' }))
    fireEvent.click(await screen.findByRole('option', { name: 'リサーチ' }))

    await waitFor(() => {
      expect(mocked.saveUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          activeAiSystemPromptId: 'research-system-prompt',
        }),
      )
    })

    expect(screen.queryByText('最初の返答')).toBeNull()
    expect(screen.getByTestId('ai-chat-intro')).toBeTruthy()
  })

  it('system prompt が50件なら新規作成と複製を無効化する', async () => {
    mocked.getUserSettings.mockResolvedValue({
      ...buildConfiguredSettings(),
      activeAiSystemPromptId: 'prompt-1',
      aiSystemPrompts: Array.from({ length: 50 }, (_, index) => ({
        createdAt: index,
        id: `prompt-${index + 1}`,
        name: `Prompt ${index + 1}`,
        template: `template ${index + 1}`,
        updatedAt: index,
      })),
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'システムプロンプト設定を開く' }),
    )

    const createButton = await screen.findByRole('button', { name: '新規作成' })
    const duplicateButton = screen.getByRole('button', { name: '複製' })

    expect(createButton.hasAttribute('disabled')).toBe(true)
    expect(duplicateButton.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('50 / 50')).toBeTruthy()
  })

  it('system prompt の name/body 未入力や重複名では保存を無効化する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'システムプロンプト設定を開く' }),
    )

    const saveButton = await screen.findByRole('button', { name: '保存' })

    expect(saveButton.hasAttribute('disabled')).toBe(false)

    fireEvent.change(screen.getByLabelText('プロンプト名'), {
      target: { value: '' },
    })

    expect(saveButton.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('プロンプト名'), {
      target: { value: 'デフォルト' },
    })
    fireEvent.change(screen.getByLabelText('システムプロンプト本文'), {
      target: { value: '' },
    })

    expect(saveButton.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('システムプロンプト本文'), {
      target: { value: '保存 URL の比較観点を多めに出してください。' },
    })
    fireEvent.click(screen.getByText('リサーチ'))
    fireEvent.change(screen.getByLabelText('プロンプト名'), {
      target: { value: 'デフォルト' },
    })

    expect(saveButton.hasAttribute('disabled')).toBe(true)
    expect(mocked.saveUserSettings).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('プロンプト名'), {
      target: { value: 'リサーチ詳細' },
    })

    expect(saveButton.hasAttribute('disabled')).toBe(false)

    const nameInput = screen.getByLabelText('プロンプト名') as HTMLInputElement

    expect(nameInput.maxLength).toBe(25)

    fireEvent.change(nameInput, {
      target: { value: 'a'.repeat(26) },
    })

    expect(saveButton.hasAttribute('disabled')).toBe(true)
  })

  it('選択中 prompt の複製と削除はプロンプト名入力の右側に表示する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'システムプロンプト設定を開く' }),
    )

    const nameRow = await screen.findByTestId('system-prompt-name-row')

    expect(within(nameRow).getByLabelText('プロンプト名')).toBeTruthy()
    expect(within(nameRow).getByRole('button', { name: '複製' })).toBeTruthy()
    expect(within(nameRow).getByRole('button', { name: '削除' })).toBeTruthy()
  })

  it('左側の system prompt 一覧は長い名前を省略表示にする', async () => {
    const longName =
      'とても長いシステムプロンプト名が入ったときに一覧では省略表示されることを確認するための名前'
    const normalizedLongName = longName.slice(0, 25)

    mocked.getUserSettings.mockResolvedValue({
      ...buildConfiguredSettings(),
      aiSystemPrompts: [
        buildConfiguredSettings().aiSystemPrompts?.[0] as NonNullable<
          UserSettings['aiSystemPrompts']
        >[number],
        {
          createdAt: 2,
          id: 'long-system-prompt',
          name: longName,
          template: 'long template',
          updatedAt: 2,
        },
      ],
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'システムプロンプト設定を開く' }),
    )

    const listItemButton = await screen.findByRole('button', {
      name: normalizedLongName,
    })
    const listItemName = within(listItemButton).getByText(normalizedLongName)
    const listItemRow = listItemName.parentElement

    expect(listItemButton.className.includes('overflow-hidden')).toBe(true)
    expect(listItemName.className.includes('truncate')).toBe(true)
    expect(listItemRow?.className.includes('min-w-0')).toBe(true)
  })

  it('新しい会話はアイコンボタンで表示し、tooltip でラベルを出す', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const resetButton = screen.getByRole('button', { name: '新しい会話' })

    expect(screen.queryByText('新しい会話')).toBeNull()

    fireEvent.focus(resetButton)

    expect((await screen.findByRole('tooltip')).textContent).toBe('新しい会話')
  })

  it('ヘッダーのコピーアイコンを押すと会話全文を clipboard に書き込む', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    let handlePortMessage: ((message: unknown) => void) | undefined
    const port = {
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(listener => {
          handlePortMessage = listener
        }),
      },
      postMessage: vi.fn(),
    }
    mocked.connectRuntimePort.mockResolvedValue(port)

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '今月追加したURLを教えて',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith({
        history: [],
        prompt: '今月追加したURLを教えて',
        type: 'run',
      })
    })

    handlePortMessage?.({
      answer: '今月追加した URL は https://react.dev/learn です。',
      reasoning: '- 質問の解釈: 月別に追加された URL の確認',
      recordCount: 1,
      toolTraces: [],
      type: 'complete',
    })

    expect(
      await screen.findByText((_, element) =>
        Boolean(
          element?.tagName === 'P' &&
            element.textContent ===
              '今月追加した URL は https://react.dev/learn です。',
        ),
      ),
    ).toBeTruthy()

    const copyButton = screen.getByRole('button', { name: '会話をコピー' })

    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(mocked.writeClipboardText).toHaveBeenCalledWith(
        [
          'ユーザー:',
          '今月追加したURLを教えて',
          '',
          'AI:',
          '今月追加した URL は https://react.dev/learn です。',
        ].join('\n'),
      )
    })
    expect(mocked.toastSuccess).toHaveBeenCalledWith('会話をコピーしました')
    expect(copyButton.getAttribute('data-state')).toBe('copied')
  })

  it('新しい会話を押すと履歴をリセットして初期状態へ戻す', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.sendRuntimeMessage.mockResolvedValue({
      answer: '最初の返答',
      recordCount: 1,
      status: 'ok',
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '今月追加したURLを教えて',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('最初の返答')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '新しい会話' }))

    expect(screen.queryByText('最初の返答')).toBeNull()
    expect(screen.getByTestId('ai-chat-intro')).toBeTruthy()
    expect(
      (screen.getByLabelText('AIに質問する') as HTMLTextAreaElement).value,
    ).toBe('')
  })

  it('新しい会話を押すと進行中の stream を切断する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    const port = {
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
      postMessage: vi.fn(),
    }
    mocked.connectRuntimePort.mockResolvedValue(port)

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '今月追加したURLを教えて',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith({
        history: [],
        prompt: '今月追加したURLを教えて',
        type: 'run',
      })
    })

    fireEvent.click(screen.getByRole('button', { name: '新しい会話' }))

    expect(port.disconnect).toHaveBeenCalled()
    expect(screen.getByTestId('ai-chat-intro')).toBeTruthy()
  })

  it('質問を送ると assistant 返答を描画する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    let handlePortMessage: ((message: unknown) => void) | undefined
    const port = {
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(listener => {
          handlePortMessage = listener
        }),
      },
      postMessage: vi.fn(),
    }
    mocked.connectRuntimePort.mockResolvedValue(port)

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '今月追加したURLを教えて',
      },
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Submit',
      }),
    )

    await waitFor(() => {
      expect(mocked.connectRuntimePort).toHaveBeenCalledWith('ai-chat-stream')
      expect(port.postMessage).toHaveBeenCalledWith({
        history: [],
        prompt: '今月追加したURLを教えて',
        type: 'run',
      })
    })

    handlePortMessage?.({
      reasoning: [
        '- 質問の解釈: 月別に追加された URL の確認',
        '- 使用ツール: 保存済み URL 一覧',
      ].join('\n'),
      toolTraces: [
        {
          input: {
            page: 1,
            pageSize: 10,
            sortDirection: 'desc',
          },
          output: [
            {
              url: 'https://react.dev/learn',
            },
          ],
          state: 'output-available',
          title: '保存済み URL 一覧',
          toolCallId: 'call-1',
          toolName: 'listSavedUrls',
          type: 'dynamic-tool',
        },
      ],
      type: 'step',
    })

    expect(screen.getByRole('button', { name: /Reasoning/i })).toBeTruthy()
    const sourcesTrigger = await screen.findByRole('button', {
      name: '参照ソース 1件',
    })
    expect(sourcesTrigger).toBeTruthy()
    fireEvent.click(sourcesTrigger)
    expect(
      await screen.findByRole('link', {
        name: 'https://react.dev/learn',
      }),
    ).toBeTruthy()
    expect(
      await screen.findAllByText(
        (_, element) =>
          element?.textContent?.includes('保存済み URL 一覧') ?? false,
      ),
    ).not.toHaveLength(0)
    expect(
      await screen.findAllByText(
        (_, element) =>
          element?.textContent?.includes('実行したツール') ?? false,
      ),
    ).not.toHaveLength(0)
    expect(screen.queryByText('Parameters')).toBeNull()

    fireEvent.click(
      screen.getByRole('button', {
        name: /保存済み URL 一覧/,
      }),
    )

    expect(await screen.findByText('Parameters')).toBeTruthy()

    handlePortMessage?.({
      answer: '今月追加した URL は https://react.dev/learn です。',
      reasoning: [
        '- 質問の解釈: 月別に追加された URL の確認',
        '- 使用ツール: 保存済み URL 一覧',
      ].join('\n'),
      recordCount: 1,
      toolTraces: [
        {
          input: {
            page: 1,
            pageSize: 10,
            sortDirection: 'desc',
          },
          output: [
            {
              url: 'https://react.dev/learn',
            },
          ],
          state: 'output-available',
          title: '保存済み URL 一覧',
          toolCallId: 'call-1',
          toolName: 'listSavedUrls',
          type: 'dynamic-tool',
        },
      ],
      type: 'complete',
    })

    expect(
      await screen.findByText((_, element) =>
        Boolean(
          element?.tagName === 'P' &&
            element.textContent ===
              '今月追加した URL は https://react.dev/learn です。',
        ),
      ),
    ).toBeTruthy()
    const reasoningTrigger = screen.getByRole('button', { name: /Reasoning/i })
    const answerText = screen.getByText((_, element) =>
      Boolean(
        element?.tagName === 'P' &&
          element.textContent ===
            '今月追加した URL は https://react.dev/learn です。',
      ),
    )

    expect(
      reasoningTrigger.compareDocumentPosition(answerText) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(port.disconnect).toHaveBeenCalled()
  })

  it('source URL は tool trace 間で重複しても 1 件にまとめて表示する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    let handlePortMessage: ((message: unknown) => void) | undefined
    const port = {
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(listener => {
          handlePortMessage = listener
        }),
      },
      postMessage: vi.fn(),
    }
    mocked.connectRuntimePort.mockResolvedValue(port)

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '最近保存したURLを見せて',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith({
        history: [],
        prompt: '最近保存したURLを見せて',
        type: 'run',
      })
    })

    handlePortMessage?.({
      answer: '最近保存した URL をまとめます。',
      reasoning: '- 使用ツール: 保存済み URL 一覧',
      recordCount: 2,
      toolTraces: [
        {
          input: {
            page: 1,
            pageSize: 10,
            sortDirection: 'desc',
          },
          output: {
            items: [
              {
                title: 'React Learn',
                url: 'https://react.dev/learn',
              },
              {
                title: 'Vite Guide',
                url: 'https://vite.dev/guide/',
              },
            ],
            totalItems: 2,
          },
          state: 'output-available',
          title: '保存済み URL 一覧',
          toolCallId: 'call-1',
          toolName: 'listSavedUrls',
          type: 'dynamic-tool',
        },
        {
          input: {
            page: 2,
            pageSize: 10,
            sortDirection: 'desc',
          },
          output: {
            items: [
              {
                title: 'React Learn',
                url: 'https://react.dev/learn',
              },
            ],
            totalItems: 2,
          },
          state: 'output-available',
          title: '保存済み URL 一覧',
          toolCallId: 'call-2',
          toolName: 'listSavedUrls',
          type: 'dynamic-tool',
        },
      ],
      type: 'complete',
    })

    const sourcesTrigger = await screen.findByRole('button', {
      name: '参照ソース 2件',
    })
    fireEvent.click(sourcesTrigger)

    const sourcesGroup =
      (sourcesTrigger.closest('[data-slot="sources"]') as HTMLElement | null) ??
      document.body

    expect(
      within(sourcesGroup).getAllByRole('link', {
        name: 'React Learn',
      }),
    ).toHaveLength(1)
    expect(
      within(sourcesGroup).getByRole('link', {
        name: 'Vite Guide',
      }),
    ).toBeTruthy()
  })

  it('回答待ちでも入力はできるが送信はできない', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    const port = {
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(),
      },
      postMessage: vi.fn(),
    }
    mocked.connectRuntimePort.mockResolvedValue(port)

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '今月追加したURLを教えて',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith({
        history: [],
        prompt: '今月追加したURLを教えて',
        type: 'run',
      })
    })

    const textarea = screen.getByLabelText(
      'AIに質問する',
    ) as HTMLTextAreaElement
    const submitButton = screen.getByRole('button', { name: 'Submit' })

    expect(textarea.disabled).toBe(false)
    expect((submitButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(textarea, {
      target: {
        value: '続けて質問したい内容',
      },
    })

    expect(textarea.value).toBe('続けて質問したい内容')

    fireEvent.click(submitButton)

    expect(port.postMessage).toHaveBeenCalledTimes(1)
  })

  it('入力欄フッターのモデル selector を開くと Ollama からモデル一覧を取得する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.sendRuntimeMessage.mockResolvedValue({
      models: [
        {
          label: 'llama3.2 (8B)',
          name: 'llama3.2',
        },
      ],
      status: 'ok',
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'llama3.2' }))

    await waitFor(() => {
      expect(mocked.sendRuntimeMessage).toHaveBeenCalledWith({
        action: 'listOllamaModels',
      })
    })

    expect(
      screen.queryByRole('dialog', { name: 'Ollamaモデルを選択' }),
    ).toBeNull()
    expect(await screen.findAllByText('llama3.2 (8B)')).not.toHaveLength(0)
  })

  it('候補質問を押すと即送信され、2回目の送信では履歴を渡す', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.sendRuntimeMessage
      .mockResolvedValueOnce({
        answer: '最初の返答',
        recordCount: 1,
        status: 'ok',
      })
      .mockResolvedValueOnce({
        answer: '2回目の返答',
        recordCount: 1,
        status: 'ok',
      })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.click(screen.getByText('今月追加したURLを教えて'))

    await waitFor(() => {
      expect(mocked.sendRuntimeMessage).toHaveBeenNthCalledWith(1, {
        action: 'runAiChat',
        history: [],
        prompt: '今月追加したURLを教えて',
      })
    })

    expect(
      (screen.getByLabelText('AIに質問する') as HTMLTextAreaElement).value,
    ).toBe('')

    expect(await screen.findByText('最初の返答')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: { value: '続けて教えて' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(mocked.sendRuntimeMessage).toHaveBeenNthCalledWith(2, {
        action: 'runAiChat',
        history: [
          {
            content: '今月追加したURLを教えて',
            role: 'user',
          },
          {
            content: '最初の返答',
            role: 'assistant',
          },
        ],
        prompt: '続けて教えて',
      })
    })
  })

  it('応答が失敗したときは fallback エラーを assistant メッセージとして出す', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.sendRuntimeMessage.mockResolvedValue({
      status: 'error',
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '最近よく保存しているジャンルは？',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(
      await screen.findAllByText('AI からの応答を取得できませんでした。'),
    ).toHaveLength(2)
  })

  it('stream の Ollama 403 エラーでは macOS 向け設定案内と FAQ リンクを表示する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.platformOs = 'mac'
    let handlePortMessage: ((message: unknown) => void) | undefined
    const port = {
      disconnect: vi.fn(),
      onDisconnect: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn(listener => {
          handlePortMessage = listener
        }),
      },
      postMessage: vi.fn(),
    }
    mocked.connectRuntimePort.mockResolvedValue(port)

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '最近よく保存しているジャンルは？',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith({
        history: [],
        prompt: '最近よく保存しているジャンルは？',
        type: 'run',
      })
    })

    handlePortMessage?.({
      error: 'Ollama が拡張機能からのアクセスを拒否しました (403 Forbidden)。',
      ollamaError: {
        allowedOrigins: 'chrome-extension://test-extension-id',
        baseUrl: 'http://localhost:11434',
        downloadUrl: 'https://ollama.com/download',
        faqUrl: 'https://docs.ollama.com/faq#how-do-i-configure-ollama-server',
        kind: 'forbidden',
        tagsUrl: 'http://localhost:11434/api/tags',
      },
      type: 'error',
    })

    expect(
      await screen.findAllByText(
        'launchctl setenv OLLAMA_ORIGINS "chrome-extension://test-extension-id"',
      ),
    ).toHaveLength(2)
    expect(
      screen.getAllByText('chrome-extension://test-extension-id'),
    ).not.toHaveLength(0)
    expect(
      screen.getAllByRole('link', {
        name: 'https://docs.ollama.com/faq#how-do-i-configure-ollama-server',
      }),
    ).toHaveLength(2)
  })

  it('設定取得に失敗しても未設定として扱い、close ボタンで閉じる', async () => {
    mocked.getUserSettings.mockRejectedValue(new Error('failed to load'))

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(
      screen.getByPlaceholderText('左下で Ollama モデルを選択してください'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'AIチャットを閉じる' }))
    expect(screen.queryByText('Chat')).toBeNull()
  })

  it('空入力では送信しない', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const form = screen.getByLabelText('AIに質問する').closest('form')
    if (!form) {
      throw new Error('form not found')
    }

    fireEvent.submit(form)
    expect(mocked.sendRuntimeMessage).not.toHaveBeenCalled()
  })

  it('Enter では送信せず改行する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const textarea = screen.getByLabelText(
      'AIに質問する',
    ) as HTMLTextAreaElement

    fireEvent.change(textarea, {
      target: {
        value: 'first',
      },
    })
    textarea.focus()
    textarea.setSelectionRange(5, 5)
    fireEvent.keyDown(textarea, {
      code: 'Enter',
      key: 'Enter',
    })

    await waitFor(() => {
      expect(textarea.value).toBe('first\n')
    })
    expect(mocked.sendRuntimeMessage).not.toHaveBeenCalled()
  })

  it('Ctrl+Enter で送信する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.sendRuntimeMessage.mockResolvedValue({
      answer: 'Ctrl 送信の返答',
      recordCount: 1,
      status: 'ok',
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const textarea = screen.getByLabelText(
      'AIに質問する',
    ) as HTMLTextAreaElement

    fireEvent.change(textarea, {
      target: {
        value: 'Ctrl submit',
      },
    })
    fireEvent.keyDown(textarea, {
      code: 'Enter',
      ctrlKey: true,
      key: 'Enter',
    })

    await waitFor(() => {
      expect(mocked.sendRuntimeMessage).toHaveBeenCalledWith({
        action: 'runAiChat',
        history: [],
        prompt: 'Ctrl submit',
      })
    })
    expect(await screen.findByText('Ctrl 送信の返答')).toBeTruthy()
  })

  it('左下の添付から text ファイルを選ぶと会話に使う payload で送信する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.sendRuntimeMessage.mockResolvedValue({
      answer: '添付を読みました',
      recordCount: 1,
      status: 'ok',
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    const uploadInput = screen.getByLabelText('Upload files')
    fireEvent.change(uploadInput, {
      target: {
        files: [new File(['Hello'], 'memo.txt', { type: 'text/plain' })],
      },
    })

    expect(await screen.findByText('memo.txt')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('AIに質問する'), {
      target: {
        value: '添付を要約して',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(mocked.sendRuntimeMessage).toHaveBeenCalledWith({
        action: 'runAiChat',
        attachments: [
          {
            content: 'Hello',
            filename: 'memo.txt',
            kind: 'text',
            mediaType: 'text/plain',
          },
        ],
        history: [],
        prompt: '添付を要約して',
      })
    })

    expect(await screen.findByText('添付を読みました')).toBeTruthy()
  })

  it('未設定ならチャット内でモデルを選んで保存できる', async () => {
    mocked.getUserSettings.mockResolvedValue({
      ...buildConfiguredSettings(),
      ollamaModel: '',
    })
    mocked.sendRuntimeMessage.mockResolvedValue({
      models: [
        {
          label: 'llama3.2 (8B)',
          name: 'llama3.2',
        },
      ],
      status: 'ok',
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    expect(
      (screen.getByLabelText('AIに質問する') as HTMLTextAreaElement).disabled,
    ).toBe(true)

    expect(
      screen.queryByRole('button', { name: 'モデル一覧を取得' }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('combobox', { name: 'モデルを選択' }))

    await waitFor(() => {
      expect(mocked.sendRuntimeMessage).toHaveBeenCalledWith({
        action: 'listOllamaModels',
      })
    })

    fireEvent.click(
      await screen.findByRole('option', { name: 'llama3.2 (8B)' }),
    )

    await waitFor(() => {
      expect(mocked.saveUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          aiProvider: 'ollama',
          ollamaModel: 'llama3.2',
        }),
      )
    })

    await waitFor(() => {
      expect(
        (screen.getByLabelText('AIに質問する') as HTMLTextAreaElement).disabled,
      ).toBe(false)
    })
    expect(screen.queryByText('Ollama: llama3.2')).toBeNull()
  })

  it('モデル一覧取得の Ollama 接続エラーでは Windows 向け案内とダウンロードリンクを表示する', async () => {
    mocked.getUserSettings.mockResolvedValue(buildConfiguredSettings())
    mocked.platformOs = 'win'
    mocked.sendRuntimeMessage.mockResolvedValue({
      error: 'Ollama に接続できませんでした。',
      ollamaError: {
        allowedOrigins: 'chrome-extension://test-extension-id',
        baseUrl: 'http://localhost:11434',
        downloadUrl: 'https://ollama.com/download',
        faqUrl: 'https://docs.ollama.com/faq#how-do-i-configure-ollama-server',
        kind: 'notInstalledOrNotRunning',
        tagsUrl: 'http://localhost:11434/api/tags',
      },
      status: 'error',
    })

    render(<SavedTabsChatWidget />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'AIチャットを開く',
      }),
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'llama3.2' }))

    await waitFor(() => {
      expect(mocked.sendRuntimeMessage).toHaveBeenCalledWith({
        action: 'listOllamaModels',
      })
    })

    expect(
      await screen.findByText(
        'Windows では OLLAMA_ORIGINS を環境変数として設定してください。',
      ),
    ).toBeTruthy()
    expect(
      screen.getByText('chrome-extension://test-extension-id'),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: 'https://ollama.com/download',
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: 'https://docs.ollama.com/faq#how-do-i-configure-ollama-server',
      }),
    ).toBeTruthy()
  })
})
