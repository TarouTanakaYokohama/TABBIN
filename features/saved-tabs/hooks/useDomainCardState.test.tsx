// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabGroup } from '@/types/storage'
import { useDomainCardState } from './useDomainCardState'

vi.mock('@/lib/storage/categories', () => ({
  createParentCategory: vi.fn(),
  getParentCategories: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/storage/migration', () => ({
  assignDomainToCategory: vi.fn(),
}))

vi.mock('@/lib/storage/tabs', () => ({
  removeUrlFromTabGroup: vi.fn().mockResolvedValue(undefined),
}))

import { getParentCategories } from '@/lib/storage/categories'
import { removeUrlFromTabGroup } from '@/lib/storage/tabs'

const createGroup = (): TabGroup => ({
  id: 'group-1',
  domain: 'example.com',
  subCategories: ['news', 'tech'],
  urls: [
    { url: 'https://example.com/news-1', title: 'News 1', subCategory: 'news' },
    { url: 'https://example.com/news-2', title: 'News 2', subCategory: 'news' },
    { url: 'https://example.com/tech-1', title: 'Tech 1', subCategory: 'tech' },
  ],
})

describe('useDomainCardState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  it('bulk delete handler があるときは子カテゴリ一括削除でそれを 1 回だけ使う', async () => {
    const handleDeleteUrls = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useDomainCardState({
        group: createGroup(),
        handleDeleteCategory: vi.fn(),
        handleDeleteUrls,
        isReorderMode: false,
      } as never),
    )

    await waitFor(() => {
      expect(getParentCategories).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      await result.current.categoryActions.handleDeleteAllTabsInCategory(
        'news',
        [
          { url: 'https://example.com/news-1' },
          { url: 'https://example.com/news-2' },
        ],
      )
    })

    expect(handleDeleteUrls).toHaveBeenCalledTimes(1)
    expect(handleDeleteUrls).toHaveBeenCalledWith('group-1', [
      'https://example.com/news-1',
      'https://example.com/news-2',
    ])
    expect(removeUrlFromTabGroup).not.toHaveBeenCalled()
  })

  it('bulk delete handler がないときは個別削除にフォールバックする', async () => {
    const { result } = renderHook(() =>
      useDomainCardState({
        group: createGroup(),
        handleDeleteCategory: vi.fn(),
        isReorderMode: false,
      }),
    )

    await waitFor(() => {
      expect(getParentCategories).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      await result.current.categoryActions.handleDeleteAllTabsInCategory(
        'news',
        [
          { url: 'https://example.com/news-1' },
          { url: 'https://example.com/news-2' },
        ],
      )
    })

    expect(removeUrlFromTabGroup).toHaveBeenCalledTimes(2)
    expect(removeUrlFromTabGroup).toHaveBeenNthCalledWith(
      1,
      'group-1',
      'https://example.com/news-1',
    )
    expect(removeUrlFromTabGroup).toHaveBeenNthCalledWith(
      2,
      'group-1',
      'https://example.com/news-2',
    )
  })

  it('削除対象 URL が空なら何もしない', async () => {
    const handleDeleteUrls = vi.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useDomainCardState({
        group: createGroup(),
        handleDeleteCategory: vi.fn(),
        handleDeleteUrls,
        isReorderMode: false,
      }),
    )

    await waitFor(() => {
      expect(getParentCategories).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      await result.current.categoryActions.handleDeleteAllTabsInCategory(
        'news',
        [],
      )
    })

    expect(handleDeleteUrls).not.toHaveBeenCalled()
    expect(removeUrlFromTabGroup).not.toHaveBeenCalled()
  })
})
