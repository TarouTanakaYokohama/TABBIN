// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('useCategories', () => {
  beforeEach(() => {
    listeners.length = 0
    vi.clearAllMocks()
    ;(globalThis as unknown as { chrome: typeof chrome }).chrome =
      createChromeMock()
  })

  it('loads categories on mount', async () => {
    const categories = [
      { id: '1', name: 'Work', domains: [], domainNames: [] },
      { id: '2', name: 'Private', domains: [], domainNames: [] },
    ]
    vi.mocked(getParentCategories).mockResolvedValue(categories)

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual(categories)
    })
  })

  it('prevents adding duplicate category names (case-insensitive)', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([
      { id: '1', name: 'Work', domains: [], domainNames: [] },
    ])

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories.length).toBe(1)
    })

    act(() => {
      result.current.setNewCategoryName('work')
    })

    let success = true
    await act(async () => {
      success = await result.current.handleAddCategory()
    })

    expect(success).toBe(false)
    expect(createParentCategory).not.toHaveBeenCalled()
    expect(result.current.categoryError).toBe(
      '同じ名前のカテゴリがすでに存在します。',
    )
  })

  it('rejects category names longer than 25 chars', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([])

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([])
    })

    act(() => {
      result.current.setNewCategoryName('a'.repeat(26))
    })

    let success = true
    await act(async () => {
      success = await result.current.handleAddCategory()
    })

    expect(success).toBe(false)
    expect(createParentCategory).not.toHaveBeenCalled()
    expect(result.current.categoryError).toBe(
      'カテゴリ名は25文字以下にしてください',
    )
  })

  it('adds a category when input is valid and unique', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([])
    vi.mocked(createParentCategory).mockResolvedValue({
      id: 'new-id',
      name: 'New Category',
      domains: [],
      domainNames: [],
    })

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([])
    })

    act(() => {
      result.current.setNewCategoryName('  New Category  ')
    })

    let success = false
    await act(async () => {
      success = await result.current.handleAddCategory()
    })

    expect(success).toBe(true)
    expect(createParentCategory).toHaveBeenCalledWith('New Category')
    expect(result.current.newCategoryName).toBe('')
    expect(result.current.categoryError).toBe(null)
  })

  it('reflects category updates from chrome.storage changes', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([])

    const { result } = renderHook(() => useCategories())

    await waitFor(() => {
      expect(result.current.parentCategories).toEqual([])
    })

    const updatedCategories = [
      { id: '10', name: 'Updated', domains: [], domainNames: [] },
    ]

    act(() => {
      listeners[0](
        {
          parentCategories: {
            oldValue: [],
            newValue: updatedCategories,
          },
        },
        'local',
      )
    })

    expect(result.current.parentCategories).toEqual(updatedCategories)
  })

  it('removes storage listener on unmount', async () => {
    vi.mocked(getParentCategories).mockResolvedValue([])

    const { unmount } = renderHook(() => useCategories())
    const addListener = vi.mocked(chrome.storage.onChanged.addListener)
    const removeListener = vi.mocked(chrome.storage.onChanged.removeListener)

    await waitFor(() => {
      expect(addListener).toHaveBeenCalledTimes(1)
    })

    const listener = addListener.mock.calls[0]?.[0]
    unmount()

    expect(removeListener).toHaveBeenCalledTimes(1)
    expect(removeListener.mock.calls[0]?.[0]).toBe(listener)
  })
})
