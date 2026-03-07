import { useEffect, useRef, useState } from 'react'
import {
  getChromeStorageOnChanged,
  warnMissingChromeStorage,
} from '@/lib/browser/chrome-storage'
import {
  defaultSettings,
  getUserSettings,
  saveUserSettings,
} from '@/lib/storage/settings'
import type { UserSettings } from '@/types/storage'

export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const settingsRef = useRef(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true)
      try {
        const userSettings = await getUserSettings()
        setSettings(userSettings)
      } catch (error) {
        console.error('設定の読み込みエラー:', error)
        setSettings(defaultSettings) // エラー時はデフォルト設定を適用
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()

    const storageChangeListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === 'local' && changes.userSettings) {
        if (changes.userSettings.newValue) {
          // newValue は完全な UserSettings オブジェクトであると期待
          setSettings(changes.userSettings.newValue as UserSettings)
        } else {
          // userSettings がストレージから削除された場合 (newValue が undefined)
          // デフォルト設定に戻す
          setSettings(defaultSettings)
        }
      }
    }

    const storageOnChanged = getChromeStorageOnChanged()
    if (!storageOnChanged) {
      warnMissingChromeStorage('設定変更監視')
      return
    }

    storageOnChanged.addListener(storageChangeListener)

    // クリーンアップ関数
    return () => {
      storageOnChanged.removeListener(storageChangeListener)
    }
  }, [])

  const handleSaveSettings = async () => {
    try {
      // 保存する前に空の行を除外
      const cleanSettings = {
        ...settings,
        excludePatterns: settings.excludePatterns.filter(p => p.trim()),
      }
      await saveUserSettings(cleanSettings)
    } catch (error) {
      console.error('設定の保存エラー:', error)
    }
  }

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    try {
      const newSettings = {
        ...settingsRef.current,
        [key]: value,
      }

      settingsRef.current = newSettings
      setSettings(newSettings)
      await saveUserSettings(newSettings)
      return true
    } catch (error) {
      console.error(`設定の保存エラー (${String(key)}):`, error)
      return false
    }
  }

  const handleExcludePatternsChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    // 空の行も含めて全ての行を保持
    const patterns = e.target.value.split('\n')
    setSettings(prev => ({
      ...prev,
      excludePatterns: patterns,
    }))
  }

  const handleExcludePatternsBlur = () => {
    handleSaveSettings()
  }

  return {
    settings,
    setSettings,
    isLoading,
    updateSetting,
    handleSaveSettings,
    handleExcludePatternsChange,
    handleExcludePatternsBlur,
  }
}
