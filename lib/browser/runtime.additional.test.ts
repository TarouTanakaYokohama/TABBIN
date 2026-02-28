import { afterEach, describe, expect, it, vi } from 'vitest'

type GlobalWithBrowserApis = Omit<typeof globalThis, 'browser' | 'chrome'> & {
  browser?: unknown
  chrome?: {
    runtime?: {
      sendMessage?: (
        message: unknown,
        callback?: (response: unknown) => void,
      ) => void
    }
  }
}

const globalWithApis = globalThis as GlobalWithBrowserApis
const originalBrowser = globalWithApis.browser
const originalChrome = globalWithApis.chrome

afterEach(() => {
  vi.resetModules()
  vi.unmock('webextension-polyfill')
  globalWithApis.browser = originalBrowser
  globalWithApis.chrome = originalChrome
})

describe('sendRuntimeMessage の追加分岐', () => {
  it('polyfill の import 失敗時は undefined を返す', async () => {
    vi.doMock('webextension-polyfill', () => {
      throw new Error('import failed')
    })

    globalWithApis.browser = undefined
    globalWithApis.chrome = undefined

    const { sendRuntimeMessage } = await import('./runtime')
    const response = await sendRuntimeMessage({ action: 'noop' })

    expect(response).toBeUndefined()
  })

  it('chrome.runtime.sendMessage が throw しても undefined を返す', async () => {
    vi.doMock('webextension-polyfill', () => ({
      default: {
        runtime: {
          sendMessage: vi.fn().mockRejectedValue(new Error('polyfill failed')),
        },
      },
    }))

    globalWithApis.browser = undefined
    globalWithApis.chrome = {
      runtime: {
        sendMessage: () => {
          throw new Error('chrome send failed')
        },
      },
    }

    const { sendRuntimeMessage } = await import('./runtime')
    const response = await sendRuntimeMessage({ action: 'noop' })

    expect(response).toBeUndefined()
  })

  it('polyfill が default export を返さない場合は undefined を返す', async () => {
    vi.doMock('webextension-polyfill', () => ({}))

    globalWithApis.browser = undefined
    globalWithApis.chrome = undefined

    const { sendRuntimeMessage } = await import('./runtime')
    const response = await sendRuntimeMessage({ action: 'noop' })

    expect(response).toBeUndefined()
  })
})
