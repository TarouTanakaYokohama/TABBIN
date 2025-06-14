import type { UserSettings } from '@/types/storage'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system' | 'user'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'tab-manager-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)

  // 初期化時にChrome Storageから設定を読み込む
  useEffect(() => {
    chrome.storage.local.get(storageKey).then(result => {
      if (result[storageKey]) {
        setTheme(result[storageKey] as Theme)
      }
    })

    // ストレージの変更を監視
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === 'local' && changes[storageKey]) {
        setTheme(changes[storageKey].newValue as Theme)
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    // クリーンアップ関数
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [storageKey])

  useEffect(() => {
    const root = window.document.documentElement
    // 既存のインラインスタイルをクリア
    root.removeAttribute('style')
    // ライト/ダークのクラス除去
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
      return
    }

    if (theme === 'user') {
      chrome.storage.local
        .get('userSettings')
        .then((result: { userSettings?: UserSettings }) => {
          const userSettings = result.userSettings
          if (!userSettings) return
          const { colors = {} } = userSettings
          for (const [key, val] of Object.entries(colors)) {
            root.style.setProperty(`--${key}`, val)
          }
        })
      return
    }

    // dark または light モードの直接適用
    root.classList.add(theme)
  }, [theme])

  // ユーザー設定のカラー変更を監視し、即座にCSS変数を更新
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === 'local' && theme === 'user' && changes.userSettings) {
        const updated = changes.userSettings.newValue as UserSettings
        const { colors = {} } = updated
        const root = window.document.documentElement
        for (const [key, val] of Object.entries(colors)) {
          root.style.setProperty(`--${key}`, val)
        }
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => {
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      // Chrome Storageに保存
      chrome.storage.local.set({ [storageKey]: theme })
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
