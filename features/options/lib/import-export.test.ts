// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserSettings } from '@/types/storage'

vi.mock('@/lib/storage/categories', () => ({
  saveParentCategories: vi.fn(),
}))

vi.mock('@/lib/storage/migration', () => ({
  migrateToUrlsStorage: vi.fn(),
}))

vi.mock('@/lib/storage/settings', () => {
  const defaultSettings: UserSettings = {
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

const buildFullUserSettings = (
  override: Partial<UserSettings> = {},
): UserSettings => ({
  removeTabAfterOpen: true,
  removeTabAfterExternalDrop: true,
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

describe('import-export ユーティリティ', () => {
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

  it('exportSettings はストレージと設定からバックアップ payload を返す', async () => {
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
      urls: [],
    })
  })

  it('移行しやすいバックアップデータ用に urlIds から urls を再構築する', async () => {
    const userSettings = buildFullUserSettings()
    createChromeMock({
      parentCategories: [],
      savedTabs: [
        {
          id: 'group-1',
          domain: 'https://portable.example.com',
          urlIds: ['url-1', 'url-2'],
          urlSubCategories: { 'url-2': 'Docs' },
        },
      ],
      urls: [
        {
          id: 'url-1',
          url: 'https://portable.example.com/home',
          title: 'Home',
          savedAt: 1,
        },
        {
          id: 'url-2',
          url: 'https://portable.example.com/docs',
          title: 'Docs',
          savedAt: 2,
        },
      ],
    })
    vi.mocked(getUserSettings).mockResolvedValue(userSettings)

    const result = await exportSettings()

    expect(result.savedTabs[0]).toEqual(
      expect.objectContaining({
        id: 'group-1',
        domain: 'https://portable.example.com',
        urls: [
          {
            url: 'https://portable.example.com/home',
            title: 'Home',
            savedAt: 1,
            subCategory: undefined,
          },
          {
            url: 'https://portable.example.com/docs',
            title: 'Docs',
            savedAt: 2,
            subCategory: 'Docs',
          },
        ],
      }),
    )
    expect(result.urls).toHaveLength(2)
  })

  it('urlIds を解決できない場合はプレースホルダー URL を追加する', async () => {
    const userSettings = buildFullUserSettings()
    createChromeMock({
      parentCategories: [],
      savedTabs: [
        {
          id: 'missing-group',
          domain: 'https://missing-export.example.com',
          urlIds: ['missing-id-1', 'missing-id-2'],
          urlSubCategories: { 'missing-id-2': 'RecoveredSub' },
          savedAt: 100,
        },
      ],
      urls: [],
    })
    vi.mocked(getUserSettings).mockResolvedValue(userSettings)

    const result = await exportSettings()

    expect(result.savedTabs[0]).toEqual(
      expect.objectContaining({
        id: 'missing-group',
        domain: 'https://missing-export.example.com',
        urls: [
          {
            url: 'https://missing-export.example.com/#tabbin-export-missing-missing-id-1',
            title: '復元データ（元URL欠損）',
            savedAt: 100,
            subCategory: undefined,
          },
          {
            url: 'https://missing-export.example.com/#tabbin-export-missing-missing-id-2',
            title: '復元データ（元URL欠損）',
            savedAt: 101,
            subCategory: 'RecoveredSub',
          },
        ],
      }),
    )
    expect(result.urls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'missing-id-1',
          url: 'https://missing-export.example.com/#tabbin-export-missing-missing-id-1',
        }),
        expect.objectContaining({
          id: 'missing-id-2',
          url: 'https://missing-export.example.com/#tabbin-export-missing-missing-id-2',
        }),
      ]),
    )
  })

  it('tab.urls が既にある場合は不正な legacy url 項目を除外する', async () => {
    const userSettings = buildFullUserSettings()
    createChromeMock({
      parentCategories: [],
      savedTabs: [
        {
          id: 'legacy-group',
          domain: 'https://legacy.example.com',
          urls: [
            { url: 'https://legacy.example.com/ok', title: 'ok' },
            { title: 'missing-url' },
            null,
          ],
        },
      ],
      urls: [],
    })
    vi.mocked(getUserSettings).mockResolvedValue(userSettings)

    const result = await exportSettings()

    expect(result.savedTabs[0]).toEqual(
      expect.objectContaining({
        urls: [{ url: 'https://legacy.example.com/ok', title: 'ok' }],
      }),
    )
  })

  it('再構築した urls に fallback の savedAt/title 分岐を使う', async () => {
    createChromeMock({
      parentCategories: [],
      savedTabs: [
        {
          id: 'placeholder-no-savedat',
          domain: 'https://placeholder-branch.example.com/',
          urlIds: ['missing-no-savedat'],
        },
        {
          id: 'titleless-record-group',
          domain: 'https://titleless-record.example.com',
          urlIds: ['titleless-record-id'],
        },
      ],
      urls: [
        {
          id: 'titleless-record-id',
          url: 'https://titleless-record.example.com/path',
          savedAt: 55,
        },
      ],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-16T00:00:10.000Z'))

    const result = await exportSettings()

    const placeholderGroup = result.savedTabs.find(
      tab => tab.id === 'placeholder-no-savedat',
    )
    expect(placeholderGroup?.urls?.[0]).toEqual(
      expect.objectContaining({
        url: 'https://placeholder-branch.example.com/#tabbin-export-missing-missing-no-savedat',
        savedAt: new Date('2026-02-16T00:00:10.000Z').getTime(),
      }),
    )

    const titlelessGroup = result.savedTabs.find(
      tab => tab.id === 'titleless-record-group',
    )
    expect(titlelessGroup?.urls?.[0]).toEqual(
      expect.objectContaining({
        url: 'https://titleless-record.example.com/path',
        title: '',
      }),
    )
  })

  it('マージ済みプレースホルダーマップの has() が予期せず true を返しても処理できる', async () => {
    const originalHas = Map.prototype.has
    let hasCallCount = 0
    const hasSpy = vi.spyOn(Map.prototype, 'has').mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown,
    ) {
      hasCallCount += 1
      if (hasCallCount === 2 && key === 'forced-skip-placeholder-id') {
        return true
      }
      return originalHas.call(this, key)
    })

    createChromeMock({
      parentCategories: [],
      savedTabs: [
        {
          id: 'forced-skip-group',
          domain: 'https://forced-skip.example.com',
          urlIds: ['forced-skip-placeholder-id'],
        },
      ],
      urls: [],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    const result = await exportSettings()

    expect(result.savedTabs[0]?.urls).toHaveLength(1)
    hasSpy.mockRestore()
  })

  it('ストレージアクセス失敗時に正規化されたエラーを投げる', async () => {
    createChromeMock({}, { failGet: true })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    await expect(exportSettings()).rejects.toThrow(
      'データのエクスポート中にエラーが発生しました',
    )
  })

  it('manifest の version が空ならデフォルト版にフォールバックする', async () => {
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

  it('配列でないストレージ payload でも処理できる', async () => {
    createChromeMock({
      parentCategories: { invalid: true },
      savedTabs: { invalid: true },
      urls: { invalid: true },
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    const result = await exportSettings()

    expect(result.parentCategories).toEqual([])
    expect(result.savedTabs).toEqual([])
    expect(result.urls).toEqual([])
  })

  it('downloadAsJson は一時的なアンカーを作成してクリーンアップする', () => {
    const originalCreateObjectUrl = URL.createObjectURL
    const originalRevokeObjectUrl = URL.revokeObjectURL
    const createObjectUrl = vi.fn(() => 'blob:mock-url')
    const revokeObjectUrl = vi.fn()

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrl,
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

    expect(createObjectUrl).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:mock-url')
    expect(document.querySelector('a[download="backup.json"]')).toBeNull()

    rafSpy.mockRestore()
    clickSpy.mockRestore()

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectUrl,
    })
  })

  it('importSettings はスキーマ不正な JSON に対してバリデーションエラーを返す', async () => {
    createChromeMock()

    const result = await importSettings(JSON.stringify({ foo: 'bar' }))

    expect(result).toEqual({
      success: false,
      message: 'インポートされたデータの形式が正しくありません',
    })
    expect(saveUserSettings).not.toHaveBeenCalled()
    expect(saveParentCategories).not.toHaveBeenCalled()
  })

  it('importSettings は不正な JSON 形式に対して汎用エラーを返す', async () => {
    createChromeMock()

    const result = await importSettings('{malformed-json')

    expect(result).toEqual({
      success: false,
      message: 'データのインポート中にエラーが発生しました',
    })
  })

  it('バックアップに URL レコードがある場合 urlIds のみのタブを復元する', async () => {
    const { set } = createChromeMock({
      parentCategories: [],
      savedTabs: [],
      urls: [],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord).mockResolvedValue({
      id: 'restored-url-id',
      url: 'https://restored.example.com/path',
      title: 'Restored',
      savedAt: 1,
    })

    const imported = {
      version: '6.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        removeTabAfterExternalDrop: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'restored-group',
          domain: 'https://restored.example.com',
          urlIds: ['backup-url-1'],
          urlSubCategories: { 'backup-url-1': 'FromBackup' },
        },
      ],
      urls: [
        {
          id: 'backup-url-1',
          url: 'https://restored.example.com/path',
          title: 'Restored',
          savedAt: 10,
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), false)

    expect(result.success).toBe(true)
    expect(createOrUpdateUrlRecord).toHaveBeenCalledWith(
      'https://restored.example.com/path',
      'Restored',
      undefined,
    )

    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        id: 'restored-group',
        domain: 'https://restored.example.com',
        urlIds: ['restored-url-id'],
        urlSubCategories: { 'restored-url-id': 'FromBackup' },
      }),
    )
  })

  it('バックアップ URL レコードから空タイトル fallback を使って urlIds のみのタブを復元する', async () => {
    createChromeMock({
      parentCategories: [],
      savedTabs: [],
      urls: [],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())
    vi.mocked(createOrUpdateUrlRecord).mockResolvedValue({
      id: 'restored-titleless-url-id',
      url: 'https://restored-titleless.example.com/path',
      title: '',
      savedAt: 1,
    })

    const imported = {
      version: '6.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        removeTabAfterExternalDrop: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'restored-titleless-group',
          domain: 'https://restored-titleless.example.com',
          urlIds: ['backup-titleless-url-1'],
        },
      ],
      urls: [
        {
          id: 'backup-titleless-url-1',
          url: 'https://restored-titleless.example.com/path',
          savedAt: 10,
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), false)

    expect(result.success).toBe(true)
    expect(createOrUpdateUrlRecord).toHaveBeenCalledWith(
      'https://restored-titleless.example.com/path',
      '',
      undefined,
    )
  })

  it('importSettings は URL レコード不足時にプレースホルダー URL を生成する', async () => {
    const { set } = createChromeMock({
      parentCategories: [],
      savedTabs: [],
      urls: [],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    const imported = {
      version: '6.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        removeTabAfterExternalDrop: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'missing-group',
          domain: 'https://missing.example.com',
          urlIds: ['missing-url-id'],
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), true)

    expect(result.success).toBe(true)
    expect(result.message).toContain('代替URLを生成しました')
    expect(createOrUpdateUrlRecord).not.toHaveBeenCalled()
    expect(saveUserSettings).toHaveBeenCalledTimes(1)
    expect(saveParentCategories).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith({
      savedTabs: [
        {
          id: 'missing-group',
          domain: 'https://missing.example.com',
          urlIds: ['missing-url-id'],
          urlSubCategories: undefined,
          parentCategoryId: undefined,
          categoryKeywords: [],
          subCategories: [],
          savedAt: undefined,
        },
      ],
    })
    expect(set).toHaveBeenCalledWith({
      urls: [
        expect.objectContaining({
          id: 'missing-url-id',
          title: '復元データ（元URL欠損）',
        }),
      ],
    })
  })

  it('overwrite モードでは URL レコード不足時にプレースホルダー URL を生成する', async () => {
    const { set } = createChromeMock({
      parentCategories: [],
      savedTabs: [],
      urls: [],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    const imported = {
      version: '6.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        removeTabAfterExternalDrop: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'missing-overwrite-group',
          domain: 'https://missing-overwrite.example.com',
          urlIds: ['missing-overwrite-url-id'],
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), false)

    expect(result.success).toBe(true)
    expect(result.message).toContain('代替URLを生成しました')
    expect(createOrUpdateUrlRecord).not.toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith({
      savedTabs: [
        {
          id: 'missing-overwrite-group',
          domain: 'https://missing-overwrite.example.com',
          urlIds: ['missing-overwrite-url-id'],
          urlSubCategories: undefined,
          parentCategoryId: undefined,
          subCategories: [],
          categoryKeywords: [],
          savedAt: undefined,
        },
      ],
    })
    expect(set).toHaveBeenCalledWith({
      urls: [
        expect.objectContaining({
          id: 'missing-overwrite-url-id',
          title: '復元データ（元URL欠損）',
        }),
      ],
    })
  })

  it('overwrite モードでは raw urlIds の fallback を保持し、後続で id が既に存在する場合はプレースホルダー生成をスキップする', async () => {
    const existingUrlRecord = {
      id: 'already-resolved-id',
      url: 'https://existing.example.com/current',
      title: 'Current',
      savedAt: 1,
    }
    const lateAvailablePlaceholder = {
      id: 'raw-fallback-id',
      url: 'https://fallback.example.com/#tabbin-restored-raw-fallback-id',
      title: '復元データ（元URL欠損）',
      savedAt: 2,
    }

    const { get, set } = createChromeMock({
      parentCategories: [],
      savedTabs: [],
      urls: [existingUrlRecord],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    let urlsGetCount = 0
    get.mockImplementation(
      async (keys?: string | string[] | Record<string, unknown>) => {
        if (
          keys &&
          typeof keys === 'object' &&
          !Array.isArray(keys) &&
          'urls' in keys
        ) {
          urlsGetCount += 1
          if (urlsGetCount === 1) {
            return { urls: [existingUrlRecord] }
          }

          return { urls: [existingUrlRecord, lateAvailablePlaceholder] }
        }

        if (keys == null) {
          return {}
        }
        if (typeof keys === 'string') {
          return { [keys]: undefined }
        }
        if (Array.isArray(keys)) {
          return Object.fromEntries(keys.map(key => [key, undefined]))
        }

        return Object.fromEntries(Object.entries(keys))
      },
    )

    const imported = {
      version: '6.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        removeTabAfterExternalDrop: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'raw-fallback-group',
          domain: 'https://fallback.example.com/',
          urlIds: ['raw-fallback-id', 'raw-fallback-id'],
          urlSubCategories: {
            'raw-fallback-id': 'KeepMe',
            'not-in-urlids': 'DropMe',
          },
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), false)

    expect(result.success).toBe(true)
    expect(result.message).toContain('0件の代替URLを生成しました')
    expect(createOrUpdateUrlRecord).not.toHaveBeenCalled()

    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        id: 'raw-fallback-group',
        domain: 'https://fallback.example.com/',
        urlIds: ['raw-fallback-id'],
        urlSubCategories: { 'raw-fallback-id': 'KeepMe' },
      }),
    )

    expect(
      set.mock.calls.some(
        ([payload]) =>
          !!(
            (payload as Record<string, unknown>)?.urls &&
            Array.isArray((payload as Record<string, unknown>).urls) &&
            ((payload as Record<string, unknown>).urls as unknown[]).some(
              record =>
                typeof record === 'object' &&
                record !== null &&
                (record as { id?: string }).id === 'raw-fallback-id',
            )
          ),
      ),
    ).toBe(false)
  })

  it('overwrite モードでは urls/urlIds を持たないタブを空グループとして保持する', async () => {
    const { set } = createChromeMock({
      parentCategories: [],
      savedTabs: [],
      urls: [],
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    const imported = {
      version: '6.1.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        removeTabAfterExternalDrop: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'empty-group',
          domain: 'https://empty.example.com',
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), false)

    expect(result.success).toBe(true)
    expect(createOrUpdateUrlRecord).not.toHaveBeenCalled()

    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        id: 'empty-group',
        domain: 'https://empty.example.com',
        urlIds: [],
        urlSubCategories: undefined,
        subCategories: [],
        categoryKeywords: [],
      }),
    )
  })

  it('overwrite モードでは現在の urls ストレージが配列でなくてもプレースホルダーを生成する', async () => {
    const { set } = createChromeMock({
      parentCategories: [],
      savedTabs: [],
      urls: { invalid: true },
    })
    vi.mocked(getUserSettings).mockResolvedValue(buildFullUserSettings())

    const imported = {
      version: '6.2.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        removeTabAfterExternalDrop: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
      },
      parentCategories: [],
      savedTabs: [
        {
          id: 'invalid-current-urls-group',
          domain: 'https://invalid-current-urls.example.com',
          urlIds: ['invalid-current-urls-id'],
        },
      ],
    }

    const result = await importSettings(JSON.stringify(imported), false)

    expect(result.success).toBe(true)
    expect(result.message).toContain('1件の代替URLを生成しました')
    expect(set).toHaveBeenCalledWith({
      urls: [
        expect.objectContaining({
          id: 'invalid-current-urls-id',
          title: '復元データ（元URL欠損）',
        }),
      ],
    })
  })

  it('merge モードでは配列でない現在ストレージを安全に処理する', async () => {
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
        removeTabAfterExternalDrop: true,
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

  it('merge モードではインポート値が省略された場合に既存の parent/savedAt を保持する', async () => {
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
        removeTabAfterExternalDrop: true,
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

    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
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

  it('merge モードでは重複 URL ID を避けつつ混在した subcategory/keyword payload を正規化する', async () => {
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
        removeTabAfterExternalDrop: true,
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
    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
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

  it('merge モードでは新規ドメインの keyword と subcategory の境界ケースを正規化する', async () => {
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
        removeTabAfterExternalDrop: true,
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
    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        categoryKeywords: [{ categoryName: 'edge', keywords: [] }],
        subCategories: ['Obj', 'Str'],
      }),
    )
  })

  it('merge モードでは has() 後の keyword map 参照が undefined を返しても処理できる', async () => {
    const originalGet = Map.prototype.get
    const getSpy = vi.spyOn(Map.prototype, 'get').mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown,
    ) {
      if (key === 'force-undefined-existing-item') {
        return
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
        removeTabAfterExternalDrop: true,
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

  it('importSettings は merge モードで既存データとインポートデータを結合する', async () => {
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
        removeTabAfterExternalDrop: true,
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

    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
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

  it('importSettings は overwrite モードで全データを置き換える', async () => {
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
        removeTabAfterExternalDrop: true,
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
        removeTabAfterExternalDrop: true,
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

    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
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

  it('overwrite モードでは不正な keyword と subcategory エントリを正規化する', async () => {
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
        removeTabAfterExternalDrop: true,
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
    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
    expect(savedTabsArg[0]).toEqual(
      expect.objectContaining({
        subCategories: ['ObjSub', 'StrSub'],
        categoryKeywords: [{ categoryName: 'valid', keywords: [] }],
      }),
    )
  })

  it('overwrite モードでは categoryKeywords/subCategories がないタブもサポートする', async () => {
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
        removeTabAfterExternalDrop: true,
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
    const savedTabsArg = set.mock.calls[0]?.[0]?.savedTabs as Record<
      string,
      unknown
    >[]
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
