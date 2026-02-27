import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  getChromeStorageLocal,
  getChromeStorageOnChanged,
  warnMissingChromeStorage,
} from '@/lib/browser/chrome-storage'
import type { UserSettings } from '@/types/storage'

type Theme = 'dark' | 'light' | 'system' | 'user'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

interface ThemeProviderState {
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
  const [theme, setThemeState] = useState<Theme>(defaultTheme)

  // 初期化時にChrome Storageから設定を読み込む
  useEffect(() => {
    const storageLocal = getChromeStorageLocal()
    if (storageLocal) {
      storageLocal.get(storageKey).then(result => {
        if (result[storageKey]) {
          setThemeState(result[storageKey] as Theme)
        }
      })
    } else {
      warnMissingChromeStorage('テーマ読み込み')
    }

    // ストレージの変更を監視
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === 'local' && changes[storageKey]) {
        setThemeState(changes[storageKey].newValue as Theme)
      }
    }

    const storageOnChanged = getChromeStorageOnChanged()
    if (!storageOnChanged) {
      warnMissingChromeStorage('テーマ変更監視')
      return
    }

    storageOnChanged.addListener(handleStorageChange)

    // クリーンアップ関数
    return () => {
      storageOnChanged.removeListener(handleStorageChange)
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
      const storageLocal = getChromeStorageLocal()
      if (!storageLocal) {
        warnMissingChromeStorage('ユーザーテーマ適用')
        return
      }

      storageLocal
        .get('userSettings')
        .then((result: { userSettings?: UserSettings }) => {
          const userSettings = result.userSettings
          if (!userSettings) {
            return
          }
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
    const storageOnChanged = getChromeStorageOnChanged()
    if (!storageOnChanged) {
      warnMissingChromeStorage('ユーザーテーマ色監視')
      return
    }

    storageOnChanged.addListener(listener)
    return () => {
      storageOnChanged.removeListener(listener)
    }
  }, [theme])

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      // Chrome Storageに保存
      const storageLocal = getChromeStorageLocal()
      if (storageLocal) {
        storageLocal.set({ [storageKey]: nextTheme })
      } else {
        warnMissingChromeStorage('テーマ保存')
      }
      setThemeState(nextTheme)
    },
    [storageKey],
  )

  const value = useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme],
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

/**
 * テーマコンテキストにアクセスするためのカスタムフック
 * @returns テーマ状態と設定関数
 */
export const useTheme = (): ThemeProviderState => {
  const context = use(ThemeProviderContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
