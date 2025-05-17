import type { UserSettings } from '@/utils/storage'
import {
  defaultSettings,
  getUserSettings,
  saveUserSettings,
} from '@/utils/storage'
import { useEffect, useState } from 'react'

export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [excludePatterns, setExcludePatterns] = useState<string[]>([])

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true)
      try {
        const userSettings = await getUserSettings()
        setSettings(userSettings)
        setExcludePatterns(userSettings.excludePatterns)
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
      if (areaName === 'local') {
        if (changes.userSettings) {
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
    }

    chrome.storage.onChanged.addListener(storageChangeListener)

    // クリーンアップ関数
    return () => {
      chrome.storage.onChanged.removeListener(storageChangeListener)
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
        ...settings,
        [key]: value,
      }

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
    setExcludePatterns(patterns)
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
    excludePatterns,
    updateSetting,
    handleSaveSettings,
    handleExcludePatternsChange,
    handleExcludePatternsBlur,
  }
}
