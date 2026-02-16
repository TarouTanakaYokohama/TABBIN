// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCategories } from './useCategories'

vi.mock('@/lib/storage/categories', () => ({
  createParentCategory: vi.fn(),
  getParentCategories: vi.fn(),
}))

import {
  createParentCategory,
  getParentCategories,
} from '@/lib/storage/categories'

type StorageListener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string,
) => void

const listeners: StorageListener[] = []

const createChromeMock = () =>
  ({
    storage: {
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

describe('useCategories additional branches', () => {
  beforeEach(() => {
    listeners.length = 0
    vi.clearAllMocks()
    vi.useRealTimers()
    ;(globalThis as unknown as { chrome: typeof chrome }).chrome =
      createChromeMock()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('handles category loading errors gracefully', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.mocked(getParentCategories).mockRejectedValue(new Error('load failed'))

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(getParentCategories).toHaveBeenCalledTimes(1)
    })

    expect(result.current.parentCategories).toEqual([])
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('returns false when category name is blank', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([])

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([])
    })

    let success = true
    await act(async () => {
      success = await result.current.handleAddCategory()
    })

    expect(success).toBe(false)
    expect(createParentCategory).not.toHaveBeenCalled()
  })

  it('shows create error and clears it after timeout', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.mocked(getParentCategories).mockResolvedValue([])
    vi.mocked(createParentCategory).mockRejectedValue(
      new Error('create failed'),
    )

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([])
    })

    act(() => {
      result.current.setNewCategoryName('Valid Category')
    })

    vi.useFakeTimers()

    let success = true
    await act(async () => {
      success = await result.current.handleAddCategory()
    })

    expect(success).toBe(false)
    expect(result.current.categoryError).toBe('カテゴリの追加に失敗しました。')
    expect(consoleErrorSpy).toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.categoryError).toBe(null)
  })

  it('handleCategoryKeyDown adds category on Enter when no error exists', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([])
    vi.mocked(createParentCategory).mockResolvedValue({
      id: 'new-id',
      name: 'Created by Enter',
      domains: [],
      domainNames: [],
    })

    const { result } = renderHook(() => useCategories())
    const preventDefault = vi.fn()

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([])
    })

    act(() => {
      result.current.setNewCategoryName('Created by Enter')
    })

    await act(async () => {
      result.current.handleCategoryKeyDown({
        key: 'Enter',
        preventDefault,
      } as unknown as KeyboardEvent<HTMLInputElement>)
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(createParentCategory).toHaveBeenCalledWith('Created by Enter')
    })
  })

  it('handleCategoryKeyDown does nothing for non-Enter keys', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([])

    const { result } = renderHook(() => useCategories())
    const preventDefault = vi.fn()

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([])
    })

    act(() => {
      result.current.setNewCategoryName('Should Not Run')
      result.current.handleCategoryKeyDown({
        key: 'Escape',
        preventDefault,
      } as unknown as KeyboardEvent<HTMLInputElement>)
    })

    expect(preventDefault).not.toHaveBeenCalled()
    expect(createParentCategory).not.toHaveBeenCalled()
  })

  it('handleCategoryKeyDown skips add when error already exists', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([])

    const { result } = renderHook(() => useCategories())
    const preventDefault = vi.fn()

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([])
    })

    act(() => {
      result.current.setCategoryError('already error')
    })

    act(() => {
      result.current.handleCategoryKeyDown({
        key: 'Enter',
        preventDefault,
      } as unknown as KeyboardEvent<HTMLInputElement>)
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(createParentCategory).not.toHaveBeenCalled()
  })

  it('ignores local storage changes when parentCategories key is missing', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([
      { id: 'cat-1', name: 'Initial', domains: [], domainNames: [] },
    ])

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([
        { id: 'cat-1', name: 'Initial', domains: [], domainNames: [] },
      ])
    })

    act(() => {
      listeners[0](
        {
          anotherKey: {
            oldValue: [],
            newValue: [{ id: 'cat-2', name: 'Ignored' }],
          },
        },
        'local',
      )
    })

    expect(result.current.parentCategories).toEqual([
      { id: 'cat-1', name: 'Initial', domains: [], domainNames: [] },
    ])
  })

  it('ignores storage updates from non-local areas', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([
      { id: 'cat-1', name: 'Initial', domains: [], domainNames: [] },
    ])

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([
        { id: 'cat-1', name: 'Initial', domains: [], domainNames: [] },
      ])
    })

    act(() => {
      listeners[0](
        {
          parentCategories: {
            oldValue: [
              { id: 'cat-1', name: 'Initial', domains: [], domainNames: [] },
            ],
            newValue: [
              { id: 'cat-2', name: 'Ignored', domains: [], domainNames: [] },
            ],
          },
        },
        'sync',
      )
    })

    expect(result.current.parentCategories).toEqual([
      { id: 'cat-1', name: 'Initial', domains: [], domainNames: [] },
    ])
  })

  it('falls back to empty categories when storage change payload is not an array', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([
      { id: 'cat-1', name: 'Initial', domains: [], domainNames: [] },
    ])

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories.length).toBe(1)
    })

    act(() => {
      listeners[0](
        {
          parentCategories: {
            oldValue: [
              { id: 'cat-1', name: 'Initial', domains: [], domainNames: [] },
            ],
            newValue: { invalid: true },
          },
        },
        'local',
      )
    })

    expect(result.current.parentCategories).toEqual([])
  })
})
