import { colorOptions } from '@/constants/colorOptions'
import type { UserSettings } from '@/utils/storage'
import { saveUserSettings } from '@/utils/storage'
// No useState needed here
import { toast } from 'sonner'

export const useColorSettings = (
  settings: UserSettings,
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>,
) => {
  // カラー設定ハンドラ
  const handleColorChange = async (key: string, value: string) => {
    try {
      const newColors = { ...(settings.colors || {}), [key]: value }
      const newSettings = { ...settings, colors: newColors }
      setSettings(newSettings)
      // ライブプレビュー: 即座にCSS変数を更新
      document.documentElement.style.setProperty(`--${key}`, value)
      await saveUserSettings(newSettings)
      return true
    } catch (error) {
      console.error(`カラー ${key} 保存エラー:`, error)
      return false
    }
  }

  // カラー設定をリセットするハンドラ
  const handleResetColors = async () => {
    try {
      // 色設定を削除した新しい設定を作成
      const newSettings = { ...settings, colors: {} }
      setSettings(newSettings)

      // CSS変数をリセット（デフォルトテーマに戻す）
      for (const { key } of colorOptions) {
        document.documentElement.style.removeProperty(`--${key}`)
      }

      // ストレージから色設定を削除
      await saveUserSettings(newSettings)

      // テーマをシステムに戻す
      chrome.storage.local.set({ 'tab-manager-theme': 'system' })

      // 成功メッセージを表示
      toast.success('カラー設定をリセットしました')
      return true
    } catch (error) {
      console.error('カラーリセットエラー:', error)
      toast.error('カラー設定のリセットに失敗しました')
      return false
    }
  }

  return {
    handleColorChange,
    handleResetColors,
  }
}
