import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  setupExpiredTabsCheckAlarm: vi.fn(),
  createContextMenus: vi.fn(),
  handleExtensionActionClick: vi.fn(),
  setupMessageListener: vi.fn(),
  openSavedTabsPage: vi.fn(),
  handleTabCreated: vi.fn(),
  getParentCategories: vi.fn(),
  migrateParentCategoriesToDomainNames: vi.fn(),
}))

vi.mock('wxt/utils/define-background', () => ({
  defineBackground: (setup: () => void) => {
    setup()
    return {}
  },
}))

vi.mock('@/lib/background/alarm-notification', () => ({
  setupExpiredTabsCheckAlarm: mocked.setupExpiredTabsCheckAlarm,
}))

vi.mock('@/lib/background/context-menu', () => ({
  createContextMenus: mocked.createContextMenus,
}))

vi.mock('@/lib/background/extension-actions', () => ({
  handleExtensionActionClick: mocked.handleExtensionActionClick,
}))

vi.mock('@/lib/background/message-handler', () => ({
  setupMessageListener: mocked.setupMessageListener,
}))

vi.mock('@/lib/background/saved-tabs-page', () => ({
  openSavedTabsPage: mocked.openSavedTabsPage,
}))

vi.mock('@/lib/background/url-storage', () => ({
  handleTabCreated: mocked.handleTabCreated,
}))

vi.mock('@/lib/storage/categories', () => ({
  getParentCategories: mocked.getParentCategories,
}))

vi.mock('@/lib/storage/migration', () => ({
  migrateParentCategoriesToDomainNames:
    mocked.migrateParentCategoriesToDomainNames,
}))

type InstalledListener = (details: {
  reason: 'install' | 'update' | 'chrome_update'
}) => void | Promise<void>

type StartupListener = () => void | Promise<void>

type ChromeHarness = {
  onInstalledListeners: InstalledListener[]
  onStartupListeners: StartupListener[]
  storageSet: ReturnType<typeof vi.fn>
  storageGet: ReturnType<typeof vi.fn>
  tabsCreate: ReturnType<typeof vi.fn>
  actionAddListener: ReturnType<typeof vi.fn>
  tabsOnCreatedAddListener: ReturnType<typeof vi.fn>
}

function createChromeHarness(
  initialStorage: Record<string, unknown> = {},
): ChromeHarness {
  const storage = { ...initialStorage }
  const onInstalledListeners: InstalledListener[] = []
  const onStartupListeners: StartupListener[] = []

  const storageGet = vi.fn(async (keys?: unknown) => {
    if (keys == null) {
      return { ...storage }
    }

    if (typeof keys === 'string') {
      return { [keys]: storage[keys] }
    }

    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map(key => [key, storage[key]]))
    }

    if (typeof keys === 'object') {
      const defaults = keys as Record<string, unknown>
      const result: Record<string, unknown> = {}
      for (const [key, fallback] of Object.entries(defaults)) {
        result[key] = key in storage ? storage[key] : fallback
      }
      return result
    }

    return {}
  })

  const storageSet = vi.fn(async (next: Record<string, unknown>) => {
    Object.assign(storage, next)
  })

  const tabsCreate = vi.fn(
    async (createProperties: chrome.tabs.CreateProperties) => ({
      id: 100,
      ...createProperties,
    }),
  )

  const actionAddListener = vi.fn()
  const tabsOnCreatedAddListener = vi.fn()

  ;(globalThis as { chrome?: typeof chrome }).chrome = {
    runtime: {
      getManifest: vi.fn(() => ({ version: '9.9.9' })),
      getURL: vi.fn((path: string) => `chrome-extension://tabbin/${path}`),
      onInstalled: {
        addListener: vi.fn((listener: InstalledListener) => {
          onInstalledListeners.push(listener)
        }),
      },
      onStartup: {
        addListener: vi.fn((listener: StartupListener) => {
          onStartupListeners.push(listener)
        }),
      },
    },
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
      },
    },
    tabs: {
      create: tabsCreate,
      update: vi.fn(),
      query: vi.fn(async () => []),
      get: vi.fn(),
      remove: vi.fn(),
      onCreated: {
        addListener: tabsOnCreatedAddListener,
      },
    },
    action: {
      onClicked: {
        addListener: actionAddListener,
      },
    },
  } as unknown as typeof chrome

  return {
    onInstalledListeners,
    onStartupListeners,
    storageSet,
    storageGet,
    tabsCreate,
    actionAddListener,
    tabsOnCreatedAddListener,
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

type LoadBackgroundOptions = {
  initialStorage?: Record<string, unknown>
  clearAfterImport?: boolean
  setupMocks?: () => void
}

async function loadBackground(
  options: LoadBackgroundOptions = {},
): Promise<ChromeHarness> {
  vi.resetModules()
  vi.clearAllMocks()

  mocked.openSavedTabsPage.mockResolvedValue(123)
  mocked.getParentCategories.mockResolvedValue([])
  mocked.migrateParentCategoriesToDomainNames.mockResolvedValue(undefined)
  mocked.createContextMenus.mockImplementation(() => {})
  mocked.setupMessageListener.mockImplementation(() => {})

  options.setupMocks?.()

  const harness = createChromeHarness(options.initialStorage ?? {})

  await import('@/entrypoints/background')
  await flushMicrotasks()

  // 初期化IIFE由来の呼び出しは以降の検証から除外する
  if (options.clearAfterImport !== false) {
    vi.clearAllMocks()
  }

  return harness
}

async function triggerInstalled(
  harness: ChromeHarness,
  reason: 'install' | 'update' | 'chrome_update',
): Promise<void> {
  for (const listener of harness.onInstalledListeners) {
    await listener({ reason })
  }
}

async function triggerStartup(harness: ChromeHarness): Promise<void> {
  for (const listener of harness.onStartupListeners) {
    await listener()
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('background lifecycle auto-open behavior', () => {
  it('opens and pins saved-tabs via helper on install', async () => {
    const harness = await loadBackground({ clearAfterImport: false })

    expect(harness.onInstalledListeners).toHaveLength(1)
    expect(harness.onStartupListeners).toHaveLength(1)
    expect(harness.actionAddListener).toHaveBeenCalledWith(
      mocked.handleExtensionActionClick,
    )
    expect(harness.tabsOnCreatedAddListener).toHaveBeenCalledWith(
      mocked.handleTabCreated,
    )
    expect(mocked.setupMessageListener).toHaveBeenCalledTimes(1)

    await triggerInstalled(harness, 'install')

    expect(mocked.openSavedTabsPage).toHaveBeenCalledTimes(1)
    expect(harness.tabsCreate).not.toHaveBeenCalled()
    expect(harness.storageSet).toHaveBeenCalledWith({
      seenVersion: '9.9.9',
      changelogShown: true,
    })
  })

  it('opens changelog first and then saved-tabs on update', async () => {
    const harness = await loadBackground({
      initialStorage: {
        seenVersion: '9.9.8',
        changelogShown: false,
      },
    })

    await triggerInstalled(harness, 'update')

    expect(harness.tabsCreate).toHaveBeenCalledWith({
      url: 'chrome-extension://tabbin/changelog.html',
    })
    expect(mocked.openSavedTabsPage).toHaveBeenCalledTimes(1)
    expect(harness.storageSet).toHaveBeenCalledWith({
      seenVersion: '9.9.9',
      changelogShown: true,
    })

    expect(harness.tabsCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mocked.openSavedTabsPage.mock.invocationCallOrder[0],
    )
  })

  it('opens saved-tabs on browser startup', async () => {
    const harness = await loadBackground()

    await triggerStartup(harness)

    expect(mocked.openSavedTabsPage).toHaveBeenCalledTimes(1)
  })

  it('updates seenVersion only when changelog is already shown', async () => {
    const harness = await loadBackground({
      initialStorage: {
        seenVersion: '9.9.8',
        changelogShown: true,
      },
    })

    await triggerInstalled(harness, 'update')

    expect(harness.tabsCreate).not.toHaveBeenCalled()
    expect(harness.storageSet).toHaveBeenCalledWith({
      seenVersion: '9.9.9',
    })
    expect(mocked.openSavedTabsPage).toHaveBeenCalledTimes(1)
  })

  it('still opens saved-tabs on update even when version is unchanged', async () => {
    const harness = await loadBackground({
      initialStorage: {
        seenVersion: '9.9.9',
        changelogShown: false,
      },
    })

    await triggerInstalled(harness, 'update')

    expect(harness.tabsCreate).not.toHaveBeenCalled()
    expect(harness.storageSet).not.toHaveBeenCalled()
    expect(mocked.openSavedTabsPage).toHaveBeenCalledTimes(1)
  })

  it('does nothing in the onInstalled listener for chrome_update', async () => {
    const harness = await loadBackground()

    await triggerInstalled(harness, 'chrome_update')

    // chrome_update ではUI起動は行わない（マイグレーションはIIFEで実行済み）
    expect(mocked.openSavedTabsPage).not.toHaveBeenCalled()
    expect(harness.tabsCreate).not.toHaveBeenCalled()
    // onInstalledリスナー経由ではマイグレーションを実行しない
    expect(mocked.migrateParentCategoriesToDomainNames).not.toHaveBeenCalled()
  })

  it('catches errors in install auto-open flow', async () => {
    const harness = await loadBackground()
    const errorSpy = vi.mocked(console.error)

    mocked.openSavedTabsPage.mockRejectedValueOnce(new Error('open failed'))

    await triggerInstalled(harness, 'install')

    expect(errorSpy).toHaveBeenCalledWith(
      'インストール/更新時の自動オープン処理エラー:',
      expect.any(Error),
    )
    expect(harness.storageSet).not.toHaveBeenCalledWith({
      seenVersion: '9.9.9',
      changelogShown: true,
    })
  })

  it('catches errors in startup auto-open flow', async () => {
    const harness = await loadBackground()
    const errorSpy = vi.mocked(console.error)

    mocked.openSavedTabsPage.mockRejectedValueOnce(new Error('startup failed'))

    await triggerStartup(harness)

    expect(errorSpy).toHaveBeenCalledWith(
      '起動時のsaved-tabsページ自動オープンに失敗しました:',
      expect.any(Error),
    )
  })

  it('catches migration errors in background initialization IIFE', async () => {
    mocked.migrateParentCategoriesToDomainNames.mockRejectedValueOnce(
      new Error('migration failed'),
    )

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await loadBackground({ clearAfterImport: false })

    expect(errorSpy).toHaveBeenCalledWith(
      'バックグラウンド初期化エラー:',
      expect.any(Error),
    )
  })

  it('handles context menu initialization errors during background setup', async () => {
    const errorSpy = vi.mocked(console.error)

    await loadBackground({
      clearAfterImport: false,
      setupMocks: () => {
        mocked.createContextMenus.mockImplementation(() => {
          throw new Error('context menu failed')
        })
      },
    })

    expect(errorSpy).toHaveBeenCalledWith(
      'コンテキストメニュー初期化エラー:',
      expect.any(Error),
    )
  })

  it('handles background initialization IIFE errors', async () => {
    const errorSpy = vi.mocked(console.error)

    await loadBackground({
      clearAfterImport: false,
      setupMocks: () => {
        mocked.getParentCategories.mockRejectedValue(
          new Error('categories failed'),
        )
      },
    })

    expect(errorSpy).toHaveBeenCalledWith(
      'バックグラウンド初期化エラー:',
      expect.any(Error),
    )
    expect(mocked.setupExpiredTabsCheckAlarm).not.toHaveBeenCalled()
  })
})
