import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resizeObserverState = vi.hoisted(() => {
  const instances: Array<{
    callback: ResizeObserverCallback
    disconnect: ReturnType<typeof vi.fn>
    observe: ReturnType<typeof vi.fn>
  }> = []

  class MockResizeObserver {
    callback: ResizeObserverCallback
    disconnect = vi.fn()
    observe = vi.fn()

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
      instances.push(this)
    }
  }

  return {
    MockResizeObserver,
    emit(width: number) {
      const instance = instances.at(-1)
      if (!instance) {
        throw new Error('ResizeObserver instance not found')
      }

      instance.callback(
        [
          {
            contentRect: { width } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        instance as unknown as ResizeObserver,
      )
    },
    emitEmpty() {
      const instance = instances.at(-1)
      if (!instance) {
        throw new Error('ResizeObserver instance not found')
      }

      instance.callback([], instance as unknown as ResizeObserver)
    },
    reset() {
      instances.length = 0
    },
  }
})

vi.mock('@/features/saved-tabs/app/SavedTabsApp', () => ({
  SavedTabsApp: ({
    initialViewMode,
    isAiSidebarOpen,
  }: {
    initialViewMode?: string
    isAiSidebarOpen?: boolean
  }) =>
    createElement(
      'div',
      null,
      `SavedTabsApp:${String(Boolean(isAiSidebarOpen))}:${initialViewMode ?? 'none'}`,
    ),
  handleSavedTabsRender: vi.fn(),
  isDevProfileEnabled: false,
}))

const historyMock = vi.hoisted(() => ({
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  selectConversation: vi.fn(),
  updateMessages: vi.fn(),
  useSharedAiChatHistory: vi.fn(),
}))

vi.mock('@/features/ai-chat/hooks/useSharedAiChatHistory', () => ({
  useSharedAiChatHistory: historyMock.useSharedAiChatHistory,
}))

vi.mock('@/features/ai-chat/components/SavedTabsChatWidget', () => ({
  SavedTabsChatWidget: ({
    onDeleteHistoryItem,
    historyVariant,
    onSelectHistoryItem,
    onOpenChange,
    title,
  }: {
    historyVariant?: string
    onDeleteHistoryItem?: (conversationId: string) => void
    onSelectHistoryItem?: (conversationId: string) => void
    onOpenChange?: (isOpen: boolean) => void
    title?: string
  }) =>
    createElement(
      'div',
      null,
      createElement('div', null, `history-variant:${historyVariant ?? 'none'}`),
      createElement('div', null, `active-title:${title ?? ''}`),
      createElement(
        'button',
        {
          onClick: () => onOpenChange?.(true),
          type: 'button',
        },
        'open-sidebar',
      ),
      createElement(
        'button',
        {
          onClick: () => onOpenChange?.(false),
          type: 'button',
        },
        'close-sidebar',
      ),
      createElement(
        'button',
        {
          onClick: () => onDeleteHistoryItem?.('conversation-2'),
          type: 'button',
        },
        'delete-history',
      ),
      createElement(
        'button',
        {
          onClick: () => onSelectHistoryItem?.('conversation-2'),
          type: 'button',
        },
        'select-history',
      ),
    ),
}))

import { SavedTabsRoute } from './SavedTabsRoute'

describe('SavedTabsRoute', () => {
  beforeEach(() => {
    resizeObserverState.reset()
    window.history.replaceState({}, '', '/saved-tabs.html')
    historyMock.useSharedAiChatHistory.mockReturnValue({
      activeConversation: {
        createdAt: 1,
        id: 'conversation-1',
        messages: [
          {
            content: '最初の会話',
            id: 'message-1',
            role: 'user',
          },
        ],
        title: '最初の会話',
        updatedAt: 1,
      },
      createConversation: historyMock.createConversation,
      deleteConversation: historyMock.deleteConversation,
      historyItems: [
        {
          id: 'conversation-1',
          isActive: true,
          preview: '最初の会話',
          title: '最初の会話',
        },
        {
          id: 'conversation-2',
          isActive: false,
          preview: '別の会話',
          title: '別の会話',
        },
      ],
      isLoading: false,
      selectConversation: historyMock.selectConversation,
      updateMessages: historyMock.updateMessages,
    })
    vi.stubGlobal(
      'ResizeObserver',
      resizeObserverState.MockResizeObserver as unknown as typeof ResizeObserver,
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('SavedTabsApp と AI チャットウィジェットを split layout で描画する', () => {
    render(createElement(SavedTabsRoute))

    expect(screen.getByTestId('saved-tabs-page-layout')).toBeTruthy()
    expect(screen.getByText('SavedTabsApp:false:domain')).toBeTruthy()
    expect(screen.getByText('open-sidebar')).toBeTruthy()
    expect(screen.getByText('history-variant:dropdown')).toBeTruthy()
    expect(screen.getByText('active-title:最初の会話')).toBeTruthy()
  })

  it('URL の mode クエリを SavedTabsApp の初期モードへ渡す', () => {
    window.history.replaceState({}, '', '/saved-tabs.html?mode=custom')

    render(createElement(SavedTabsRoute))

    expect(screen.getByText('SavedTabsApp:false:custom')).toBeTruthy()
  })

  it('viewport 固定の split layout にして root document はスクロールさせない', () => {
    render(createElement(SavedTabsRoute))

    const layout = screen.getByTestId('saved-tabs-page-layout')
    const leftPane = screen.getByTestId('saved-tabs-left-pane')

    expect(layout.className.includes('h-screen')).toBe(true)
    expect(layout.className.includes('overflow-hidden')).toBe(true)
    expect(leftPane.className.includes('overflow-y-auto')).toBe(true)
    expect(leftPane.className.includes('overscroll-contain')).toBe(true)
  })

  it('AI サイドバーの open 状態を SavedTabsApp へ渡す', () => {
    render(createElement(SavedTabsRoute))

    fireEvent.click(screen.getByText('open-sidebar'))
    expect(screen.getByText('SavedTabsApp:true:domain')).toBeTruthy()

    fireEvent.click(screen.getByText('close-sidebar'))
    expect(screen.getByText('SavedTabsApp:false:domain')).toBeTruthy()
  })

  it('履歴選択を共通履歴 hook に委譲する', () => {
    render(createElement(SavedTabsRoute))

    fireEvent.click(screen.getByText('select-history'))

    expect(historyMock.selectConversation).toHaveBeenCalledWith(
      'conversation-2',
    )
  })

  it('履歴削除を共通履歴 hook に委譲する', () => {
    render(createElement(SavedTabsRoute))

    fireEvent.click(screen.getByText('delete-history'))

    expect(historyMock.deleteConversation).toHaveBeenCalledWith(
      'conversation-2',
    )
  })

  it('左ペインの実幅に応じて responsive layout 状態を切り替える', () => {
    render(createElement(SavedTabsRoute))

    const leftPane = screen.getByTestId('saved-tabs-left-pane')
    expect(leftPane.getAttribute('data-saved-tabs-layout')).toBe('full')

    act(() => {
      resizeObserverState.emit(window.innerWidth)
    })
    expect(leftPane.getAttribute('data-saved-tabs-layout')).toBe('full')

    act(() => {
      resizeObserverState.emit(900)
    })
    expect(leftPane.getAttribute('data-saved-tabs-layout')).toBe('compact')

    act(() => {
      resizeObserverState.emitEmpty()
    })
    expect(leftPane.getAttribute('data-saved-tabs-layout')).toBe('compact')

    act(() => {
      resizeObserverState.emit(1200)
    })
    expect(leftPane.getAttribute('data-saved-tabs-layout')).toBe('full')
  })

  it('ResizeObserver が無い環境では window resize を使って左ペイン幅を追従する', () => {
    vi.stubGlobal('ResizeObserver', undefined)

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(createElement(SavedTabsRoute))

    const leftPane = screen.getByTestId('saved-tabs-left-pane')
    const getBoundingClientRectSpy = vi.spyOn(leftPane, 'getBoundingClientRect')
    getBoundingClientRectSpy.mockReturnValue({
      width: 900,
    } as DOMRect)

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(leftPane.getAttribute('data-saved-tabs-layout')).toBe('compact')
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    )
  })
})
