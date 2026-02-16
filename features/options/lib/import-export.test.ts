// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/storage/categories', () => ({
  saveParentCategories: vi.fn(),
}))

vi.mock('@/lib/storage/migration', () => ({
  migrateToUrlsStorage: vi.fn(),
}))

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

vi.mock('@/lib/storage/urls', () => ({
  createOrUpdateUrlRecord: vi.fn(),
}))

import { saveParentCategories } from '@/lib/storage/categories'
import { migrateToUrlsStorage } from '@/lib/storage/migration'
import {
  defaultSettings,
  getUserSettings,
  saveUserSettings,
} from '@/lib/storage/settings'
import { createOrUpdateUrlRecord } from '@/lib/storage/urls'
import { downloadAsJson, exportSettings, importSettings } from './import-export'

type StorageStore = Record<string, unknown>

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const createChromeMock = (
  initialStore: StorageStore = {},
  options: {
    manifestVersion?: string
    failGet?: boolean
  } = {},
) => {
  const store = clone(initialStore)

  const get = vi.fn(
    async (keys?: string | string[] | Record<string, unknown>) => {
      if (options.failGet) {
        throw new Error('storage get failed')
      }

      if (keys == null) {
        return clone(store)
      }

      if (typeof keys === 'string') {
        return { [keys]: clone(store[keys]) }
      }

      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {}
        for (const key of keys) {
          result[key] = clone(store[key])
        }
        return result
      }

      const result: Record<string, unknown> = {}
      for (const [key, fallback] of Object.entries(keys)) {
        result[key] =
          store[key] === undefined ? clone(fallback) : clone(store[key])
      }
      return result
    },
  )

  const set = vi.fn(async (next: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(next)) {
      store[key] = clone(value)
    }
  })

  ;(globalThis as unknown as { chrome: typeof chrome }).chrome = {
    storage: {
      local: { get, set },
    },
    runtime: {
      getManifest: () => ({ version: options.manifestVersion ?? '9.9.9' }),
    },
  } as unknown as typeof chrome

  return { store, get, set }
}

const buildFullUserSettings = (override: Record<string, unknown> = {}) => ({
  removeTabAfterOpen: true,
  excludePatterns: ['existing-pattern'],
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
  ...override,
})

describe('import-export utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(migrateToUrlsStorage).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('exportSettings returns backup payload from storage and settings', async () => {
    const userSettings = buildFullUserSettings()
    const parentCategories = [
      { id: 'cat-1', name: 'Work', domains: [], domainNames: [] },
    ]
    const savedTabs = [{ id: 'tab-1', domain: 'https://example.com', urls: [] }]

    createChromeMock({
      parentCategories,
      savedTabs,
    })
    vi.mocked(getUserSettings).mockResolvedValue(userSettings)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-16T00:00:00.000Z'))

    const result = await exportSettings()

    expect(result).toEqual({
      version: '9.9.9',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings,
      parentCategories,
      savedTabs,
    })
  })

  it('exportSettings throws normalized error when storage access fails', async () => {
    createChromeMock({}, { failGet: true })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    await expect(exportSettings()).rejects.toThrow(
      'データのエクスポート中にエラーが発生しました',
    )
  })

  it('exportSettings falls back to default version when manifest version is empty', async () => {
    createChromeMock(
      {
        parentCategories: [],
        savedTabs: [],
      },
      { manifestVersion: '' },
    )
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    const result = await exportSettings()

    expect(result.version).toBe('1.0.0')
  })

  it('downloadAsJson creates a temporary anchor and cleans up', () => {
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    })

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })

    downloadAsJson(
      {
        version: '1.0.0',
        timestamp: '2026-02-16T00:00:00.000Z',
        userSettings: buildFullUserSettings(),
        parentCategories: [],
        savedTabs: [],
      },
      'backup.json',
    )

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    expect(document.querySelector('a[download="backup.json"]')).toBeNull()

    rafSpy.mockRestore()
    clickSpy.mockRestore()

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    })
  })

  it('importSettings returns validation error for schema-invalid JSON', async () => {
    createChromeMock()

    const result = await importSettings(JSON.stringify({ foo: 'bar' }))

    expect(result).toEqual({
      success: false,
      message: 'インポートされたデータの形式が正しくありません',
    })
    expect(saveUserSettings).not.toHaveBeenCalled()
    expect(saveParentCategories).not.toHaveBeenCalled()
  })

  it('importSettings returns generic error for malformed JSON', async () => {
    createChromeMock()

    const result = await importSettings('{malformed-json')

    expect(result).toEqual({
      success: false,
      message: 'データのインポート中にエラーが発生しました',
    })
  })

  it('merge mode handles non-array current storage safely', async () => {
    const { set } = createChromeMock({
      parentCategories: { invalid: true },
      savedTabs: { invalid: true },
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord).mockResolvedValue({
      id: 'new-url-id',
      url: 'https://safe.example.com/path',
      title: '',
      savedAt: 1,
    })

    const imported = {
      version: '1.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        excludePatterns: ['safe'],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [
        {
          id: 'safe-cat',
          name: 'Safe',
          domains: [],
          domainNames: [],
        },
      ],
      savedTabs: [
        {
          id: 'safe-group',
          domain: 'https://safe.example.com',
          urls: [{ url: 'https://safe.example.com/path' }],
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), true)

    expect(result.success).toBe(true)
    expect(result.message).toContain('1個のカテゴリと1個のドメイン')
    expect(saveParentCategories).toHaveBeenCalledWith([
      {
        id: 'safe-cat',
        name: 'Safe',
        domains: [],
        domainNames: [],
      },
    ])
    expect(set).toHaveBeenCalledWith({
      savedTabs: [
        {
          id: 'safe-group',
          domain: 'https://safe.example.com',
          urlIds: ['new-url-id'],
          urlSubCategories: undefined,
          parentCategoryId: undefined,
          categoryKeywords: [],
          subCategories: [],
          savedAt: undefined,
        },
      ],
    })
  })

  it('merge mode keeps existing parent/savedAt when imported values are omitted', async () => {
    const { set } = createChromeMock({
      parentCategories: [],
      savedTabs: [
        {
          id: 'existing-group',
          domain: 'https://existing-fallback.example.com',
          parentCategoryId: 'parent-old',
          savedAt: 777,
        },
      ],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord).mockResolvedValue({
      id: 'new-id',
      url: 'https://existing-fallback.example.com/path',
      title: '',
      savedAt: 1,
    })

    const imported = {
      version: '1.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        excludePatterns: ['p'],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'imported-existing',
          domain: 'https://existing-fallback.example.com',
          urls: [{ url: 'https://existing-fallback.example.com/path' }],
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), true)

    expect(result.success).toBe(true)

    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Array<
      Record<string, unknown>
    >
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        id: 'existing-group',
        domain: 'https://existing-fallback.example.com',
        parentCategoryId: 'parent-old',
        savedAt: 777,
        urlIds: ['new-id'],
        urlSubCategories: undefined,
        categoryKeywords: [],
        subCategories: [],
      }),
    )
  })

  it('merge mode avoids duplicate URL IDs and normalizes mixed subcategory/keyword payloads', async () => {
    const { set } = createChromeMock({
      parentCategories: [],
      savedTabs: [
        {
          id: 'dup-group',
          domain: 'https://dup.example.com',
          urlIds: ['dup-id'],
          urlSubCategories: {},
          categoryKeywords: [{ categoryName: 'news', keywords: ['old'] }],
          subCategories: [{ name: 'ObjA' }, { name: 'ObjA' }, 123, 'StrA'],
        },
      ],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord).mockResolvedValue({
      id: 'dup-id',
      url: 'https://dup.example.com/path',
      title: '',
      savedAt: 1,
    })

    const imported = {
      version: '1.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'dup-group-imported',
          domain: 'https://dup.example.com',
          urls: [{ url: 'https://dup.example.com/path' }],
          categoryKeywords: [
            { categoryName: 'news', keywords: 'not-array' },
            { categoryName: 'news', keywords: ['fresh'] },
            { categoryName: 'extra', keywords: ['x'] },
          ],
          subCategories: [
            { name: 'ObjA' },
            { name: 'ObjB' },
            999,
            'StrB',
            'StrB',
          ],
          savedAt: 1000,
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), true)

    expect(result.success).toBe(true)
    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Array<
      Record<string, unknown>
    >
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        urlIds: ['dup-id'],
        subCategories: ['ObjA', 'StrA', 'ObjB', 'StrB'],
        categoryKeywords: [
          { categoryName: 'news', keywords: ['old', 'fresh'] },
          { categoryName: 'extra', keywords: ['x'] },
        ],
      }),
    )
  })

  it('merge mode normalizes new-domain keyword and subcategory edge cases', async () => {
    const { set } = createChromeMock({
      parentCategories: [],
      savedTabs: [],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord).mockResolvedValue({
      id: 'new-domain-edge',
      url: 'https://new-edge.example.com',
      title: '',
      savedAt: 1,
    })

    const imported = {
      version: '1.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'new-domain-edge-group',
          domain: 'https://new-edge.example.com',
          urls: [{ url: 'https://new-edge.example.com' }],
          categoryKeywords: [{ categoryName: 'edge', keywords: 'not-array' }],
          subCategories: [{ name: 'Obj' }, { name: 'Obj' }, 'Str', 'Str', 0],
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), true)

    expect(result.success).toBe(true)
    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Array<
      Record<string, unknown>
    >
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        categoryKeywords: [{ categoryName: 'edge', keywords: [] }],
        subCategories: ['Obj', 'Str'],
      }),
    )
  })

  it('merge mode tolerates keyword map lookups returning undefined after has()', async () => {
    const originalGet = Map.prototype.get
    const getSpy = vi.spyOn(Map.prototype, 'get').mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown,
    ) {
      if (key === 'force-undefined-existing-item') {
        return undefined
      }
      return originalGet.call(this, key)
    })

    const { set } = createChromeMock({
      parentCategories: [],
      savedTabs: [
        {
          id: 'force-group',
          domain: 'https://force.example.com',
          categoryKeywords: [
            {
              categoryName: 'force-undefined-existing-item',
              keywords: ['keep'],
            },
          ],
        },
      ],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord).mockResolvedValue({
      id: 'force-url',
      url: 'https://force.example.com',
      title: '',
      savedAt: 1,
    })

    const imported = {
      version: '1.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'force-group-imported',
          domain: 'https://force.example.com',
          urls: [{ url: 'https://force.example.com' }],
          categoryKeywords: [
            {
              categoryName: 'force-undefined-existing-item',
              keywords: ['new'],
            },
          ],
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), true)

    expect(result.success).toBe(true)
    expect(set).toHaveBeenCalled()

    getSpy.mockRestore()
  })

  it('importSettings merges existing and imported data in merge mode', async () => {
    const currentSettings = buildFullUserSettings({
      excludePatterns: ['existing-pattern'],
      showSavedTime: false,
    })

    const currentCategories = [
      {
        id: 'cat-1',
        name: 'Current Category',
        domains: ['group-1'],
        domainNames: ['https://existing.example.com'],
      },
    ]

    const currentTabs = [
      {
        id: 'group-1',
        domain: 'https://existing.example.com',
        urlIds: ['url-existing'],
        urlSubCategories: { 'url-existing': 'OldSub' },
        parentCategoryId: 'cat-1',
        categoryKeywords: [{ categoryName: 'news', keywords: ['old'] }],
        subCategories: [
          { name: 'ExistingObjSub' },
          'ExistingStrSub',
          'ExistingStrSub',
        ],
        savedAt: 100,
      },
    ]

    const { set } = createChromeMock({
      parentCategories: currentCategories,
      savedTabs: currentTabs,
    })
    vi.mocked(getUserSettings).mockResolvedValue(currentSettings)
    vi.mocked(createOrUpdateUrlRecord)
      .mockResolvedValueOnce({
        id: 'url-imported-existing',
        url: 'https://existing.example.com/new',
        title: 'Existing New',
        savedAt: 1,
      })
      .mockResolvedValueOnce({
        id: 'url-imported-new-domain',
        url: 'https://new.example.com/path',
        title: 'New Domain',
        savedAt: 2,
      })

    const imported = {
      version: '2.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: false,
        excludePatterns: ['existing-pattern', 'new-pattern'],
        enableCategories: true,
        showSavedTime: true,
        autoDeletePeriod: '7days',
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [
        {
          id: 'cat-1',
          name: 'Merged Category',
          domains: ['group-2'],
          domainNames: ['https://imported.example.com'],
          keywords: ['ignore-this'],
        },
        {
          id: 'cat-2',
          name: 'New Category',
          domains: [],
          domainNames: [],
          keywords: ['ignore-this-too'],
        },
      ],
      savedTabs: [
        {
          id: 'imported-existing-group',
          domain: 'https://existing.example.com',
          urls: [
            {
              url: 'https://existing.example.com/new',
              title: 'Existing New',
              subCategory: 'ImportedSub',
            },
          ],
          parentCategoryId: 'cat-2',
          subCategories: [
            { name: 'ImportedObjSub' },
            { name: 'ExistingObjSub' },
            'ImportedStringSub',
          ],
          categoryKeywords: [
            { categoryName: 'news', keywords: ['new'] },
            { categoryName: 'tech', keywords: ['ai'] },
          ],
          savedAt: 50,
        },
        {
          id: 'imported-new-group',
          domain: 'https://new.example.com',
          urls: [
            {
              url: 'https://new.example.com/path',
              title: 'New Domain',
            },
          ],
          subCategories: [
            { name: 'ProjectObj' },
            { name: 'ProjectObj' },
            'ProjectStr',
          ],
          categoryKeywords: [{ categoryName: 'topic', keywords: ['keyword'] }],
          savedAt: 200,
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), true)

    expect(result.success).toBe(true)
    expect(result.message).toContain('1個のカテゴリと1個のドメイン')
    expect(migrateToUrlsStorage).toHaveBeenCalledTimes(1)

    expect(saveUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        excludePatterns: ['existing-pattern', 'new-pattern'],
        clickBehavior: 'saveWindowTabs',
        showSavedTime: true,
      }),
    )

    const savedCategoryArg = vi.mocked(saveParentCategories).mock.calls[0]?.[0]
    expect(savedCategoryArg).toHaveLength(2)
    expect(savedCategoryArg).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cat-1',
          name: 'Merged Category',
          domains: ['group-1', 'group-2'],
          domainNames: [
            'https://existing.example.com',
            'https://imported.example.com',
          ],
        }),
        expect.objectContaining({
          id: 'cat-2',
          name: 'New Category',
        }),
      ]),
    )

    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Array<
      Record<string, unknown>
    >
    expect(savedTabsArg).toHaveLength(2)

    const mergedExisting = savedTabsArg.find(
      tab => tab.domain === 'https://existing.example.com',
    )
    expect(mergedExisting).toEqual(
      expect.objectContaining({
        id: 'group-1',
        domain: 'https://existing.example.com',
        parentCategoryId: 'cat-2',
        savedAt: 50,
      }),
    )
    expect(mergedExisting?.urlIds).toEqual([
      'url-existing',
      'url-imported-existing',
    ])
    expect(mergedExisting?.urlSubCategories).toEqual({
      'url-existing': 'OldSub',
      'url-imported-existing': 'ImportedSub',
    })
    expect(mergedExisting?.subCategories).toEqual([
      'ExistingObjSub',
      'ExistingStrSub',
      'ImportedObjSub',
      'ImportedStringSub',
    ])
    expect(mergedExisting?.categoryKeywords).toEqual([
      { categoryName: 'news', keywords: ['old', 'new'] },
      { categoryName: 'tech', keywords: ['ai'] },
    ])

    const mergedNewDomain = savedTabsArg.find(
      tab => tab.domain === 'https://new.example.com',
    )
    expect(mergedNewDomain).toEqual(
      expect.objectContaining({
        id: 'imported-new-group',
        domain: 'https://new.example.com',
        urlIds: ['url-imported-new-domain'],
        subCategories: ['ProjectObj', 'ProjectStr'],
        categoryKeywords: [{ categoryName: 'topic', keywords: ['keyword'] }],
      }),
    )
  })

  it('importSettings replaces all data in overwrite mode', async () => {
    const { set } = createChromeMock()
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord)
      .mockRejectedValueOnce(new Error('failed to convert first URL'))
      .mockResolvedValueOnce({
        id: 'url-overwrite-2',
        url: 'https://replace.example.com/ok',
        title: 'ok',
        savedAt: 10,
      })

    const imported = {
      version: '3.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: false,
        excludePatterns: ['replace-pattern'],
        enableCategories: false,
        showSavedTime: true,
        autoDeletePeriod: '30days',
        clickBehavior: 'saveCurrentTab',
      },
      parentCategories: [
        {
          id: 'replace-cat',
          name: 'Replace Category',
          domains: [],
          domainNames: [],
          keywords: ['to-be-removed'],
        },
      ],
      savedTabs: [
        {
          id: 'replace-group',
          domain: 'https://replace.example.com',
          urls: [
            { url: 'https://replace.example.com/fail', title: 'fail' },
            {
              url: 'https://replace.example.com/ok',
              title: 'ok',
              subCategory: 'SubA',
            },
          ],
          subCategories: [{ name: 'ObjectSub' }, 'StringSub'],
          categoryKeywords: [{ categoryName: 'kw', keywords: ['alpha'] }],
          savedAt: 999,
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), false)

    expect(result.success).toBe(true)
    expect(result.message).toContain('設定とタブデータを置き換えました')
    expect(migrateToUrlsStorage).toHaveBeenCalledTimes(2)

    expect(saveUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        removeTabAfterOpen: false,
        enableCategories: false,
        showSavedTime: true,
        autoDeletePeriod: '30days',
        excludePatterns: ['replace-pattern'],
        clickBehavior: 'saveCurrentTab',
        excludePinnedTabs: defaultSettings.excludePinnedTabs,
        openUrlInBackground: defaultSettings.openUrlInBackground,
        openAllInNewWindow: defaultSettings.openAllInNewWindow,
        confirmDeleteAll: defaultSettings.confirmDeleteAll,
        confirmDeleteEach: defaultSettings.confirmDeleteEach,
        colors: defaultSettings.colors,
      }),
    )

    expect(saveParentCategories).toHaveBeenCalledWith([
      {
        id: 'replace-cat',
        name: 'Replace Category',
        domains: [],
        domainNames: [],
      },
    ])

    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Array<
      Record<string, unknown>
    >
    expect(savedTabsArg).toHaveLength(1)
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        id: 'replace-group',
        domain: 'https://replace.example.com',
        urlIds: ['url-overwrite-2'],
        urlSubCategories: { 'url-overwrite-2': 'SubA' },
        subCategories: ['ObjectSub', 'StringSub'],
        categoryKeywords: [{ categoryName: 'kw', keywords: ['alpha'] }],
        savedAt: 999,
      }),
    )
  })

  it('overwrite mode normalizes invalid keyword and subcategory entries', async () => {
    const { set } = createChromeMock()
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord).mockResolvedValue({
      id: 'url-normalize-1',
      url: 'https://normalize.example.com',
      title: 'Normalize',
      savedAt: 10,
    })

    const imported = {
      version: '4.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        excludePatterns: ['n1'],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [
        {
          id: 'normalize-cat',
          name: 'Normalize',
          domains: [],
          domainNames: [],
        },
      ],
      savedTabs: [
        {
          id: 'normalize-group',
          domain: 'https://normalize.example.com',
          urls: [{ url: 'https://normalize.example.com', title: 'Normalize' }],
          subCategories: [{ name: 'ObjSub' }, 123, 'StrSub', { name: 999 }],
          categoryKeywords: [
            { categoryName: 'valid', keywords: 'not-array' },
            { invalid: true },
            null,
          ],
          savedAt: 1,
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), false)

    expect(result.success).toBe(true)
    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Array<
      Record<string, unknown>
    >
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        subCategories: ['ObjSub', 'StrSub'],
        categoryKeywords: [{ categoryName: 'valid', keywords: [] }],
      }),
    )
  })

  it('overwrite mode supports tabs without categoryKeywords/subCategories', async () => {
    const { set } = createChromeMock()
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord).mockResolvedValue({
      id: 'url-minimal',
      url: 'https://minimal.example.com',
      title: '',
      savedAt: 10,
    })

    const imported = {
      version: '5.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'minimal-group',
          domain: 'https://minimal.example.com',
          urls: [{ url: 'https://minimal.example.com' }],
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), false)

    expect(result.success).toBe(true)
    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Array<
      Record<string, unknown>
    >
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        id: 'minimal-group',
        domain: 'https://minimal.example.com',
        urlIds: ['url-minimal'],
        subCategories: [],
        categoryKeywords: [],
      }),
    )
  })
})
