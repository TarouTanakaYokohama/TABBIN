import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openSavedTabsPage, resetSavedTabsPageId } from './saved-tabs-page'

interface TabsHarness {
  create: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  query: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

const createChromeHarness = (): TabsHarness => {
  const create = vi.fn(
    async (createProperties: chrome.tabs.CreateProperties) =>
      ({
        id: 900,
        pinned: false,
        ...createProperties,
      }) as chrome.tabs.Tab,
  )
  const get = vi.fn()
  const query = vi.fn(async () => [])
  const remove = vi.fn(async () => undefined)
  const update = vi.fn(
    async (tabId: number, updateProperties: chrome.tabs.UpdateProperties) =>
      ({
        id: tabId,
        ...updateProperties,
      }) as chrome.tabs.Tab,
  )

  ;(
    globalThis as {
      chrome?: typeof chrome
    }
  ).chrome = {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://tabbin/${path}`),
    },
    tabs: {
      create,
      get,
      query,
      remove,
      update,
    },
  } as unknown as typeof chrome

  return {
    create,
    get,
    query,
    remove,
    update,
  }
}

const tab = (partial: Partial<chrome.tabs.Tab>): chrome.tabs.Tab =>
  ({
    id: partial.id,
    url: partial.url,
    pendingUrl: partial.pendingUrl,
    pinned: partial.pinned ?? false,
  }) as chrome.tabs.Tab

describe('saved-tabs-page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    createChromeHarness()
    resetSavedTabsPageId()
  })

  it('app.html#/saved-tabs の既存タブを再利用して新規作成しない', async () => {
    const chromeTabs = createChromeHarness()
    chromeTabs.get.mockRejectedValueOnce(new Error('missing'))
    chromeTabs.query.mockResolvedValueOnce([
      tab({
        id: 41,
        url: 'chrome-extension://tabbin/app.html#/saved-tabs',
        pinned: false,
      }),
    ])

    await expect(openSavedTabsPage()).resolves.toBe(41)

    expect(chromeTabs.create).not.toHaveBeenCalled()
    expect(chromeTabs.update).toHaveBeenNthCalledWith(1, 41, {
      active: true,
    })
    expect(chromeTabs.update).toHaveBeenNthCalledWith(2, 41, {
      pinned: true,
    })
  })

  it('app.html#/saved-tabs?mode=custom の既存タブを再利用する', async () => {
    const chromeTabs = createChromeHarness()
    chromeTabs.get.mockRejectedValueOnce(new Error('missing'))
    chromeTabs.query.mockResolvedValueOnce([
      tab({
        id: 42,
        url: 'chrome-extension://tabbin/app.html#/saved-tabs?mode=custom',
        pinned: true,
      }),
    ])

    await expect(openSavedTabsPage()).resolves.toBe(42)

    expect(chromeTabs.create).not.toHaveBeenCalled()
    expect(chromeTabs.update).toHaveBeenCalledTimes(1)
    expect(chromeTabs.update).toHaveBeenCalledWith(42, {
      active: true,
    })
  })

  it('pendingUrl の saved-tabs app ルートも再利用する', async () => {
    const chromeTabs = createChromeHarness()
    chromeTabs.get.mockRejectedValueOnce(new Error('missing'))
    chromeTabs.query.mockResolvedValueOnce([
      tab({
        id: 43,
        pendingUrl:
          'chrome-extension://tabbin/app.html#/saved-tabs?mode=domain',
      }),
    ])

    await expect(openSavedTabsPage()).resolves.toBe(43)

    expect(chromeTabs.create).not.toHaveBeenCalled()
    expect(chromeTabs.update).toHaveBeenCalledWith(43, {
      active: true,
    })
  })

  it('saved-tabs 以外の app ルートは再利用せず新規作成する', async () => {
    const chromeTabs = createChromeHarness()
    chromeTabs.get.mockRejectedValueOnce(new Error('missing'))
    chromeTabs.query.mockResolvedValueOnce([
      tab({
        id: 51,
        url: 'chrome-extension://tabbin/app.html#/options',
      }),
    ])

    await expect(openSavedTabsPage()).resolves.toBe(900)

    expect(chromeTabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://tabbin/saved-tabs.html',
    })
  })

  it('saved-tabs タブが複数ある場合は先頭を再利用して重複を閉じる', async () => {
    const chromeTabs = createChromeHarness()
    chromeTabs.get.mockRejectedValueOnce(new Error('missing'))
    chromeTabs.query.mockResolvedValueOnce([
      tab({
        id: 61,
        url: 'chrome-extension://tabbin/app.html#/saved-tabs',
      }),
      tab({
        id: 62,
        url: 'chrome-extension://tabbin/saved-tabs.html?mode=custom',
      }),
    ])

    await expect(openSavedTabsPage()).resolves.toBe(61)

    expect(chromeTabs.create).not.toHaveBeenCalled()
    expect(chromeTabs.remove).toHaveBeenCalledWith(62)
  })
})
