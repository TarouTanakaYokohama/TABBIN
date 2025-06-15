/**
 * 保存されたタブページ管理モジュール
 */

// タブ作成を制御するためのフラグ
let isCreatingSavedTabsPage = false
let savedTabsPageId: number | null = null

/**
 * 保存されたタブを表示する共通関数
 */
export async function openSavedTabsPage(): Promise<number | null> {
  // 既に作成中の場合は待機
  if (isCreatingSavedTabsPage) {
    console.log('既にsaved-tabsページの作成処理が実行中です。待機します...')
    // 既存のタブIDを返す
    if (savedTabsPageId) {
      console.log(`既存のsaved-tabsページのIDを返します: ${savedTabsPageId}`)
      return savedTabsPageId
    }

    // 処理中なのでダミーの値を返す（後で正しいIDに置き換えられる）
    return -1
  }

  // 作成中フラグをセット
  isCreatingSavedTabsPage = true

  try {
    // 保存されたタブを表示するページのURLを構築
    const savedTabsUrl = chrome.runtime.getURL('saved-tabs.html')
    console.log('開くURL:', savedTabsUrl)

    // 既存のタブIDが保存されていれば再利用
    if (savedTabsPageId) {
      try {
        // タブが実際に存在するか確認
        const tab = await chrome.tabs.get(savedTabsPageId)
        if (tab) {
          console.log(`保存されていたタブID ${savedTabsPageId} を再利用します`)
          await chrome.tabs.update(savedTabsPageId, { active: true })

          // 既存のタブが固定されていない場合は固定する
          if (!tab.pinned) {
            try {
              await chrome.tabs.update(savedTabsPageId, { pinned: true })
              console.log(`既存のタブ ${savedTabsPageId} をピン留めしました`)
            } catch (e) {
              console.error('既存タブのピン留め設定中にエラー:', e)
            }
          }

          return savedTabsPageId
        }
      } catch (_e) {
        // タブが見つからない場合は続行して新しく作成
        console.log(
          '保存されていたタブIDは存在しませんでした。新規作成します。',
        )
        savedTabsPageId = null
      }
    }

    // まず既存のすべてのタブを取得
    const allTabs = await chrome.tabs.query({})
    console.log(`全タブ数: ${allTabs.length}`)

    // saved-tabs.htmlを含むタブを検索（より広範な検索条件）
    const savedTabsPages = allTabs.filter(tab => {
      return (
        tab.url?.includes('saved-tabs.html') ||
        tab.pendingUrl?.includes('saved-tabs.html')
      )
    })

    console.log(`既存のsaved-tabsページ数: ${savedTabsPages.length}`)

    // 既存のタブがある場合
    if (savedTabsPages.length > 0) {
      // 最初のタブを使用
      const mainTab = savedTabsPages[0]
      savedTabsPageId = mainTab.id || null

      console.log(`既存のタブを使用します: ${savedTabsPageId}`)

      if (savedTabsPageId) {
        await chrome.tabs.update(savedTabsPageId, { active: true })

        // 既存のタブが固定されていない場合は固定する
        if (!mainTab.pinned) {
          try {
            await chrome.tabs.update(savedTabsPageId, { pinned: true })
            console.log(`既存のタブ ${savedTabsPageId} をピン留めしました`)
          } catch (e) {
            console.error('既存タブのピン留め設定中にエラー:', e)
          }
        }

        // 重複タブを閉じる（最初のタブ以外）
        await closeDuplicateTabs(savedTabsPages, savedTabsPageId)
      }

      return savedTabsPageId
    }

    // 新しいタブを作成
    console.log('新しいタブを作成します')

    // タブを同期的に作成してIDを保存
    const newTab = await chrome.tabs.create({ url: savedTabsUrl })
    savedTabsPageId = newTab.id || null

    console.log(`新しいsaved-tabsページを作成しました。ID: ${savedTabsPageId}`)

    // 新しく作成したタブを必ず固定する
    if (savedTabsPageId) {
      try {
        await chrome.tabs.update(savedTabsPageId, { pinned: true })
        console.log(`タブ ${savedTabsPageId} をピン留めしました`)
      } catch (e) {
        console.error('ピン留め設定中にエラー:', e)
      }
    }

    return savedTabsPageId
  } catch (error) {
    console.error('saved-tabsページを開く際にエラーが発生しました:', error)
    return null
  } finally {
    // 処理完了後にフラグをリセット
    isCreatingSavedTabsPage = false
  }
}

/**
 * 重複タブを閉じる
 */
async function closeDuplicateTabs(
  savedTabsPages: chrome.tabs.Tab[],
  _mainTabId: number,
): Promise<void> {
  if (savedTabsPages.length > 1) {
    console.log(`${savedTabsPages.length - 1}個の重複タブを閉じます`)
    for (let i = 1; i < savedTabsPages.length; i++) {
      const tabId = savedTabsPages[i].id
      if (typeof tabId === 'number') {
        try {
          await chrome.tabs.remove(tabId)
          console.log(`重複タブ ${tabId} を閉じました`)
        } catch (e) {
          console.error('重複タブを閉じる際にエラー:', e)
        }
      }
    }
  }
}

/**
 * saved-tabsページのIDをリセット（テスト用）
 */
export function resetSavedTabsPageId(): void {
  savedTabsPageId = null
  isCreatingSavedTabsPage = false
}
