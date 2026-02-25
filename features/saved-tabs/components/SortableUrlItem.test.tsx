// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SortableUrlItemProps } from '@/types/saved-tabs'
import type { UserSettings } from '@/types/storage'

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
  })),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}))

vi.mock('@/utils/datetime', () => ({
  formatDatetime: vi.fn((timestamp?: number) => `formatted:${timestamp}`),
  TimeRemaining: ({
    savedAt,
    autoDeletePeriod,
  }: {
    savedAt?: number
    autoDeletePeriod?: string
  }) => (
    <span data-testid='time-remaining'>
      remaining:{savedAt}:{autoDeletePeriod}
    </span>
  ),
}))

import { formatDatetime } from '@/utils/datetime'
import { SortableUrlItem } from './SortableUrlItem'

const sendMessageMock = vi.fn()

const defaultSettings: UserSettings = {
  removeTabAfterOpen: true,
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
}

const createProps = (
  overrides: Partial<SortableUrlItemProps> = {},
): SortableUrlItemProps => ({
  url: 'https://example.com',
  title: 'Example Tab',
  id: 'url-item-1',
  groupId: 'group-1',
  handleDeleteUrl: vi.fn(),
  handleOpenTab: vi.fn(),
  handleUpdateUrls: vi.fn(),
  settings: defaultSettings,
  ...overrides,
})

const getLink = () => screen.getByRole('link', { name: 'Example Tab' })

const getDeleteButton = () => screen.getByRole('button', { name: 'タブを削除' })

const getLatestMouseLeaveHandler = (
  removeEventListenerSpy: ReturnType<typeof vi.spyOn>,
) => {
  const call = [...removeEventListenerSpy.mock.calls]
    .reverse()
    .find(([eventName]) => eventName === 'mouseleave')

  if (!call || typeof call[1] !== 'function') {
    throw new Error('mouseleave handler was not captured')
  }

  return call[1] as EventListener
}

describe('SortableUrlItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})

    sendMessageMock.mockImplementation(
      (_message: unknown, callback?: (response: { ok: boolean }) => void) => {
        callback?.({ ok: true })
      },
    )

    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      runtime: {
        sendMessage: sendMessageMock,
      },
    } as unknown as typeof chrome
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('削除ボタンを初期描画時からDOMに保持し行hover/focus用クラスを持つ', () => {
    render(<SortableUrlItem {...createProps()} />)

    const deleteButton = getDeleteButton()
    expect(deleteButton).toBeTruthy()
    expect(deleteButton.className).toContain('group-hover:visible')
    expect(deleteButton.className).toContain('group-focus-within:visible')
    expect(deleteButton.className).toContain('pointer-events-none')

    const row = getLink().closest('li')
    expect(row).toBeTruthy()
    expect(row?.className).toContain('group')
  })

  it('confirmDeleteEachがfalseのとき削除ボタンで即時削除する', () => {
    const handleDeleteUrl = vi.fn()

    render(<SortableUrlItem {...createProps({ handleDeleteUrl })} />)

    fireEvent.click(getDeleteButton())

    expect(handleDeleteUrl).toHaveBeenCalledTimes(1)
    expect(handleDeleteUrl).toHaveBeenCalledWith(
      'group-1',
      'https://example.com',
    )
  })

  it('confirmDeleteEachがtrueのとき確認ダイアログを開き確定で削除する', async () => {
    const handleDeleteUrl = vi.fn()

    render(
      <SortableUrlItem
        {...createProps({
          handleDeleteUrl,
          settings: {
            ...defaultSettings,
            confirmDeleteEach: true,
          },
        })}
      />,
    )

    fireEvent.click(getDeleteButton())

    const confirmButton = await screen.findByRole('button', {
      name: '削除する',
    })
    fireEvent.click(confirmButton)

    expect(handleDeleteUrl).toHaveBeenCalledTimes(1)
    expect(handleDeleteUrl).toHaveBeenCalledWith(
      'group-1',
      'https://example.com',
    )
  })

  it('リンククリックで handleOpenTab を呼ぶ', () => {
    const handleOpenTab = vi.fn()

    render(<SortableUrlItem {...createProps({ handleOpenTab })} />)

    fireEvent.click(getLink())

    expect(handleOpenTab).toHaveBeenCalledTimes(1)
    expect(handleOpenTab).toHaveBeenCalledWith('https://example.com')
  })

  it('保存日時表示の各分岐を描画する', () => {
    const savedAt = 1700000000000
    const { rerender } = render(
      <SortableUrlItem
        {...createProps({
          savedAt,
          settings: {
            ...defaultSettings,
            showSavedTime: true,
          },
          autoDeletePeriod: 'never',
        })}
      />,
    )

    expect(vi.mocked(formatDatetime)).toHaveBeenCalledWith(savedAt)
    expect(screen.getByText(`formatted:${savedAt}`)).toBeTruthy()
    expect(screen.queryByTestId('time-remaining')).toBeNull()

    rerender(
      <SortableUrlItem
        {...createProps({
          savedAt,
          settings: {
            ...defaultSettings,
            showSavedTime: false,
          },
        })}
      />,
    )

    expect(screen.queryByText(`formatted:${savedAt}`)).toBeNull()
    expect(screen.queryByTestId('time-remaining')).toBeNull()

    rerender(
      <SortableUrlItem
        {...createProps({
          savedAt,
          settings: {
            ...defaultSettings,
            showSavedTime: false,
          },
          autoDeletePeriod: '1day',
        })}
      />,
    )

    expect(screen.getByTestId('time-remaining').textContent).toContain(
      `remaining:${savedAt}:1day`,
    )
  })

  it('ドラッグ開始でデータとメッセージを設定し、ドラッグ終了でクリーンアップする', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
    const dataTransfer = {
      setData: vi.fn(),
      dropEffect: 'move',
    }

    render(<SortableUrlItem {...createProps()} />)

    fireEvent.dragStart(getLink(), { dataTransfer })
    fireEvent.dragEnd(getLink(), { dataTransfer })

    expect(dataTransfer.setData).toHaveBeenNthCalledWith(
      1,
      'text/plain',
      'https://example.com',
    )
    expect(dataTransfer.setData).toHaveBeenNthCalledWith(
      2,
      'text/uri-list',
      'https://example.com',
    )
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'mouseleave',
      expect.any(Function),
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mouseleave',
      expect.any(Function),
    )
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'urlDragStarted',
        url: 'https://example.com',
        groupId: 'group-1',
      }),
      expect.any(Function),
    )
  })

  it('ドラッグ終了時に保留中タイマーをクリアする', async () => {
    vi.useFakeTimers()

    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const dataTransfer = {
      setData: vi.fn(),
      dropEffect: 'none',
    }

    const { rerender } = render(<SortableUrlItem {...createProps()} />)

    fireEvent.dragStart(getLink(), { dataTransfer })
    rerender(<SortableUrlItem {...createProps({ groupId: 'group-2' })} />)

    const mouseLeaveHandler = getLatestMouseLeaveHandler(removeEventListenerSpy)
    await act(async () => {
      mouseLeaveHandler(new Event('mouseleave'))
    })

    fireEvent.dragEnd(getLink(), { dataTransfer })

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('外部ドロップ判定タイマーの条件が不成立のとき削除メッセージを送らない', async () => {
    vi.useFakeTimers()

    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { rerender } = render(<SortableUrlItem {...createProps()} />)

    rerender(<SortableUrlItem {...createProps({ groupId: 'group-2' })} />)

    const mouseLeaveHandlerLeftWindowFalse = getLatestMouseLeaveHandler(
      removeEventListenerSpy,
    )

    await act(async () => {
      mouseLeaveHandlerLeftWindowFalse(new Event('mouseleave'))
    })

    rerender(<SortableUrlItem {...createProps({ groupId: 'group-3' })} />)

    const mouseLeaveHandlerDraggingFalse = getLatestMouseLeaveHandler(
      removeEventListenerSpy,
    )

    await act(async () => {
      mouseLeaveHandlerDraggingFalse(new Event('mouseleave'))
    })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(sendMessageMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'urlDropped' }),
      expect.any(Function),
    )
  })

  it('外部ドロップ検出の false/true 分岐を通し、アンマウント時に保留タイマーもクリアする', async () => {
    vi.useFakeTimers()

    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const { rerender, unmount } = render(<SortableUrlItem {...createProps()} />)

    fireEvent.dragStart(getLink(), {
      dataTransfer: { setData: vi.fn(), dropEffect: 'copy' },
    })
    rerender(<SortableUrlItem {...createProps({ groupId: 'group-2' })} />)

    const mouseLeaveHandlerDragging = getLatestMouseLeaveHandler(
      removeEventListenerSpy,
    )

    await act(async () => {
      mouseLeaveHandlerDragging(new Event('mouseleave'))
    })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(sendMessageMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'urlDropped' }),
      expect.any(Function),
    )

    rerender(<SortableUrlItem {...createProps({ groupId: 'group-3' })} />)

    const mouseLeaveHandlerLeftWindow = getLatestMouseLeaveHandler(
      removeEventListenerSpy,
    )
    expect(mouseLeaveHandlerLeftWindow).not.toBe(mouseLeaveHandlerDragging)

    await act(async () => {
      mouseLeaveHandlerLeftWindow(new Event('mouseleave'))
    })

    await act(async () => {
      mouseLeaveHandlerLeftWindow(new Event('mouseleave'))
    })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'urlDropped',
        url: 'https://example.com',
        groupId: 'group-2',
        fromExternal: true,
      }),
      expect.any(Function),
    )

    await act(async () => {
      mouseLeaveHandlerLeftWindow(new Event('mouseleave'))
    })

    act(() => {
      unmount()
    })

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})
