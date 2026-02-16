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

describe('useSettings', () => {
  beforeEach(() => {
    listeners.length = 0
    vi.clearAllMocks()
    ;(globalThis as unknown as { chrome: typeof chrome }).chrome =
      createChromeMock()
  })

  it('loads settings on mount', async () => {
    const loadedSettings = {
      ...defaultSettings,
      showSavedTime: true,
      excludePatterns: ['https://example.com/*'],
    }
    vi.mocked(getUserSettings).mockResolvedValue(loadedSettings)

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(getUserSettings).toHaveBeenCalledTimes(1)
    expect(result.current.settings).toEqual(loadedSettings)
  })

  it('falls back to default settings when loading fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.mocked(getUserSettings).mockRejectedValue(new Error('load failed'))

    try {
      const { result } = renderHook(() => useSettings())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.settings).toEqual(defaultSettings)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '設定の読み込みエラー:',
        expect.any(Error),
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it('updateSetting updates local state and persists settings', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)
    vi.mocked(saveUserSettings).mockResolvedValue(undefined)

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    let success = false
    await act(async () => {
      success = await result.current.updateSetting('showSavedTime', true)
    })

    expect(success).toBe(true)
    expect(result.current.settings.showSavedTime).toBe(true)
    expect(saveUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        showSavedTime: true,
      }),
    )
  })

  it('handleExcludePatternsBlur saves only non-empty lines', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)
    vi.mocked(saveUserSettings).mockResolvedValue(undefined)

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.handleExcludePatternsChange({
        target: { value: 'first-pattern\n\nsecond-pattern' },
      } as ChangeEvent<HTMLTextAreaElement>)
    })

    await act(async () => {
      await result.current.handleSaveSettings()
    })

    expect(saveUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        excludePatterns: ['first-pattern', 'second-pattern'],
      }),
    )
  })

  it('updates state from chrome.storage.onChanged events', async () => {
    vi.mocked(getUserSettings).mockResolvedValue(defaultSettings)

    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const updatedSettings = {
      ...defaultSettings,
      autoDeletePeriod: '7days',
      removeTabAfterOpen: false,
    }

    act(() => {
      listeners[0](
        {
          userSettings: {
            oldValue: defaultSettings,
            newValue: updatedSettings,
          },
        },
        'local',
      )
    })

    expect(result.current.settings).toEqual(updatedSettings)

    act(() => {
      listeners[0](
        {
          userSettings: {
            oldValue: updatedSettings,
            newValue: undefined,
          },
        },
        'local',
      )
    })

    expect(result.current.settings).toEqual(defaultSettings)
  })
})
