// バックグラウンドスクリプト - タブ操作のバックグラウンド処理
import type { TabGroup } from '../utils/storage'

// URLsを安全に削除する処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'safeDeleteCategoryTabs') {
    // バックグラウンドでタブ削除を処理
    safeDeleteCategoryTabsBackground(
      request.groupId,
      request.categoryName,
      request.urls,
    )
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('Safe delete failed:', error)
        sendResponse({ success: false, error: error.message })
      })

    // 非同期処理を示すためにtrueを返す
    return true
  }

  // 空グループチェックハンドラ
  if (request.action === 'checkEmptyGroupAfterUrlDeletion') {
    checkEmptyGroupAndDelete(request.groupId)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('Empty group check failed:', error)
        sendResponse({ success: false, error: error.message })
      })

    return true
  }

  // 他のメッセージハンドラがあればここに追加
})

// カテゴリ内のタブを安全に削除する
async function safeDeleteCategoryTabsBackground(
  groupId: string,
  categoryName: string,
  urlsToDelete: Array<{ url: string }>,
) {
  try {
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

    // グループを検索
    const group = savedTabs.find((g: TabGroup) => g.id === groupId)
    if (!group) return { success: false, message: 'Group not found' }

    // 削除用URLのリスト作成
    const urlsToRemove = urlsToDelete.map(item => item.url)

    // 残りのURLを計算
    const remainingUrls = group.urls.filter(
      (urlItem: TabGroup['urls'][number]) =>
        !urlsToRemove.includes(urlItem.url),
    )

    // グループが空になる場合は削除
    if (remainingUrls.length === 0) {
      // タブグループ削除前の処理を実行
      const { handleTabGroupRemoval } = await import('../utils/tab-operations')
      await handleTabGroupRemoval(groupId)

      // グループを削除
      const updatedTabs = savedTabs.filter((g: TabGroup) => g.id !== groupId)
      await chrome.storage.local.set({ savedTabs: updatedTabs })

      return {
        success: true,
        isEmpty: true,
        message: 'Group was empty and removed',
      }
    }

    // 残りのURLがある場合はグループを更新
    const updatedGroups = savedTabs.map((g: TabGroup) => {
      if (g.id === groupId) {
        return { ...g, urls: remainingUrls }
      }
      return g
    })

    await chrome.storage.local.set({ savedTabs: updatedGroups })

    return {
      success: true,
      isEmpty: false,
      message: `Removed ${urlsToRemove.length} tabs from category ${categoryName}`,
    }
  } catch (error) {
    console.error('Safe delete operation failed:', error)
    return { success: false, error: (error as Error).message }
  }
}

// 既存のグループチェック関数
async function checkEmptyGroupAndDelete(groupId: string) {
  try {
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

    // 対象のグループを検索
    const groupIndex = savedTabs.findIndex(
      (group: TabGroup) => group.id === groupId,
    )

    // グループが見つからない場合
    if (groupIndex === -1) {
      return { success: true, isEmpty: false, message: 'Group not found' }
    }

    // グループのURLが0件かどうか確認
    const group = savedTabs[groupIndex]

    if (group.urls.length === 0) {
      // URLが0件の場合、グループを削除
      console.log('Empty group detected, removing:', groupId)

      // 削除前処理を実行
      const { handleTabGroupRemoval } = await import('../utils/tab-operations')
      await handleTabGroupRemoval(groupId)

      // グループを削除
      savedTabs.splice(groupIndex, 1)
      await chrome.storage.local.set({ savedTabs })

      return { success: true, isEmpty: true, message: 'Empty group removed' }
    }

    return { success: true, isEmpty: false, message: 'Group has items' }
  } catch (error) {
    console.error('Error checking/deleting empty group:', error)
    return { success: false, error: (error as Error).message }
  }
}
