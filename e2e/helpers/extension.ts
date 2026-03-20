import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  type BrowserContext,
  type Page,
  type Worker,
  test as base,
  chromium,
  expect,
} from '@playwright/test'

interface ExtensionFixtures {
  extensionContext: BrowserContext
  extensionId: string
  serviceWorker: Worker
  page: Page
}

const extensionPath = path.join(process.cwd(), '.output', 'chrome-mv3')

export const test = base.extend<ExtensionFixtures>({
  extensionContext: async ({ browserName }, use) => {
    void browserName
    const userDataDir = await mkdtemp(
      path.join(os.tmpdir(), 'tabbin-extension-e2e-'),
    )

    const extensionContext = await chromium.launchPersistentContext(
      userDataDir,
      {
        channel: 'chromium',
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
        ],
      },
    )

    await use(extensionContext)

    await extensionContext.close()
    await rm(userDataDir, {
      force: true,
      recursive: true,
    })
  },
  serviceWorker: async ({ extensionContext }, use) => {
    let [serviceWorker] = extensionContext.serviceWorkers()

    if (!serviceWorker) {
      serviceWorker = await extensionContext.waitForEvent('serviceworker')
    }

    await use(serviceWorker)
  },
  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = new URL(serviceWorker.url()).host
    await use(extensionId)
  },
  page: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage()
    await use(page)
    await page.close()
  },
})

export { expect }

export const getExtensionUrl = (extensionId: string, pathname: string) =>
  `chrome-extension://${extensionId}/${pathname}`

export const seedStorage = async (
  serviceWorker: Worker,
  seed: Record<string, unknown>,
) => {
  await serviceWorker.evaluate(async value => {
    await chrome.storage.local.clear()
    await chrome.storage.local.set(value)
  }, seed)
}

export const readStorage = async <T>(
  serviceWorker: Worker,
  keys?: string | string[],
) =>
  serviceWorker.evaluate(async value => {
    const getItems = (
      query?: Record<string, unknown> | string | string[],
    ): Promise<Record<string, unknown>> =>
      new Promise(resolve => {
        if (query == null) {
          chrome.storage.local.get(items => resolve(items))
          return
        }

        chrome.storage.local.get(query, items => resolve(items))
      })

    if (value == null) {
      return getItems()
    }

    return getItems(value)
  }, keys) as Promise<T>
