import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { polyfillSendMessageMock } = vi.hoisted(() => ({
  polyfillSendMessageMock: vi.fn(),
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: polyfillSendMessageMock,
    },
  },
}))

import { sendRuntimeMessage } from './runtime'

type GlobalWithBrowserApis = Omit<typeof globalThis, 'browser' | 'chrome'> & {
  browser?: {
    runtime?: {
      sendMessage?: (message: unknown) => Promise<unknown>
    }
  }
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

describe('sendRuntimeMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    polyfillSendMessageMock.mockRejectedValue(
      new Error('polyfill runtime unavailable'),
    )
    globalWithApis.browser = undefined
    globalWithApis.chrome = undefined
  })

  afterEach(() => {
    globalWithApis.browser = originalBrowser
    globalWithApis.chrome = originalChrome
  })

  it('browser.runtime.sendMessage がある場合は Promise API を使う', async () => {
    const browserSendMessage = vi
      .fn()
      .mockResolvedValue({ status: 'ok-from-browser' })
    globalWithApis.browser = {
      runtime: {
        sendMessage: browserSendMessage,
      },
    }

    const response = await sendRuntimeMessage({
      action: 'settingsImported',
    })

    expect(browserSendMessage).toHaveBeenCalledWith({
      action: 'settingsImported',
    })
    expect(response).toEqual({ status: 'ok-from-browser' })
  })

  it('browser.runtime がない場合は chrome.runtime.sendMessage にフォールバックする', async () => {
    const chromeSendMessage = vi.fn(
      (_message: unknown, callback?: (response: unknown) => void) => {
        callback?.({ status: 'ok-from-chrome' })
      },
    )

    globalWithApis.chrome = {
      runtime: {
        sendMessage: chromeSendMessage,
      },
    }

    const response = await sendRuntimeMessage({
      action: 'settingsImported',
    })

    expect(chromeSendMessage).toHaveBeenCalledWith(
      { action: 'settingsImported' },
      expect.any(Function),
    )
    expect(response).toEqual({ status: 'ok-from-chrome' })
  })

  it('polyfill API を読み込んだ後はキャッシュを再利用する', async () => {
    polyfillSendMessageMock.mockResolvedValue({ status: 'ok-from-polyfill' })

    const first = await sendRuntimeMessage({
      action: 'first',
    })
    const second = await sendRuntimeMessage({
      action: 'second',
    })

    expect(first).toEqual({ status: 'ok-from-polyfill' })
    expect(second).toEqual({ status: 'ok-from-polyfill' })
    expect(polyfillSendMessageMock).toHaveBeenNthCalledWith(1, {
      action: 'first',
    })
    expect(polyfillSendMessageMock).toHaveBeenNthCalledWith(2, {
      action: 'second',
    })
  })
})
