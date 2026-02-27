import {
  getChromeStorageLocal,
  warnMissingChromeStorage,
} from '@/lib/browser/chrome-storage'
import type { UserSettings } from '@/types/storage'

// デフォルト設定
export const defaultSettings: UserSettings = {
  removeTabAfterOpen: true,
  removeTabAfterExternalDrop: true,
  excludePatterns: ['chrome-extension://', 'chrome://'],
  enableCategories: true, // デフォルトは有効
  autoDeletePeriod: 'never', // デフォルトでは自動削除しない
  showSavedTime: false, // デフォルトでは表示しない
  clickBehavior: 'saveSameDomainTabs', // デフォルトは「現在開いているドメインのタブをすべて保存」
  excludePinnedTabs: true, // デフォルトでは固定タブを除外する
  openUrlInBackground: true, // デフォルト: URLをバックグラウンドで開く
  openAllInNewWindow: false, // デフォルト: 「すべてのタブを開く」を現在のウィンドウで開く
  confirmDeleteAll: false, // デフォルト: 確認しない
  confirmDeleteEach: false, // デフォルト: 確認しない
  colors: {}, // デフォルト: カラー設定まとめ
}

// 設定を取得する関数
export async function getUserSettings(): Promise<UserSettings> {
  try {
    console.log('ユーザー設定を取得中...')
    const storageLocal = getChromeStorageLocal()
    if (!storageLocal) {
      warnMissingChromeStorage('設定読み込み')
      return { ...defaultSettings }
    }

    const data = await storageLocal.get(['userSettings'])
    console.log('取得した設定データ:', data)

    if (data.userSettings) {
      console.log('保存された設定を使用:', data.userSettings)
      // デフォルト値とマージして返す
      return { ...defaultSettings, ...data.userSettings }
    }

    console.log('設定が見つからないためデフォルト値を使用')
    return { ...defaultSettings }
  } catch (error) {
    console.error('設定取得エラー:', error)
    return { ...defaultSettings }
  }
}

// 設定を保存する関数
export async function saveUserSettings(settings: UserSettings): Promise<void> {
  try {
    console.log('ユーザー設定を保存:', settings)
    const storageLocal = getChromeStorageLocal()
    if (!storageLocal) {
      warnMissingChromeStorage('設定保存')
      return
    }

    await storageLocal.set({ userSettings: settings })
    console.log('設定を保存しました')
  } catch (error) {
    console.error('設定保存エラー:', error)
    throw error
  }
}
