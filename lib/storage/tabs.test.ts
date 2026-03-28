import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabGroup, UrlRecord } from '@/types/storage'

const mocks = vi.hoisted(() => ({
  getUrlRecordsMock: vi.fn<() => Promise<UrlRecord[]>>(),
  migrateToUrlsStorageMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./url-migration', () => ({
  migrateToUrlsStorage: mocks.migrateToUrlsStorageMock,
}))

vi.mock('./urls', () => ({
  createOrUpdateUrlRecord: vi.fn(),
  getUrlRecords: mocks.getUrlRecordsMock,
  getUrlRecordsByIds: vi.fn(),
}))

const loadTabsModule = async () => {
  vi.resetModules()
  return import('./tabs')
}

describe('tabs storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.migrateToUrlsStorageMock.mockResolvedValue(undefined)
  })

  it('複数グループの URL を一度の URL レコード読み出しで解決する', async () => {
    const groups: TabGroup[] = [
      {
        id: 'group-1',
        domain: 'example.com',
        urlIds: ['url-2', 'url-1'],
        urlSubCategories: {
          'url-1': 'docs',
        },
      },
      {
        id: 'group-2',
        domain: 'example.org',
        urlIds: ['url-3', 'missing'],
      },
    ]
    mocks.getUrlRecordsMock.mockResolvedValue([
      {
        id: 'url-1',
        url: 'https://example.com/a',
        title: 'A',
        savedAt: 1,
      },
      {
        id: 'url-2',
        url: 'https://example.com/b',
        title: 'B',
        savedAt: 2,
      },
      {
        id: 'url-3',
        url: 'https://example.org/c',
        title: 'C',
        savedAt: 3,
      },
    ])

    const { resolveTabGroupsWithUrls } = await loadTabsModule()

    await expect(resolveTabGroupsWithUrls(groups)).resolves.toEqual([
      {
        ...groups[0],
        urls: [
          {
            id: 'url-2',
            url: 'https://example.com/b',
            title: 'B',
            savedAt: 2,
            subCategory: undefined,
          },
          {
            id: 'url-1',
            url: 'https://example.com/a',
            title: 'A',
            savedAt: 1,
            subCategory: 'docs',
          },
        ],
      },
      {
        ...groups[1],
        urls: [
          {
            id: 'url-3',
            url: 'https://example.org/c',
            title: 'C',
            savedAt: 3,
            subCategory: undefined,
          },
        ],
      },
    ])

    expect(mocks.migrateToUrlsStorageMock).toHaveBeenCalledTimes(1)
    expect(mocks.getUrlRecordsMock).toHaveBeenCalledTimes(1)
  })
})
