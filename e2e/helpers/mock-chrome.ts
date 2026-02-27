import type { Page } from '@playwright/test'

interface UserSettings {
  removeTabAfterOpen: boolean
  removeTabAfterExternalDrop: boolean
  excludePatterns: string[]
  enableCategories: boolean
  autoDeletePeriod: string
  showSavedTime: boolean
  clickBehavior: string
  excludePinnedTabs: boolean
  openUrlInBackground: boolean
  openAllInNewWindow: boolean
  confirmDeleteAll: boolean
  confirmDeleteEach: boolean
  colors: Record<string, string>
}

export interface MockChromeStore {
  userSettings: UserSettings
  parentCategories: unknown[]
  savedTabs: unknown[]
  urls: unknown[]
  customProjects: unknown[]
  customProjectOrder: string[]
  viewMode: string
  domainCategorySettings: unknown[]
  domainCategoryMappings: unknown[]
  'tab-manager-theme': string
  [key: string]: unknown
}

type MockRuntimeMessage = Record<string, unknown>
type MockSetCall = Record<string, unknown>

const defaultStore: MockChromeStore = {
  userSettings: {
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
  },
  parentCategories: [],
  savedTabs: [],
  urls: [],
  customProjects: [],
  customProjectOrder: [],
  viewMode: 'domain',
  domainCategorySettings: [],
  domainCategoryMappings: [],
  'tab-manager-theme': 'system',
}

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const createInitialStore = (
  overrides: Partial<MockChromeStore>,
): MockChromeStore => ({
  ...defaultStore,
  ...overrides,
  userSettings: {
    ...defaultStore.userSettings,
    ...(overrides.userSettings ?? {}),
  },
})

export async function installChromeMock(
  page: Page,
  overrides: Partial<MockChromeStore> = {},
) {
  const initialStore = createInitialStore(overrides)

  await page.addInitScript(
    ({ seedStore }) => {
      interface StorageChange {
        oldValue?: unknown
        newValue?: unknown
      }
      type Listener = (
        changes: { [key: string]: StorageChange },
        areaName: string,
      ) => void

      const listeners: Listener[] = []
      const runtimeMessages: Record<string, unknown>[] = []
      const setCalls: Record<string, unknown>[] = []
      const store = JSON.parse(JSON.stringify(seedStore)) as Record<
        string,
        unknown
      >

      const clone = <T>(value: T): T => {
        if (value === undefined) {
          return value
        }
        return JSON.parse(JSON.stringify(value)) as T
      }

      const emitChanges = (changes: { [key: string]: StorageChange }) => {
        for (const listener of listeners.slice()) {
          listener(changes, 'local')
        }
      }

      const local = {
        async get(keys?: string | string[] | Record<string, unknown>) {
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

        async set(
          next: Record<string, unknown>,
          callback?: () => void,
        ): Promise<void> {
          const changes: { [key: string]: StorageChange } = {}

          for (const [key, value] of Object.entries(next)) {
            changes[key] = {
              oldValue: clone(store[key]),
              newValue: clone(value),
            }
            store[key] = clone(value)
          }

          setCalls.push(clone(next))
          emitChanges(changes)
          callback?.()
        },

        async remove(
          keys: string | string[],
          callback?: () => void,
        ): Promise<void> {
          const entries = Array.isArray(keys) ? keys : [keys]
          const changes: { [key: string]: StorageChange } = {}

          for (const key of entries) {
            changes[key] = {
              oldValue: clone(store[key]),
              newValue: undefined,
            }
            delete store[key]
          }

          emitChanges(changes)
          callback?.()
        },

        async clear(callback?: () => void): Promise<void> {
          const keys = Object.keys(store)
          const changes: { [key: string]: StorageChange } = {}

          for (const key of keys) {
            changes[key] = {
              oldValue: clone(store[key]),
              newValue: undefined,
            }
            delete store[key]
          }

          emitChanges(changes)
          callback?.()
        },
      }

      const runtime = {
        getManifest: () => ({ version: 'test' }),
        getURL: (path: string) => `chrome-extension://tabbin/${path}`,
        sendMessage: (
          message: Record<string, unknown>,
          callback?: (response: Record<string, unknown>) => void,
        ) => {
          runtimeMessages.push(clone(message))
          const response = { ok: true }
          callback?.(response)
          return Promise.resolve(response)
        },
      }

      const chromeMock = {
        storage: {
          local,
          onChanged: {
            addListener(listener: Listener) {
              listeners.push(listener)
            },
            removeListener(listener: Listener) {
              const index = listeners.indexOf(listener)
              if (index >= 0) {
                listeners.splice(index, 1)
              }
            },
          },
        },
        runtime,
      } as unknown as typeof chrome

      Object.defineProperty(globalThis, 'chrome', {
        configurable: true,
        writable: true,
        value: chromeMock,
      })

      Object.defineProperty(globalThis, '__tabbinE2E', {
        configurable: true,
        writable: true,
        value: {
          store,
          runtimeMessages,
          setCalls,
        },
      })

      if (!globalThis.matchMedia) {
        Object.defineProperty(globalThis, 'matchMedia', {
          writable: true,
          value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          }),
        })
      }
    },
    { seedStore: initialStore },
  )
}

export async function getMockStore(page: Page): Promise<MockChromeStore> {
  return page.evaluate(() => {
    const state = (
      globalThis as typeof globalThis & {
        __tabbinE2E?: { store: MockChromeStore }
      }
    ).__tabbinE2E
    if (!state) {
      throw new Error('Mock state not found')
    }
    return JSON.parse(JSON.stringify(state.store)) as MockChromeStore
  })
}

export async function getMockRuntimeMessages(
  page: Page,
): Promise<MockRuntimeMessage[]> {
  return page.evaluate(() => {
    const state = (
      globalThis as typeof globalThis & {
        __tabbinE2E?: { runtimeMessages: MockRuntimeMessage[] }
      }
    ).__tabbinE2E
    if (!state) {
      throw new Error('Mock state not found')
    }
    return JSON.parse(
      JSON.stringify(state.runtimeMessages),
    ) as MockRuntimeMessage[]
  })
}

export async function getMockSetCalls(page: Page): Promise<MockSetCall[]> {
  return page.evaluate(() => {
    const state = (
      globalThis as typeof globalThis & {
        __tabbinE2E?: { setCalls: MockSetCall[] }
      }
    ).__tabbinE2E
    if (!state) {
      throw new Error('Mock state not found')
    }
    return JSON.parse(JSON.stringify(state.setCalls)) as MockSetCall[]
  })
}

export const getDefaultMockStore = () => deepClone(defaultStore)
