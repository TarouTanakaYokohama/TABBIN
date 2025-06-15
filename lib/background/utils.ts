/**
 * Background script用ユーティリティ関数
 */

import { getUserSettings } from '@/lib/storage'
import { showNotification } from './alarm-notification'

/**
 * タブをユーザー設定に基づいてフィルタリングする共通関数
 */
export async function filterTabsByUserSettings(
  tabs: chrome.tabs.Tab[],
): Promise<chrome.tabs.Tab[]> {
  try {
    // ユーザー設定を取得
    const settings = await getUserSettings()

    let filteredTabs = [...tabs]

    // 固定タブを除外
    if (settings.excludePinnedTabs) {
      const beforeCount = filteredTabs.length
      filteredTabs = filteredTabs.filter(tab => !tab.pinned)
      const afterCount = filteredTabs.length

      if (beforeCount !== afterCount) {
        console.log(
          `固定タブを ${beforeCount - afterCount} 個除外しました (${beforeCount} → ${afterCount})`,
        )
      }
    }

    // 除外パターンに一致するタブもフィルタリング
    filteredTabs = filteredTabs.filter(tab => {
      if (!tab.url) return false
      return !settings.excludePatterns.some(pattern =>
        tab.url?.includes(pattern),
      )
    })

    return filteredTabs
  } catch (error) {
    console.error('タブフィルタリングエラー:', error)
    return tabs // エラー時は元のタブをそのまま返す
  }
}

// 通知表示の再エクスポート
export { showNotification }
