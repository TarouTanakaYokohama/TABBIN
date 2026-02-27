import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserSettings } from '@/types/storage'

const mocked = vi.hoisted(() => ({
  saveTabsWithAutoCategory: vi.fn(),
  addUrlToCustomProject: vi.fn(),
  createCustomProject: vi.fn(),
  getCustomProjects: vi.fn(),
  getUserSettings: vi.fn(),
  openSavedTabsPage: vi.fn(),
  filterTabsByUserSettings: vi.fn(),
  showNotification: vi.fn(),
}))

vi.mock('@/lib/storage/migration', () => ({
  saveTabsWithAutoCategory: mocked.saveTabsWithAutoCategory,
}))

vi.mock('@/lib/storage/projects', () => ({
  addUrlToCustomProject: mocked.addUrlToCustomProject,
  createCustomProject: mocked.createCustomProject,
  getCustomProjects: mocked.getCustomProjects,
}))

vi.mock('@/lib/storage/settings', () => ({
  getUserSettings: mocked.getUserSettings,
}))

vi.mock('./saved-tabs-page', () => ({
  openSavedTabsPage: mocked.openSavedTabsPage,
}))

vi.mock('./utils', () => ({
  filterTabsByUserSettings: mocked.filterTabsByUserSettings,
  showNotification: mocked.showNotification,
}))

import {
  handleExtensionActionClick,
  handleSaveAllWindowsTabs,
  handleSaveCurrentTab,
  handleSaveSameDomainTabs,
  handleSaveWindowTabs,
  syncToCustomProjects,
} from './extension-actions'

type TabsHarness = {
  query: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

function createChromeTabsHarness(): TabsHarness {
  const query = vi.fn()
  const remove = vi.fn(async () => undefined)

  ;(globalThis as { chrome?: typeof chrome }).chrome = {
    tabs: {
      query,
      remove,
    },
  } as unknown as typeof chrome

  return { query, remove }
}

const buildSettings = (override: Partial<UserSettings> = {}): UserSettings => ({
  removeTabAfterOpen: true,
  removeTabAfterExternalDrop: true,
  excludePatterns: ['chrome://', 'ignore.example'],
  enableCategories: true,
  autoDeletePeriod: 'never',
  showSavedTime: false,
  clickBehavior: 'saveWindowTabs',
  excludePinnedTabs: true,
  openUrlInBackground: true,
  openAllInNewWindow: false,
  confirmDeleteAll: false,
  confirmDeleteEach: false,
  colors: {},
  ...override,
})

const tab = (partial: Partial<chrome.tabs.Tab>): chrome.tabs.Tab =>
  ({
    id: partial.id,
    url: partial.url,
    title: partial.title,
    pinned: partial.pinned ?? false,
  }) as chrome.tabs.Tab

describe('extension-actions モジュール', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mocked.saveTabsWithAutoCategory.mockResolvedValue(undefined)
    mocked.addUrlToCustomProject.mockResolvedValue(undefined)
    mocked.createCustomProject.mockResolvedValue({ id: 'default-project' })
    mocked.getCustomProjects.mockResolvedValue([])
    mocked.getUserSettings.mockResolvedValue(buildSettings())
    mocked.openSavedTabsPage.mockResolvedValue(9999)
    mocked.filterTabsByUserSettings.mockImplementation(
      async (tabs: unknown) => tabs,
    )
    mocked.showNotification.mockResolvedValue(undefined)
  })

  describe('syncToCustomProjects関数', () => {
    it('プロジェクトが存在しない場合はデフォルトプロジェクトを作成して各 URL を追加する', async () => {
      mocked.getCustomProjects.mockResolvedValueOnce([])
      mocked.createCustomProject.mockResolvedValueOnce({ id: 'project-1' })

      await expect(
        syncToCustomProjects([
          { url: 'https://a.example', title: 'A' },
          { url: 'https://b.example', title: 'B' },
        ]),
      ).resolves.toBeUndefined()

      expect(mocked.createCustomProject).toHaveBeenCalledWith(
        'デフォルトプロジェクト',
        '自動的に作成されたプロジェクト',
      )
      expect(mocked.addUrlToCustomProject).toHaveBeenNthCalledWith(
        1,
        'project-1',
        'https://a.example',
        'A',
      )
      expect(mocked.addUrlToCustomProject).toHaveBeenNthCalledWith(
        2,
        'project-1',
        'https://b.example',
        'B',
      )
    })

    it('最初の既存プロジェクトに URL を追加する', async () => {
      mocked.getCustomProjects.mockResolvedValueOnce([
        { id: 'existing-1', name: 'Work' },
        { id: 'existing-2', name: 'Other' },
      ])

      await syncToCustomProjects([{ url: 'https://a.example', title: 'A' }])

      expect(mocked.createCustomProject).not.toHaveBeenCalled()
      expect(mocked.addUrlToCustomProject).toHaveBeenCalledWith(
        'existing-1',
        'https://a.example',
        'A',
      )
    })

    it('同期エラーを握りつぶしてログ出力する', async () => {
      const error = new Error('projects failed')
      mocked.getCustomProjects.mockRejectedValueOnce(error)

      await expect(syncToCustomProjects([])).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith(
        'カスタムプロジェクトへの同期中にエラーが発生しました:',
        error,
      )
    })
  })

  describe('handleSaveCurrentTab関数', () => {
    it('フィルタ後にタブが残らない場合は空を返す', async () => {
      const chromeTabs = createChromeTabsHarness()
      chromeTabs.query.mockResolvedValueOnce([
        tab({ id: 1, url: 'https://a.example' }),
      ])
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([])

      await expect(handleSaveCurrentTab()).resolves.toEqual([])

      expect(mocked.saveTabsWithAutoCategory).not.toHaveBeenCalled()
      expect(mocked.showNotification).not.toHaveBeenCalled()
      expect(chromeTabs.remove).not.toHaveBeenCalled()
    })

    it('現在のタブを保存して通知し、閉じて、url/title を返す', async () => {
      const chromeTabs = createChromeTabsHarness()
      const activeTab = tab({
        id: 10,
        url: 'https://current.example/path',
        title: 'Current',
      })
      chromeTabs.query.mockResolvedValueOnce([activeTab])
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([activeTab])

      const result = await handleSaveCurrentTab()

      expect(chromeTabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      })
      expect(mocked.saveTabsWithAutoCategory).toHaveBeenCalledWith([activeTab])
      expect(mocked.showNotification).toHaveBeenCalledWith(
        'タブ保存',
        '現在のタブを保存しました',
      )
      expect(chromeTabs.remove).toHaveBeenCalledWith(10)
      expect(result).toEqual([
        { url: 'https://current.example/path', title: 'Current' },
      ])
    })

    it('タブを閉じる処理が失敗した場合はログ出力して継続する', async () => {
      const chromeTabs = createChromeTabsHarness()
      const activeTab = tab({
        id: 11,
        url: 'https://current.example/fail-close',
        title: 'Current',
      })
      const error = new Error('remove failed')
      chromeTabs.query.mockResolvedValueOnce([activeTab])
      chromeTabs.remove.mockRejectedValueOnce(error)
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([activeTab])

      await expect(handleSaveCurrentTab()).resolves.toEqual([
        { url: 'https://current.example/fail-close', title: 'Current' },
      ])

      expect(console.error).toHaveBeenCalledWith(
        'タブを閉じる際にエラー:',
        error,
      )
    })

    it('アクティブタブに id がない場合は fallback タイトルを返してクローズをスキップする', async () => {
      const chromeTabs = createChromeTabsHarness()
      const activeTab = tab({
        id: undefined,
        url: 'https://current.example/no-id',
        title: undefined,
      })
      chromeTabs.query.mockResolvedValueOnce([activeTab])
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([activeTab])

      await expect(handleSaveCurrentTab()).resolves.toEqual([
        { url: 'https://current.example/no-id', title: '' },
      ])

      expect(chromeTabs.remove).not.toHaveBeenCalled()
    })
  })

  describe('handleSaveSameDomainTabs関数', () => {
    it('アクティブタブがない、または url がない場合は空を返す', async () => {
      const chromeTabs = createChromeTabsHarness()
      chromeTabs.query.mockResolvedValueOnce([tab({ id: 1, url: undefined })])

      await expect(handleSaveSameDomainTabs()).resolves.toEqual([])

      expect(mocked.filterTabsByUserSettings).not.toHaveBeenCalled()
      expect(mocked.saveTabsWithAutoCategory).not.toHaveBeenCalled()
    })

    it('同一ドメインタブを保存して通知し、対象タブのみ閉じる', async () => {
      const chromeTabs = createChromeTabsHarness()
      const active = tab({
        id: 20,
        url: 'https://same.example/page-1',
        title: 'Active',
      })
      const allCurrentWindowTabs = [
        active,
        tab({ id: 21, url: 'https://same.example/page-2', title: 'Same2' }),
        tab({ id: 25, url: undefined, title: 'NoUrl' }),
        tab({ id: 22, url: 'https://ignore.example/page', title: 'Ignored' }),
        tab({ id: 23, url: 'not-a-valid-url', title: 'Broken' }),
        tab({ id: 24, url: 'https://other.example/page', title: 'Other' }),
        tab({
          id: undefined,
          url: 'https://same.example/no-id',
          title: 'NoId',
        }),
      ]
      const filteredTabs = [
        active,
        tab({ id: 21, url: 'https://same.example/page-2', title: 'Same2' }),
        tab({ id: 22, url: 'https://ignore.example/page', title: 'Ignored' }),
        tab({
          id: undefined,
          url: 'https://same.example/no-id',
          title: 'NoId',
        }),
      ]

      chromeTabs.query
        .mockResolvedValueOnce([active])
        .mockResolvedValueOnce(allCurrentWindowTabs)
      mocked.filterTabsByUserSettings.mockResolvedValueOnce(filteredTabs)
      mocked.getUserSettings.mockResolvedValueOnce(
        buildSettings({
          excludePatterns: ['ignore.example'],
        }),
      )

      const result = await handleSaveSameDomainTabs()

      expect(chromeTabs.query).toHaveBeenNthCalledWith(1, {
        active: true,
        currentWindow: true,
      })
      expect(chromeTabs.query).toHaveBeenNthCalledWith(2, {
        currentWindow: true,
      })
      expect(mocked.filterTabsByUserSettings).toHaveBeenCalledWith([
        active,
        tab({ id: 21, url: 'https://same.example/page-2', title: 'Same2' }),
        tab({
          id: undefined,
          url: 'https://same.example/no-id',
          title: 'NoId',
        }),
      ])
      expect(mocked.saveTabsWithAutoCategory).toHaveBeenCalledWith(filteredTabs)
      expect(mocked.showNotification).toHaveBeenCalledWith(
        'タブ保存',
        'same.exampleの4個のタブを保存しました',
      )
      expect(chromeTabs.remove).toHaveBeenCalledWith([20, 21])
      expect(result).toEqual([
        { url: 'https://same.example/page-1', title: 'Active' },
        { url: 'https://same.example/page-2', title: 'Same2' },
        { url: 'https://ignore.example/page', title: 'Ignored' },
        { url: 'https://same.example/no-id', title: 'NoId' },
      ])
    })

    it('閉じられる同一ドメインタブがない場合は fallback タイトルを返して一括クローズをスキップする', async () => {
      const chromeTabs = createChromeTabsHarness()
      const active = tab({
        id: 34,
        url: 'https://same.example/page',
        title: undefined,
      })

      chromeTabs.query
        .mockResolvedValueOnce([active])
        .mockResolvedValueOnce([active])
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([active])
      mocked.getUserSettings.mockResolvedValueOnce(
        buildSettings({ excludePatterns: ['same.example'] }),
      )

      await expect(handleSaveSameDomainTabs()).resolves.toEqual([
        { url: 'https://same.example/page', title: '' },
      ])

      expect(chromeTabs.remove).not.toHaveBeenCalled()
    })

    it('同一ドメインタブがすべてフィルタ除外された場合は空を返す', async () => {
      const chromeTabs = createChromeTabsHarness()
      const active = tab({
        id: 30,
        url: 'https://same.example/page',
        title: 'Active',
      })
      chromeTabs.query
        .mockResolvedValueOnce([active])
        .mockResolvedValueOnce([active])
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([])

      await expect(handleSaveSameDomainTabs()).resolves.toEqual([])

      expect(mocked.saveTabsWithAutoCategory).not.toHaveBeenCalled()
      expect(mocked.showNotification).not.toHaveBeenCalled()
      expect(chromeTabs.remove).not.toHaveBeenCalled()
    })

    it('現在タブ URL の解析に失敗した場合はログ出力して空を返す', async () => {
      const chromeTabs = createChromeTabsHarness()
      chromeTabs.query.mockResolvedValueOnce([
        tab({ id: 31, url: 'not a url', title: 'Broken Active' }),
      ])

      await expect(handleSaveSameDomainTabs()).resolves.toEqual([])

      expect(console.error).toHaveBeenCalledWith(
        'ドメインタブ保存エラー:',
        expect.any(Error),
      )
    })

    it('同一ドメインフローの一括クローズ失敗時はログ出力して継続する', async () => {
      const chromeTabs = createChromeTabsHarness()
      const active = tab({
        id: 32,
        url: 'https://same.example/page',
        title: 'Active',
      })
      const sameTabs = [
        active,
        tab({ id: 33, url: 'https://same.example/2', title: 'Two' }),
      ]
      const error = new Error('remove failed')

      chromeTabs.query
        .mockResolvedValueOnce([active])
        .mockResolvedValueOnce(sameTabs)
      chromeTabs.remove.mockRejectedValueOnce(error)
      mocked.filterTabsByUserSettings.mockResolvedValueOnce(sameTabs)
      mocked.getUserSettings.mockResolvedValueOnce(
        buildSettings({ excludePatterns: [] }),
      )

      await expect(handleSaveSameDomainTabs()).resolves.toEqual([
        { url: 'https://same.example/page', title: 'Active' },
        { url: 'https://same.example/2', title: 'Two' },
      ])

      expect(console.error).toHaveBeenCalledWith(
        'タブを閉じる際にエラー:',
        error,
      )
    })
  })

  describe('handleSaveAllWindowsTabs関数', () => {
    it('すべてのタブがフィルタ除外された場合は空を返す', async () => {
      const chromeTabs = createChromeTabsHarness()
      chromeTabs.query.mockResolvedValueOnce([
        tab({ id: 40, url: 'https://a.example', title: 'A' }),
      ])
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([])

      await expect(handleSaveAllWindowsTabs()).resolves.toEqual([])

      expect(mocked.saveTabsWithAutoCategory).not.toHaveBeenCalled()
      expect(mocked.showNotification).not.toHaveBeenCalled()
      expect(mocked.openSavedTabsPage).not.toHaveBeenCalled()
      expect(chromeTabs.remove).not.toHaveBeenCalled()
    })

    it('全ウィンドウのタブを保存し、一括クローズ対象から saved-tabs ページを除外する', async () => {
      const chromeTabs = createChromeTabsHarness()
      const tabs = [
        tab({ id: 41, url: 'https://a.example', title: 'A' }),
        tab({ id: 42, url: 'https://b.example', title: 'B' }),
        tab({ id: 43, url: 'https://saved-tabs.example', title: 'Saved' }),
      ]
      chromeTabs.query.mockResolvedValueOnce(tabs)
      mocked.filterTabsByUserSettings.mockResolvedValueOnce(tabs)
      mocked.openSavedTabsPage.mockResolvedValueOnce(43)

      const result = await handleSaveAllWindowsTabs()

      expect(chromeTabs.query).toHaveBeenCalledWith({})
      expect(mocked.saveTabsWithAutoCategory).toHaveBeenCalledWith(tabs)
      expect(mocked.showNotification).toHaveBeenCalledWith(
        'タブ保存',
        'すべてのウィンドウから3個のタブを保存しました',
      )
      expect(chromeTabs.remove).toHaveBeenCalledWith([41, 42])
      expect(result).toEqual([
        { url: 'https://a.example', title: 'A' },
        { url: 'https://b.example', title: 'B' },
        { url: 'https://saved-tabs.example', title: 'Saved' },
      ])
    })

    it('閉じられる全ウィンドウタブがない場合は fallback タイトルを返して一括クローズをスキップする', async () => {
      const chromeTabs = createChromeTabsHarness()
      const tabs = [
        tab({ id: 46, url: 'https://saved-tabs.example', title: undefined }),
      ]
      chromeTabs.query.mockResolvedValueOnce(tabs)
      mocked.filterTabsByUserSettings.mockResolvedValueOnce(tabs)
      mocked.openSavedTabsPage.mockResolvedValueOnce(46)

      await expect(handleSaveAllWindowsTabs()).resolves.toEqual([
        { url: 'https://saved-tabs.example', title: '' },
      ])

      expect(chromeTabs.remove).not.toHaveBeenCalled()
    })

    it('全タブ取得に失敗した場合はログ出力して空を返す', async () => {
      const chromeTabs = createChromeTabsHarness()
      const error = new Error('query failed')
      chromeTabs.query.mockRejectedValueOnce(error)

      await expect(handleSaveAllWindowsTabs()).resolves.toEqual([])

      expect(console.error).toHaveBeenCalledWith(
        'すべてのタブ保存エラー:',
        error,
      )
    })

    it('全ウィンドウフローの一括クローズ失敗時はログ出力して継続する', async () => {
      const chromeTabs = createChromeTabsHarness()
      const tabs = [
        tab({ id: 44, url: 'https://a.example', title: 'A' }),
        tab({ id: 45, url: 'https://b.example', title: 'B' }),
      ]
      const error = new Error('remove failed')
      chromeTabs.query.mockResolvedValueOnce(tabs)
      chromeTabs.remove.mockRejectedValueOnce(error)
      mocked.filterTabsByUserSettings.mockResolvedValueOnce(tabs)
      mocked.openSavedTabsPage.mockResolvedValueOnce(999)

      await expect(handleSaveAllWindowsTabs()).resolves.toEqual([
        { url: 'https://a.example', title: 'A' },
        { url: 'https://b.example', title: 'B' },
      ])

      expect(console.error).toHaveBeenCalledWith(
        'タブを閉じる際にエラー:',
        error,
      )
    })
  })

  describe('handleSaveWindowTabs関数', () => {
    it('現在ウィンドウのタブがすべてフィルタ除外された場合は空を返す', async () => {
      const chromeTabs = createChromeTabsHarness()
      chromeTabs.query.mockResolvedValueOnce([
        tab({ id: 60, url: 'https://x.example', title: 'X' }),
      ])
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([])

      await expect(handleSaveWindowTabs()).resolves.toEqual([])

      expect(mocked.saveTabsWithAutoCategory).not.toHaveBeenCalled()
      expect(chromeTabs.remove).not.toHaveBeenCalled()
    })

    it('フィルタ済みタブを保存し、saved-tabs ページ/除外 URL を除く対象タブを閉じる', async () => {
      const chromeTabs = createChromeTabsHarness()
      const queriedTabs = [
        tab({ id: 1, url: 'https://keep.example/1', title: 'One' }),
        tab({ id: 2, url: 'https://ignore.example/2', title: 'Ignored' }),
        tab({ id: 3, url: 'https://saved-tabs.example', title: 'Saved Page' }),
      ]
      chromeTabs.query.mockResolvedValueOnce(queriedTabs)
      mocked.filterTabsByUserSettings.mockResolvedValueOnce(queriedTabs)
      mocked.openSavedTabsPage.mockResolvedValueOnce(3)
      mocked.getUserSettings
        .mockResolvedValueOnce(buildSettings())
        .mockResolvedValueOnce(
          buildSettings({
            excludePatterns: ['ignore.example'],
          }),
        )

      const result = await handleSaveWindowTabs()

      expect(chromeTabs.query).toHaveBeenCalledWith({ currentWindow: true })
      expect(mocked.saveTabsWithAutoCategory).toHaveBeenCalledWith(queriedTabs)
      expect(mocked.showNotification).toHaveBeenCalledWith(
        'タブ保存',
        '3個のタブが保存されました。タブを閉じます。',
      )
      expect(chromeTabs.remove).toHaveBeenCalledWith([1])
      expect(result).toEqual([
        { url: 'https://keep.example/1', title: 'One' },
        { url: 'https://ignore.example/2', title: 'Ignored' },
        { url: 'https://saved-tabs.example', title: 'Saved Page' },
      ])
    })

    it('保存後に閉じるタブがない場合はログ出力する', async () => {
      const chromeTabs = createChromeTabsHarness()
      const queriedTabs = [
        tab({ id: 61, url: 'https://ignore.example/only', title: 'Ignored' }),
      ]
      chromeTabs.query.mockResolvedValueOnce(queriedTabs)
      mocked.filterTabsByUserSettings.mockResolvedValueOnce(queriedTabs)
      mocked.openSavedTabsPage.mockResolvedValueOnce(61)
      mocked.getUserSettings.mockResolvedValueOnce(
        buildSettings({ excludePatterns: ['ignore.example'] }),
      )

      await expect(handleSaveWindowTabs()).resolves.toEqual([
        { url: 'https://ignore.example/only', title: 'Ignored' },
      ])

      expect(chromeTabs.remove).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith('閉じるべきタブはありません')
    })

    it('save-window フローの remove エラーをログ出力する', async () => {
      const chromeTabs = createChromeTabsHarness()
      const queriedTabs = [
        tab({ id: 62, url: 'https://keep.example/1', title: undefined }),
      ]
      chromeTabs.query.mockResolvedValueOnce(queriedTabs)
      chromeTabs.remove.mockRejectedValueOnce('remove failed')
      mocked.filterTabsByUserSettings.mockResolvedValueOnce(queriedTabs)
      mocked.openSavedTabsPage.mockResolvedValueOnce(999)
      mocked.getUserSettings.mockResolvedValueOnce(
        buildSettings({ excludePatterns: [] }),
      )

      await expect(handleSaveWindowTabs()).resolves.toEqual([
        { url: 'https://keep.example/1', title: '' },
      ])

      expect(console.error).toHaveBeenCalledWith(
        'タブを閉じる際にエラーが発生しました:',
        'remove failed',
      )
    })

    it('save-window の remove catch で Error.message をログ出力する', async () => {
      const chromeTabs = createChromeTabsHarness()
      const queriedTabs = [
        tab({ id: 63, url: 'https://keep.example/1', title: 'One' }),
      ]
      chromeTabs.query.mockResolvedValueOnce(queriedTabs)
      chromeTabs.remove.mockRejectedValueOnce(
        new Error('remove failed as Error'),
      )
      mocked.filterTabsByUserSettings.mockResolvedValueOnce(queriedTabs)
      mocked.openSavedTabsPage.mockResolvedValueOnce(999)
      mocked.getUserSettings.mockResolvedValueOnce(
        buildSettings({ excludePatterns: [] }),
      )

      await expect(handleSaveWindowTabs()).resolves.toEqual([
        { url: 'https://keep.example/1', title: 'One' },
      ])

      expect(console.error).toHaveBeenCalledWith(
        'タブを閉じる際にエラーが発生しました:',
        'remove failed as Error',
      )
    })
  })

  describe('handleExtensionActionClick関数', () => {
    it('clickBehavior に従って saveCurrentTab フローを実行し保存済み URL を同期する', async () => {
      const chromeTabs = createChromeTabsHarness()
      const activeTab = tab({
        id: 50,
        url: 'https://current.example',
        title: 'Current',
      })
      chromeTabs.query.mockResolvedValueOnce([activeTab])
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([activeTab])
      mocked.getUserSettings.mockReset()
      mocked.getUserSettings.mockResolvedValueOnce(
        buildSettings({ clickBehavior: 'saveCurrentTab' }),
      )
      mocked.getCustomProjects.mockResolvedValueOnce([
        { id: 'existing-1', name: 'Default' },
      ])

      await expect(handleExtensionActionClick()).resolves.toBeUndefined()

      expect(mocked.saveTabsWithAutoCategory).toHaveBeenCalledWith([activeTab])
      expect(mocked.addUrlToCustomProject).toHaveBeenCalledWith(
        'existing-1',
        'https://current.example',
        'Current',
      )
    })

    it('clickBehavior がない場合は saveWindowTabs にフォールバックする', async () => {
      const chromeTabs = createChromeTabsHarness()
      const tabs = [tab({ id: 70, url: 'https://x.example', title: 'X' })]
      chromeTabs.query.mockResolvedValueOnce(tabs)
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([])
      mocked.getUserSettings
        .mockResolvedValueOnce({
          ...buildSettings(),
          clickBehavior: undefined as unknown as UserSettings['clickBehavior'],
        })
        .mockResolvedValueOnce(buildSettings())

      await expect(handleExtensionActionClick()).resolves.toBeUndefined()

      expect(chromeTabs.query).toHaveBeenCalledWith({ currentWindow: true })
      expect(mocked.getCustomProjects).toHaveBeenCalled()
    })

    it('clickBehavior が saveSameDomainTabs の場合は saveSameDomainTabs にディスパッチする', async () => {
      const chromeTabs = createChromeTabsHarness()
      chromeTabs.query.mockResolvedValueOnce([])
      mocked.getUserSettings.mockReset()
      mocked.getUserSettings.mockResolvedValueOnce(
        buildSettings({ clickBehavior: 'saveSameDomainTabs' }),
      )
      mocked.getCustomProjects.mockResolvedValueOnce([
        { id: 'existing-1', name: 'Default' },
      ])

      await expect(handleExtensionActionClick()).resolves.toBeUndefined()

      expect(chromeTabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      })
      expect(mocked.getCustomProjects).toHaveBeenCalled()
    })

    it('clickBehavior が saveAllWindowsTabs の場合は saveAllWindowsTabs にディスパッチする', async () => {
      const chromeTabs = createChromeTabsHarness()
      chromeTabs.query.mockResolvedValueOnce([
        tab({ id: 80, url: 'https://all.example', title: 'All' }),
      ])
      mocked.filterTabsByUserSettings.mockResolvedValueOnce([])
      mocked.getUserSettings.mockReset()
      mocked.getUserSettings.mockResolvedValueOnce(
        buildSettings({ clickBehavior: 'saveAllWindowsTabs' }),
      )
      mocked.getCustomProjects.mockResolvedValueOnce([
        { id: 'existing-1', name: 'Default' },
      ])

      await expect(handleExtensionActionClick()).resolves.toBeUndefined()

      expect(chromeTabs.query).toHaveBeenCalledWith({})
      expect(mocked.getCustomProjects).toHaveBeenCalled()
    })

    it('ディスパッチ前に拡張機能アクションのセットアップが失敗した場合はログ出力する', async () => {
      mocked.getUserSettings.mockReset()
      mocked.getUserSettings.mockRejectedValueOnce(new Error('settings failed'))

      await expect(handleExtensionActionClick()).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith(
        'エラーが発生しました:',
        'settings failed',
      )
    })

    it('拡張機能アクション失敗時の非 Error 値をログ出力する', async () => {
      mocked.getUserSettings.mockReset()
      mocked.getUserSettings.mockRejectedValueOnce('settings failed (string)')

      await expect(handleExtensionActionClick()).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith(
        'エラーが発生しました:',
        'settings failed (string)',
      )
    })
  })
})
