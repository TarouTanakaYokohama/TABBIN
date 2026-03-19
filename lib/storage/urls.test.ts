import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomProject, TabGroup, UrlRecord } from '@/types/storage'

const mocks = vi.hoisted(() => {
  let uuidIndex = 0
  const nextUuid = () => `uuid-${++uuidIndex}`

  return {
    uuid: vi.fn(() => nextUuid()),
    resetUuid: () => {
      uuidIndex = 0
      mocks.uuid.mockClear()
    },
  }
})

vi.mock('uuid', () => ({
  v4: mocks.uuid,
}))

interface StorageState {
  customProjects?: CustomProject[]
  savedTabs?: TabGroup[]
  urls?: UrlRecord[] | unknown
}

const createChromeStorageLocal = (state: StorageState) => ({
  get: vi.fn(async (keys?: string | string[]) => {
    if (!keys) {
      return state
    }

    if (Array.isArray(keys)) {
      return Object.fromEntries(
        keys.map(key => [key, state[key as keyof StorageState]]),
      )
    }

    return {
      [keys]: state[keys as keyof StorageState],
    }
  }),
  set: vi.fn(async (value: Record<string, unknown>) => {
    Object.assign(state, value)
  }),
})

const loadUrlsModule = async () => {
  vi.resetModules()
  return import('./urls')
}

describe('urls storage', () => {
  beforeEach(() => {
    mocks.resetUuid()
    vi.restoreAllMocks()
  })

  it('URLレコードを作成・更新・検索できる', async () => {
    const state: StorageState = {}
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const {
      createOrUpdateUrlRecord,
      findUrlRecordByUrl,
      getUrlRecordById,
      getUrlRecords,
      getUrlRecordsByIds,
    } = await loadUrlsModule()

    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValue(200)

    const created = await createOrUpdateUrlRecord(
      'https://example.com',
      'Example',
      'icon-1',
    )

    expect(created).toEqual({
      favIconUrl: 'icon-1',
      id: 'uuid-1',
      savedAt: 100,
      title: 'Example',
      url: 'https://example.com',
    })
    await expect(getUrlRecordById('uuid-1')).resolves.toEqual(created)
    await expect(findUrlRecordByUrl('https://example.com')).resolves.toEqual(
      created,
    )
    await expect(getUrlRecordsByIds(['uuid-1', 'missing'])).resolves.toEqual([
      created,
    ])

    const updated = await createOrUpdateUrlRecord(
      'https://example.com',
      'Updated',
      'icon-2',
    )

    expect(updated).toEqual({
      favIconUrl: 'icon-2',
      id: 'uuid-1',
      savedAt: 200,
      title: 'Updated',
      url: 'https://example.com',
    })
    await expect(getUrlRecords()).resolves.toEqual([updated])
  })

  it('一括 upsert で空URLを除外しながら新規作成と更新を行う', async () => {
    const state: StorageState = {
      urls: [
        {
          id: 'existing-1',
          savedAt: 1,
          title: 'Old',
          url: 'https://example.com',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { createOrUpdateUrlRecordsBatch, getUrlRecords } =
      await loadUrlsModule()

    vi.spyOn(Date, 'now').mockReturnValue(500)

    const records = await createOrUpdateUrlRecordsBatch([
      {
        title: 'Updated',
        url: ' https://example.com ',
      },
      {
        favIconUrl: 'icon-2',
        title: 'Second',
        url: 'https://second.com',
      },
      {
        title: 'Ignored',
        url: '   ',
      },
    ])

    expect([...records.entries()]).toEqual([
      [
        'https://example.com',
        {
          id: 'existing-1',
          savedAt: 500,
          title: 'Updated',
          url: 'https://example.com',
          favIconUrl: undefined,
        },
      ],
      [
        'https://second.com',
        {
          id: 'uuid-1',
          savedAt: 501,
          title: 'Second',
          url: 'https://second.com',
          favIconUrl: 'icon-2',
        },
      ],
    ])
    await expect(getUrlRecords()).resolves.toEqual([
      {
        id: 'existing-1',
        savedAt: 500,
        title: 'Updated',
        url: 'https://example.com',
        favIconUrl: undefined,
      },
      {
        id: 'uuid-1',
        savedAt: 501,
        title: 'Second',
        url: 'https://second.com',
        favIconUrl: 'icon-2',
      },
    ])
  })

  it('参照されるURLは削除せず未参照URLだけ削除・クリーンアップする', async () => {
    const state: StorageState = {
      customProjects: [
        {
          categories: [],
          createdAt: 1,
          id: 'project-1',
          name: 'Project',
          updatedAt: 1,
          urlIds: ['url-2'],
        },
      ],
      savedTabs: [
        {
          domain: 'https://example.com',
          id: 'group-1',
          urlIds: ['url-1'],
        },
      ],
      urls: [
        {
          id: 'url-1',
          savedAt: 1,
          title: 'A',
          url: 'https://example.com/a',
        },
        {
          id: 'url-2',
          savedAt: 2,
          title: 'B',
          url: 'https://example.com/b',
        },
        {
          id: 'url-3',
          savedAt: 3,
          title: 'C',
          url: 'https://example.com/c',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const {
      cleanupUnreferencedUrls,
      deleteUrlRecord,
      getUrlRecords,
      isUrlRecordReferenced,
    } = await loadUrlsModule()

    await expect(isUrlRecordReferenced('url-1')).resolves.toBe(true)
    await expect(deleteUrlRecord('url-1')).resolves.toBe(false)
    await expect(deleteUrlRecord('url-3')).resolves.toBe(true)
    await expect(cleanupUnreferencedUrls()).resolves.toBe(0)
    await expect(getUrlRecords()).resolves.toEqual([
      {
        id: 'url-1',
        savedAt: 1,
        title: 'A',
        url: 'https://example.com/a',
      },
      {
        id: 'url-2',
        savedAt: 2,
        title: 'B',
        url: 'https://example.com/b',
      },
    ])
  })

  it('重複URLを新しいレコードへ統合し参照先を更新する', async () => {
    const state: StorageState = {
      customProjects: [
        {
          categories: [],
          createdAt: 1,
          id: 'project-1',
          name: 'Project',
          updatedAt: 1,
          urlIds: ['old-id'],
        },
      ],
      savedTabs: [
        {
          domain: 'https://example.com',
          id: 'group-1',
          urlIds: ['old-id'],
        },
      ],
      urls: [
        {
          id: 'old-id',
          savedAt: 10,
          title: 'Old',
          url: 'https://example.com',
        },
        {
          id: 'new-id',
          savedAt: 20,
          title: 'New',
          url: 'https://example.com',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { deduplicateUrlRecords } = await loadUrlsModule()

    await expect(deduplicateUrlRecords()).resolves.toBe(1)
    expect(state.urls).toEqual([
      {
        id: 'new-id',
        savedAt: 20,
        title: 'New',
        url: 'https://example.com',
      },
    ])
    expect(state.savedTabs?.[0].urlIds).toEqual(['new-id'])
    expect(state.customProjects?.[0].urlIds).toEqual(['new-id'])
  })

  it('ストレージエラー時は安全側に倒す', async () => {
    const storage = createChromeStorageLocal({
      urls: 'broken',
    })
    storage.get.mockRejectedValue(new Error('boom'))
    globalThis.chrome = {
      storage: {
        local: storage,
      },
    } as unknown as typeof chrome

    const { cleanupUnreferencedUrls, getUrlRecords, isUrlRecordReferenced } =
      await loadUrlsModule()

    await expect(getUrlRecords()).resolves.toEqual([])
    await expect(isUrlRecordReferenced('any')).resolves.toBe(true)
    await expect(cleanupUnreferencedUrls()).resolves.toBe(0)
  })
})
