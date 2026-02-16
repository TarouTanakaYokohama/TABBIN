// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ChangeEvent } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettings } from './useSettings'

vi.mock('@/lib/storage/settings', () => {
  const defaultSettings = {
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
          if (index >= 0) listeners.splice(index, 1)
        }),
      },
    },
  }) as unknown as typeof chrome

describe('useSettings additional branches', () => {
  beforeEach(() => {
    listeners.length = 0
    vi.clearAllMocks()
    ;(globalThis as unknown as { chrome: typeof chrome }).chrome =
      createChromeMock()
  })

  it('removes storage listener on unmount', async () => {
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
    expect(typeof removeListener.mock.calls[0]?.[0]).toBe('function')
  })

  it('returns false when updateSetting persistence fails', async () => {
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

  it('swallows save errors in handleSaveSettings', async () => {
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

  it('triggers save through handleExcludePatternsBlur', async () => {
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

  it('ignores storage updates from non-local area', async () => {
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

  it('ignores local storage changes without userSettings key', async () => {
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
})
