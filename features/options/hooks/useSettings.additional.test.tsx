// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ChangeEvent } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from './useSettings'

vi.mock('@/lib/storage/settings', () => {
  const defaultSettings = {
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
  }

  return {
    defaultSettings,
    getUserSettings: vi.fn(),
    saveUserSettings: vi.fn(),
  }
})

import {
  defaultSettings,
  getUserSettings,
  saveUserSettings,
} from '@/lib/storage/settings'

type StorageListener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string,
) => void

const listeners: StorageListener[] = []

const createChromeMock = () =>
  ({
    storage: {
      local: {
        set: vi.fn(),
      },
      onChanged: {
        addListener: vi.fn((listener: StorageListener) => {
          listeners.push(listener)
        }),
        removeListener: vi.fn((listener: StorageListener) => {
          const index = listeners.indexOf(listener)
          if (index >= 0) {
            listeners.splice(index, 1)
          }
        }),
      },
    },
  }) as unknown as typeof chrome

describe('useSettings の追加分岐', () => {
  beforeEach(() => {
    listeners.length = 0
    vi.clearAllMocks()
    ;(globalThis as unknown as { chrome: typeof chrome }).chrome =
      createChromeMock()
  })

  it('アンマウント時にストレージリスナーを解除する', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)

    const { result, unmount } = renderHook(() => useSettings())
    const addListener = vi.mocked(chrome.storage.onChanged.addListener)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const removeListener = vi.mocked(chrome.storage.onChanged.removeListener)
    const listener = addListener.mock.calls[0]?.[0]

    expect(removeListener).toHaveBeenCalledTimes(0)

    unmount()

    expect(removeListener).toHaveBeenCalledTimes(1)
    expect(removeListener.mock.calls[0]?.[0]).toBe(listener)
    expect(removeListener.mock.calls[0]?.[0]).toEqual(expect.any(Function))
  })

  it('updateSetting の永続化に失敗したとき false を返す', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)
    vi.mocked(saveUserSettings).mockRejectedValue(new Error('persist failed'))

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    let success = true
    await act(async () => {
      success = await result.current.updateSetting('showSavedTime', true)
    })

    expect(success).toBe(false)
    expect(result.current.settings.showSavedTime).toBe(true)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('handleSaveSettings で保存エラーを握りつぶす', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)
    vi.mocked(saveUserSettings).mockRejectedValue(new Error('save failed'))

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.handleExcludePatternsChange({
        target: { value: 'first\n\nsecond' },
      } as ChangeEvent<HTMLTextAreaElement>)
    })

    await act(async () => {
      await result.current.handleSaveSettings()
    })

    expect(saveUserSettings).toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('handleExcludePatternsBlur 経由で保存を実行する', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)
    vi.mocked(saveUserSettings).mockResolvedValue(undefined)

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.handleExcludePatternsChange({
        target: { value: 'a\n\nb' },
      } as ChangeEvent<HTMLTextAreaElement>)
    })

    act(() => {
      result.current.handleExcludePatternsBlur()
    })

    await waitFor(() => {
      expect(saveUserSettings).toHaveBeenCalledTimes(1)
    })
  })

  it('local 以外の領域からのストレージ更新を無視する', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const before = result.current.settings

    act(() => {
      listeners[0](
        {
          userSettings: {
            oldValue: defaultSettings,
            newValue: { ...defaultSettings, showSavedTime: true },
          },
        },
        'sync',
      )
    })

    expect(result.current.settings).toEqual(before)
  })

  it('userSettings キーがない local storage 変更を無視する', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const before = result.current.settings

    act(() => {
      listeners[0](
        {
          unrelatedKey: {
            oldValue: false,
            newValue: true,
          },
        },
        'local',
      )
    })

    expect(result.current.settings).toEqual(before)
  })

  it('chrome.storage が利用できない環境でもクラッシュせず初期化できる', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)
    ;(globalThis as unknown as { chrome: typeof chrome }).chrome =
      {} as typeof chrome

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.settings).toEqual(defaultSettings)
  })
})
