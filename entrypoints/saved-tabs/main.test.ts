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

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/features/ai-chat/components/SavedTabsChatWidget', () => ({
  SavedTabsChatWidget: ({
    onOpenChange,
  }: {
    onOpenChange?: (isOpen: boolean) => void
  }) =>
    createElement(
      'div',
      null,
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
    ),
}))

import { SavedTabsPage } from './main'

describe('saved-tabs entrypoint', () => {
  beforeEach(() => {
    resizeObserverState.reset()
    window.history.replaceState({}, '', '/saved-tabs.html')
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
    render(createElement(SavedTabsPage))

    expect(screen.getByTestId('saved-tabs-page-layout')).toBeTruthy()
    expect(screen.getByText('SavedTabsApp:false:domain')).toBeTruthy()
    expect(screen.getByText('open-sidebar')).toBeTruthy()
    expect(screen.getByText('チャット')).toBeTruthy()
    expect(screen.getByText('定期実行')).toBeTruthy()
    expect(screen.getAllByText('タブ一覧').length).toBeGreaterThan(0)
    expect(screen.getByText('ドメインモード')).toBeTruthy()
    expect(screen.getByText('カスタムモード')).toBeTruthy()
  })

  it('URL の mode クエリを SavedTabsApp の初期モードへ渡す', () => {
    window.history.replaceState({}, '', '/saved-tabs.html?mode=custom')

    render(createElement(SavedTabsPage))

    expect(screen.getByText('SavedTabsApp:false:custom')).toBeTruthy()
  })

  it('viewport 固定の split layout にして root document はスクロールさせない', () => {
    render(createElement(SavedTabsPage))

    const layout = screen.getByTestId('saved-tabs-page-layout')
    const leftPane = screen.getByTestId('saved-tabs-left-pane')

    expect(layout.className.includes('h-screen')).toBe(true)
    expect(layout.className.includes('overflow-hidden')).toBe(true)
    expect(leftPane.className.includes('overflow-y-auto')).toBe(true)
    expect(leftPane.className.includes('overscroll-contain')).toBe(true)
  })

  it('AI サイドバーの open 状態を SavedTabsApp へ渡す', () => {
    render(createElement(SavedTabsPage))

    fireEvent.click(screen.getByText('open-sidebar'))
    expect(screen.getByText('SavedTabsApp:true:domain')).toBeTruthy()

    fireEvent.click(screen.getByText('close-sidebar'))
    expect(screen.getByText('SavedTabsApp:false:domain')).toBeTruthy()
  })

  it('左ペインの実幅に応じて responsive layout 状態を切り替える', () => {
    render(createElement(SavedTabsPage))

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

    const { unmount } = render(createElement(SavedTabsPage))

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
