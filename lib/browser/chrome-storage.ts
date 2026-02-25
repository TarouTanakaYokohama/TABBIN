type ChromeStorageApi = typeof chrome.storage

const warnedContexts = new Set<string>()

const getChromeApi = (): typeof chrome | undefined => {
  return (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome
}

export const getChromeStorage = (): ChromeStorageApi | null => {
  return getChromeApi()?.storage ?? null
}

export const getChromeStorageLocal = (): typeof chrome.storage.local | null => {
  return getChromeStorage()?.local ?? null
}

export const getChromeStorageOnChanged = ():
  | typeof chrome.storage.onChanged
  | null => {
  return getChromeStorage()?.onChanged ?? null
}

export const warnMissingChromeStorage = (context: string) => {
  if (warnedContexts.has(context)) return
  warnedContexts.add(context)
  console.warn(
    `chrome.storage APIが利用できないため ${context} はフォールバック動作になります`,
  )
}
