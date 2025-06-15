/**
 * 期限切れタブ管理モジュール
 */

import type { AutoDeletePeriod, TabGroup } from '@/types/background'

/**
 * 期限の文字列を対応するミリ秒に変換
 */
export function getExpirationPeriodMs(period: AutoDeletePeriod): number | null {
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  // テスト用に30秒も追加
  switch (period) {
    case '30sec':
      return 30 * 1000 // テスト用30秒
    case '1min':
      return minute
    case '1hour':
      return hour
    case '1day':
      return day
    case '7days':
      return 7 * day
    case '14days':
      return 14 * day
    case '30days':
      return 30 * day
    case '180days':
      return 180 * day // 約6ヶ月
    case '365days':
      return 365 * day // 1年
    default:
      return null // "never" または無効な値
  }
}

/**
 * 期限切れのタブをチェックして削除する関数
 */
export async function checkAndRemoveExpiredTabs(): Promise<void> {
  try {
    console.log('期限切れタブのチェックを開始...', new Date().toLocaleString())

    // ストレージから直接取得する - より単純化した取得方法
    const data = await chrome.storage.local.get(['userSettings'])
    const settings = data.userSettings || { autoDeletePeriod: 'never' }

    // デバッグログを追加
    console.log('ストレージから直接取得した設定:', data)
    console.log('使用する自動削除期間:', settings.autoDeletePeriod)

    // 自動削除が無効な場合は何もしない
    if (!settings.autoDeletePeriod || settings.autoDeletePeriod === 'never') {
      console.log('自動削除は無効です')
      return
    }

    // 期限をミリ秒で計算
    const expirationPeriod = getExpirationPeriodMs(settings.autoDeletePeriod)
    if (!expirationPeriod) {
      console.log('有効な期限が設定されていません')
      return
    }

    const currentTime = Date.now()
    const cutoffTime = currentTime - expirationPeriod
    console.log(`現在時刻: ${new Date(currentTime).toLocaleString()}`)
    console.log(`カットオフ時刻: ${new Date(cutoffTime).toLocaleString()}`)

    // 保存されたタブを取得
    const storageResult = await chrome.storage.local.get('savedTabs')
    const savedTabs: TabGroup[] = storageResult.savedTabs || []
    if (savedTabs.length === 0) {
      console.log('保存されたタブはありません')
      return
    }

    console.log(`チェック対象タブグループ数: ${savedTabs.length}`)

    // チェック対象のURL数を計算
    const totalUrlCount: number = savedTabs.reduce(
      (acc: number, g: TabGroup) => acc + g.urls.length,
      0,
    )

    // URL単位で期限切れをフィルタリング
    const updatedTabs = savedTabs
      .map((group: TabGroup) => {
        const originalUrlCount = group.urls.length
        const filteredUrls = group.urls.filter(urlEntry => {
          const urlSavedAt = urlEntry.savedAt ?? group.savedAt ?? currentTime
          const isUrlExpired = urlSavedAt < cutoffTime
          if (isUrlExpired) {
            console.log(`削除: URL ${urlEntry.url} (ドメイン: ${group.domain})`)
            return false
          }
          return true
        })
        if (filteredUrls.length !== originalUrlCount) {
          console.log(
            `グループ ${group.domain}: ${originalUrlCount - filteredUrls.length} 件のURLを削除`,
          )
        }
        group.urls = filteredUrls
        return group
      })
      .filter(group => group.urls.length > 0)

    // 更新後のURL数を計算
    const updatedUrlCount: number = updatedTabs.reduce(
      (acc: number, g: TabGroup) => acc + g.urls.length,
      0,
    )

    // 変更があった場合のみ保存
    if (
      updatedTabs.length !== savedTabs.length ||
      updatedUrlCount !== totalUrlCount
    ) {
      console.log(
        `削除前: ${savedTabs.length} グループ, ${totalUrlCount} 件のURL`,
      )
      console.log(
        `削除後: ${updatedTabs.length} グループ, ${updatedUrlCount} 件のURL`,
      )
      await chrome.storage.local.set({ savedTabs: updatedTabs })
      console.log('期限切れタブを削除しました')
    } else {
      console.log('削除対象のタブはありませんでした')
    }
  } catch (error: unknown) {
    console.error(
      '期限切れタブチェックエラー:',
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * タブの保存時刻を指定の期間に応じて更新する関数
 */
export async function updateTabTimestamps(
  period?: string,
): Promise<{ success: boolean; timestamp: number }> {
  try {
    console.log(`タブの保存時刻を更新します: ${period || '不明な期間'}`)

    const storageResult = await chrome.storage.local.get('savedTabs')
    const savedTabs: TabGroup[] = storageResult.savedTabs || []
    if (savedTabs.length === 0) {
      console.log('保存されたタブがありません')
      return { success: false, timestamp: 0 }
    }

    const now = Date.now()
    let timestamp: number

    // テスト用設定の場合は現在時刻より前に設定
    if (period === '30sec') {
      // 30秒前に設定（テスト用）
      timestamp = now - 40 * 1000 // 余裕を持って40秒前
      console.log(
        `保存時刻を30秒前に設定: ${new Date(timestamp).toLocaleString()}`,
      )
    } else if (period === '1min') {
      // 1分10秒前に設定（テスト用）
      timestamp = now - 70 * 1000 // 余裕を持って70秒前
      console.log(
        `保存時刻を1分10秒前に設定: ${new Date(timestamp).toLocaleString()}`,
      )
    } else {
      // デフォルトは現在時刻
      timestamp = now
      console.log(
        `保存時刻を現在時刻に設定: ${new Date(timestamp).toLocaleString()}`,
      )
    }

    // タブの保存時刻を更新
    const updatedTabs = savedTabs.map((group: TabGroup) => ({
      ...group,
      savedAt: timestamp,
    }))

    // ストレージに保存
    await chrome.storage.local.set({ savedTabs: updatedTabs })
    console.log(
      `${updatedTabs.length}個のタブグループの時刻を ${new Date(timestamp).toLocaleString()} に更新しました`,
    )

    // 即座に確認
    checkAndRemoveExpiredTabs()

    return { success: true, timestamp }
  } catch (error) {
    console.error('タブ時刻更新エラー:', error)
    throw error
  }
}
