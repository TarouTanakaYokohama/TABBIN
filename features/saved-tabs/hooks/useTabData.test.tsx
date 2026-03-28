// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabGroup, UserSettings } from '@/types/storage'
import { useTabData } from './useTabData'

const {
  getParentCategoriesMock,
  resolveTabGroupsWithUrlsMock,
  getUserSettingsMock,
  migrateParentCategoriesToDomainNamesMock,
  migrateToUrlsStorageMock,
} = vi.hoisted(() => ({
  getParentCategoriesMock: vi.fn().mockResolvedValue([]),
  resolveTabGroupsWithUrlsMock: vi.fn(),
  getUserSettingsMock: vi.fn().mockResolvedValue({} as UserSettings),
  migrateParentCategoriesToDomainNamesMock: vi
    .fn()
    .mockResolvedValue(undefined),
  migrateToUrlsStorageMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/storage/categories', () => ({
  getParentCategories: getParentCategoriesMock,
}))

vi.mock('@/lib/storage/migration', () => ({
  migrateParentCategoriesToDomainNames:
    migrateParentCategoriesToDomainNamesMock,
  migrateToUrlsStorage: migrateToUrlsStorageMock,
}))

vi.mock('@/lib/storage/settings', () => ({
  getUserSettings: getUserSettingsMock,
}))

vi.mock('@/lib/storage/tabs', () => ({
  resolveTabGroupsWithUrls: resolveTabGroupsWithUrlsMock,
}))

describe('useTabData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async (key?: string) => {
            if (key === 'savedTabs') {
              return { savedTabs: [] }
            }
            if (key === 'urls') {
              return { urls: [] }
            }
            return {}
          }),
        },
      },
    } as unknown as typeof chrome
  })

  it('refreshTabGroupsWithUrls で URL 解決を一度だけ実行し、tabGroups effect と二重化しない', async () => {
    const group: TabGroup = {
      id: 'group-1',
      domain: 'example.com',
      urlIds: ['url-1'],
    }

    resolveTabGroupsWithUrlsMock.mockResolvedValue([
      {
        ...group,
        urls: [
          {
            id: 'url-1',
            url: 'https://example.com/a',
            title: 'A',
          },
        ],
      },
    ])

    const { result } = renderHook(() => useTabData(vi.fn(), vi.fn()))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    resolveTabGroupsWithUrlsMock.mockClear()

    await act(async () => {
      await result.current.refreshTabGroupsWithUrls([group])
    })

    await waitFor(() => {
      expect(result.current.tabGroupsWithUrls).toEqual([
        {
          ...group,
          urls: [
            {
              id: 'url-1',
              url: 'https://example.com/a',
              title: 'A',
            },
          ],
        },
      ])
    })

    expect(resolveTabGroupsWithUrlsMock).toHaveBeenCalledTimes(1)
    expect(resolveTabGroupsWithUrlsMock).toHaveBeenCalledWith([group])
  })
})
