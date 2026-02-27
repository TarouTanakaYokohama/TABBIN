interface BrowserRuntime {
  sendMessage?: (message: unknown) => Promise<unknown>
}

interface BrowserApi {
  runtime?: BrowserRuntime
}

interface ChromeRuntime {
  sendMessage?: (
    message: unknown,
    callback?: (response: unknown) => void,
  ) => void
}

interface BrowserModule {
  default?: BrowserApi
}

let browserApiPromise: Promise<BrowserApi | null> | null = null

const getGlobalBrowserApi = (): BrowserApi | null => {
  const api = (globalThis as typeof globalThis & { browser?: BrowserApi })
    .browser
  return api ?? null
}

const getGlobalChromeRuntime = (): ChromeRuntime | null => {
  const runtime = (
    globalThis as typeof globalThis & {
      chrome?: { runtime?: ChromeRuntime }
    }
  ).chrome?.runtime
  return runtime ?? null
}

const loadWebExtensionBrowserApi = async (): Promise<BrowserApi | null> => {
  if (!browserApiPromise) {
    browserApiPromise = import('webextension-polyfill')
      .then((mod: BrowserModule) => mod.default ?? null)
      .catch(() => null)
  }
  return browserApiPromise
}

const sendWithChromeRuntime = async (
  runtime: ChromeRuntime,
  message: unknown,
): Promise<unknown> =>
  new Promise(resolve => {
    try {
      runtime.sendMessage?.(message, response => {
        resolve(response)
      })
    } catch {
      resolve(undefined)
    }
  })

export const sendRuntimeMessage = async (
  message: unknown,
): Promise<unknown> => {
  const browserApi = getGlobalBrowserApi()
  if (browserApi?.runtime?.sendMessage) {
    return await browserApi.runtime.sendMessage(message)
  }

  const polyfillBrowserApi = await loadWebExtensionBrowserApi()
  if (polyfillBrowserApi?.runtime?.sendMessage) {
    try {
      return await polyfillBrowserApi.runtime.sendMessage(message)
    } catch {
      // フォールバックとして chrome.runtime を試す
    }
  }

  const chromeRuntime = getGlobalChromeRuntime()
  if (!chromeRuntime?.sendMessage) {
    return undefined
  }
  return await sendWithChromeRuntime(chromeRuntime, message)
}
