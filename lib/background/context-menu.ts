/**
 * コンテキストメニュー管理モジュール
 */

import { saveTabsWithAutoCategory } from '@/lib/storage'
import type { ContextMenuId } from '@/types/background'
import { openSavedTabsPage } from './saved-tabs-page'
import { filterTabsByUserSettings, showNotification } from './utils'

/**
 * コンテキストメニューを作成する関数
 */
export function createContextMenus(): void {
  console.log('コンテキストメニュー作成開始')

  // 既存のメニューをすべて削除
  if (chrome.contextMenus) {
    try {
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
          console.error('メニュー削除エラー:', chrome.runtime.lastError)
        }

        console.log('既存のコンテキストメニューを削除しました')

        // メニュー項目を作成
        try {
          createMenuItems()
          setupMenuClickHandler()
          console.log('コンテキストメニューを作成しました')
        } catch (e) {
          console.error('メニュー作成エラー:', e)
        }
      })
    } catch (e) {
      console.error('メニュー削除中のエラー:', e)
    }
  } else {
    console.error(
      'chrome.contextMenus APIが利用できません。manifest.jsonのパーミッションを確認してください。',
    )
  }
}

/**
 * メニュー項目を作成
 */
function createMenuItems(): void {
  const menuItems: Array<{
    id: ContextMenuId
    title: string
    type?: 'separator'
    contexts: ['page']
  }> = [
    {
      id: 'openSavedTabs',
      title: '保存したタブを開く',
      contexts: ['page'],
    },
    {
      id: 'sepOpenSavedTabs',
      title: '',
      type: 'separator',
      contexts: ['page'],
    },
    {
      id: 'saveCurrentTab',
      title: '現在のタブを保存',
      contexts: ['page'],
    },
    {
      id: 'saveAllTabs',
      title: 'ウィンドウをすべてのタブを保存',
      contexts: ['page'],
    },
    {
      id: 'saveSameDomainTabs',
      title: '現在開いているドメインのタブをすべて保存',
      contexts: ['page'],
    },
    {
      id: 'saveAllWindowsTabs',
      title: '他のウィンドウを含めすべてのタブを保存',
      contexts: ['page'],
    },
  ]

  for (const item of menuItems) {
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: item.contexts,
      ...(item.type && { type: item.type }),
    })
  }
}

/**
 * コンテキストメニュークリックハンドラーを設定
 */
function setupMenuClickHandler(): void {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log(`コンテキストメニューがクリックされました: ${info.menuItemId}`)

    try {
      switch (info.menuItemId) {
        case 'saveCurrentTab':
          await handleSaveCurrentTab(tab)
          break
        case 'saveAllTabs':
          await handleSaveAllTabs()
          break
        case 'saveSameDomainTabs':
          await handleSaveSameDomainTabs(tab)
          break
        case 'saveAllWindowsTabs':
          await handleSaveAllWindowsTabs()
          break
        case 'openSavedTabs':
          await openSavedTabsPage()
          break
      }
    } catch (error) {
      console.error('コンテキストメニュー処理エラー:', error)
    }
  })

  console.log('コンテキストメニュークリックハンドラーを設定しました')
}

/**
 * 現在のタブを保存
 */
async function handleSaveCurrentTab(
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  if (!tab || !tab.id) return

  console.log(`タブを保存: ${tab.url}`)

  // デバッグ情報を追加
  const tabInfo = await chrome.tabs.get(tab.id)
  console.log('保存するタブの詳細:', tabInfo)

  // タブをフィルタリング（固定タブを除外）
  const filteredTabs = await filterTabsByUserSettings([tabInfo])
  if (filteredTabs.length === 0) {
    console.log(
      'このタブは固定タブまたは除外パターンに一致するため保存されません',
    )
    return
  }

  // 単一タブを保存
  await saveTabsWithAutoCategory(filteredTabs)
  console.log('タブの保存が完了しました')

  // 通知を表示
  await showNotification('タブ保存', '現在のタブを保存しました')

  // タブを閉じる処理を追加
  try {
    if (tab.id) {
      console.log(`保存したタブ ${tab.id} を閉じます`)
      await chrome.tabs.remove(tab.id)
      console.log(`タブ ${tab.id} を閉じました`)
    }
  } catch (closeError) {
    console.error('タブを閉じる際にエラー:', closeError)
  }
}

/**
 * すべてのタブを保存
 */
async function handleSaveAllTabs(): Promise<void> {
  console.log('すべてのタブを保存します')

  // 現在のウィンドウのタブをすべて取得
  const tabs = await chrome.tabs.query({ currentWindow: true })
  console.log(`取得したタブ数: ${tabs.length}`)

  // タブをフィルタリング（固定タブを除外）
  const filteredTabs = await filterTabsByUserSettings(tabs)
  if (filteredTabs.length === 0) {
    console.log(
      '保存対象のタブがありません（全て固定タブか除外パターンに一致）',
    )
    return
  }

  console.log(`フィルタリング後のタブ数: ${filteredTabs.length}`)

  // 先にタブを保存してから、保存完了後にsaved-tabsページを開く
  await saveTabsWithAutoCategory(filteredTabs)
  console.log('すべてのタブの保存が完了しました')

  // 通知を表示
  await showNotification(
    'タブ保存',
    `${filteredTabs.length}個のタブを保存しました`,
  )

  // 保存処理の完了を確実に待ってからsaved-tabsページを開く
  console.log('saved-tabsページを開きます...')
  const savedTabsTabId = await openSavedTabsPage()
  console.log(`saved-tabsページID: ${savedTabsTabId}`)

  // 重複タブチェックを非同期で実行
  await handleDuplicateTabsCheck(savedTabsTabId)
}

/**
 * 同じドメインのタブを保存
 */
async function handleSaveSameDomainTabs(
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  if (!tab || !tab.url) return

  console.log(`現在のドメインのタブを保存: ${tab.url}`)

  // 現在のタブからドメインを取得
  const currentDomain = new URL(tab.url).hostname
  console.log(`現在のドメイン: ${currentDomain}`)

  // 現在のウィンドウの同じドメインのタブをすべて取得
  const tabs = await chrome.tabs.query({ currentWindow: true })
  const sameDomainTabs = tabs.filter(t => {
    if (!t.url) return false
    try {
      const tabUrl = new URL(t.url)
      return tabUrl.hostname === currentDomain
    } catch (_e) {
      return false
    }
  })

  // タブをフィルタリング（固定タブを除外）
  const filteredTabs = await filterTabsByUserSettings(sameDomainTabs)
  if (filteredTabs.length === 0) {
    console.log(
      '保存対象のタブがありません（全て固定タブか除外パターンに一致）',
    )
    return
  }

  console.log(`同じドメインのタブ数: ${filteredTabs.length}`)

  // タブを保存
  await saveTabsWithAutoCategory(filteredTabs)
  console.log('同じドメインのタブの保存が完了しました')

  // 通知を表示
  await showNotification(
    'タブ保存',
    `${currentDomain}の${filteredTabs.length}個のタブを保存しました`,
  )

  // 保存したタブを閉じる
  for (const domainTab of filteredTabs) {
    if (domainTab.id) {
      try {
        await chrome.tabs.remove(domainTab.id)
        console.log(`タブ ${domainTab.id} を閉じました`)
      } catch (closeError) {
        console.error('タブを閉じる際にエラー:', closeError)
      }
    }
  }
}

/**
 * すべてのウィンドウのタブを保存
 */
async function handleSaveAllWindowsTabs(): Promise<void> {
  console.log('すべてのウィンドウのタブを保存します')

  // すべてのウィンドウのタブを取得
  const allTabs = await chrome.tabs.query({})
  console.log(`取得したすべてのタブ数: ${allTabs.length}`)

  // タブをフィルタリング（固定タブを除外）
  const filteredTabs = await filterTabsByUserSettings(allTabs)
  if (filteredTabs.length === 0) {
    console.log(
      '保存対象のタブがありません（全て固定タブか除外パターンに一致）',
    )
    return
  }

  console.log(`フィルタリング後のタブ数: ${filteredTabs.length}`)

  // タブを保存
  await saveTabsWithAutoCategory(filteredTabs)
  console.log('すべてのウィンドウのタブの保存が完了しました')

  // 通知を表示
  await showNotification(
    'タブ保存',
    `すべてのウィンドウから${filteredTabs.length}個のタブを保存しました`,
  )

  // タブを閉じる
  const savedTabsUrls = ['saved-tabs.html', 'chrome-extension://']
  for (const tab of filteredTabs) {
    if (
      tab.id &&
      tab.url &&
      !savedTabsUrls.some(url => tab.url?.includes(url))
    ) {
      try {
        await chrome.tabs.remove(tab.id)
        console.log(`タブ ${tab.id} を閉じました`)
      } catch (closeError) {
        console.error('タブを閉じる際にエラー:', closeError)
      }
    }
  }
}

/**
 * 重複タブチェックを処理
 */
async function handleDuplicateTabsCheck(
  savedTabsTabId: number | null,
): Promise<void> {
  Promise.resolve().then(async () => {
    await new Promise(resolve => setTimeout(resolve, 16))
    try {
      const checkTabs = await chrome.tabs.query({})
      const savedTabsPages = checkTabs.filter(
        tab =>
          tab.url?.includes('saved-tabs.html') ||
          tab.pendingUrl?.includes('saved-tabs.html'),
      )

      // メインのタブ以外は閉じる
      if (savedTabsPages.length > 1) {
        console.log(
          `追加チェック: ${savedTabsPages.length - 1}個の重複タブを閉じます`,
        )
        for (const tab of savedTabsPages) {
          if (tab.id !== savedTabsTabId && tab.id) {
            try {
              await chrome.tabs.remove(tab.id)
              console.log(`重複タブ ${tab.id} を閉じました`)
            } catch (e) {
              console.error('重複タブを閉じる際にエラー:', e)
            }
          }
        }
      }
    } catch (e) {
      console.error('追加タブチェック中にエラー:', e)
    }
  })
}
