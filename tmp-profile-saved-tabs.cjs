const { chromium } = require('playwright')

const run = async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()

  await context.addInitScript(() => {
    const listeners = []
    const store = {
      savedTabs: [
        {
          id: 'group-1',
          domain: 'example.com',
          urls: [
            {
              url: 'https://example.com',
              title: 'Example Domain',
              savedAt: Date.now(),
            },
          ],
          subCategories: [],
          categoryKeywords: [],
          savedAt: Date.now(),
        },
      ],
      parentCategories: [],
      customProjects: [],
      customProjectOrder: [],
      viewMode: 'domain',
      urls: [],
      userSettings: {
        removeTabAfterOpen: false,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: true,
        clickBehavior: 'saveWindowTabs',
        excludePinnedTabs: true,
        openUrlInBackground: true,
        openAllInNewWindow: false,
        confirmDeleteAll: true,
        confirmDeleteEach: true,
      },
    }

    const clone = value => {
      if (value === undefined) {
        return
      }
      return JSON.parse(JSON.stringify(value))
    }

    const get = async keys => {
      if (keys == null) {
        return clone(store)
      }
      if (typeof keys === 'string') {
        return { [keys]: clone(store[keys]) }
      }
      if (Array.isArray(keys)) {
        const result = {}
        for (const key of keys) {
          result[key] = clone(store[key])
        }
        return result
      }
      if (typeof keys === 'object') {
        const result = {}
        for (const [key, fallback] of Object.entries(keys)) {
          const value = store[key]
          result[key] = value === undefined ? clone(fallback) : clone(value)
        }
        return result
      }
      return {}
    }

    const set = async next => {
      const changes = {}
      for (const [key, value] of Object.entries(next || {})) {
        changes[key] = {
          oldValue: clone(store[key]),
          newValue: clone(value),
        }
        store[key] = clone(value)
      }

      for (const listener of listeners.slice()) {
        try {
          listener(changes, 'local')
        } catch {
          // noop
        }
      }
    }

    globalThis.chrome = {
      storage: {
        local: { get, set },
        onChanged: {
          addListener: listener => {
            listeners.push(listener)
          },
          removeListener: listener => {
            const index = listeners.indexOf(listener)
            if (index >= 0) {
              listeners.splice(index, 1)
            }
          },
        },
      },
      tabs: {
        create: async () => ({ id: 1 }),
      },
      windows: {
        create: async () => ({ id: 1 }),
      },
      runtime: {
        getURL: path => `chrome-extension://mock/${path}`,
        getManifest: () => ({ version: 'dev' }),
        sendMessage: async () => ({}),
      },
    }

    globalThis.enableSavedTabsProfiler = true
  })

  const page = await context.newPage()
  const profilerLogs = []

  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[Profiler] SavedTabs commit')) {
      profilerLogs.push(text)
    }
  })

  await page.goto('http://localhost:3001/saved-tabs.html', {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  })

  await page.locator('input[placeholder="検索"]').first().waitFor({
    state: 'visible',
    timeout: 120_000,
  })

  await page.waitForTimeout(800)

  const initial = await page.evaluate(
    () => globalThis.savedTabsProfiler || { commits: 0 },
  )

  const search = page.locator('input[placeholder="検索"]').first()
  await search.fill('exa')
  await page.waitForTimeout(200)
  await search.fill('example')
  await page.waitForTimeout(200)
  await search.fill('')
  await page.waitForTimeout(400)

  const final = await page.evaluate(
    () => globalThis.savedTabsProfiler || { commits: 0 },
  )

  console.log(
    JSON.stringify(
      {
        initialCommits: initial.commits || 0,
        finalCommits: final.commits || 0,
        interactionCommits: Math.max(
          (final.commits || 0) - (initial.commits || 0),
          0,
        ),
        profilerLogCount: profilerLogs.length,
      },
      null,
      2,
    ),
  )

  await browser.close()
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
