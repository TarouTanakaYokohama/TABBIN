/**
 * コンテキストメニュー管理モジュール
 */

import type { ContextMenuId } from '@/types/background'
import {
  handleSaveAllWindowsTabs,
  handleSaveCurrentTab,
  handleSaveSameDomainTabs,
  handleSaveWindowTabs,
} from './extension-actions'
import { openSavedTabsPage } from './saved-tabs-page'

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
      title: 'ウィンドウのすべてのタブを保存',
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
  chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
    console.log(`コンテキストメニューがクリックされました: ${info.menuItemId}`)

    try {
      switch (info.menuItemId) {
        case 'saveCurrentTab':
          await handleSaveCurrentTab()
          break
        case 'saveAllTabs':
          await handleSaveWindowTabs()
          break
        case 'saveSameDomainTabs':
          await handleSaveSameDomainTabs()
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
