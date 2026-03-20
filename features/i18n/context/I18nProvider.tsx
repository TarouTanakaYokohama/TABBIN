import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  getMessage,
  resolveLanguage,
  resolveUiLanguage,
} from '@/features/i18n/lib/language'
import type { AppLanguage, LanguageSetting } from '@/features/i18n/messages'
import {
  getChromeStorageOnChanged,
  warnMissingChromeStorage,
} from '@/lib/browser/chrome-storage'
import {
  defaultSettings,
  getUserSettings,
  saveUserSettings,
} from '@/lib/storage/settings'

interface I18nContextValue {
  language: AppLanguage
  languageSetting: LanguageSetting
  setLanguageSetting: (language: LanguageSetting) => Promise<void>
  t: (key: string, fallback?: string, values?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const getUiLocale = () => {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
    return chrome.i18n.getUILanguage()
  }

  return navigator.language
}

export const getFallbackText = (
  key: string,
  fallback?: string,
  values?: Record<string, string>,
) => getMessage(resolveUiLanguage(getUiLocale()), key, fallback, values)

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [languageSetting, setLanguageSettingState] = useState<LanguageSetting>(
    defaultSettings.language ?? 'system',
  )
  const [uiLocale, setUiLocale] = useState(() => getUiLocale())

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const settings = await getUserSettings()
        if (!cancelled) {
          setLanguageSettingState(settings.language ?? 'system')
          setUiLocale(getUiLocale())
        }
      } catch (error) {
        console.error('言語設定の読み込みエラー:', error)
      }
    }

    void load()

    const storageOnChanged = getChromeStorageOnChanged()
    if (!storageOnChanged) {
      warnMissingChromeStorage('言語設定変更監視')
      return () => {
        cancelled = true
      }
    }

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local' || !changes.userSettings?.newValue) {
        return
      }

      const nextSettings = changes.userSettings.newValue as {
        language?: LanguageSetting
      }
      setLanguageSettingState(nextSettings.language ?? 'system')
      setUiLocale(getUiLocale())
    }

    storageOnChanged.addListener(handleStorageChange)

    return () => {
      cancelled = true
      storageOnChanged.removeListener(handleStorageChange)
    }
  }, [])

  const setLanguageSetting = async (nextLanguage: LanguageSetting) => {
    setLanguageSettingState(nextLanguage)
    setUiLocale(getUiLocale())

    const settings = await getUserSettings()
    await saveUserSettings({
      ...settings,
      language: nextLanguage,
    })
  }

  const language = resolveLanguage(languageSetting, uiLocale)

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      languageSetting,
      setLanguageSetting,
      t: (key, fallback, values) => getMessage(language, key, fallback, values),
    }),
    [language, languageSetting],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

export const useOptionalI18n = () => useContext(I18nContext)

export const useI18nText = () => {
  const context = useOptionalI18n()

  return useMemo(
    () => (key: string, fallback?: string, values?: Record<string, string>) =>
      context?.t(key, fallback, values) ??
      getFallbackText(key, fallback, values),
    [context],
  )
}
