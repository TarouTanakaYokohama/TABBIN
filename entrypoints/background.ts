/**
 * Background script - メインエントリーポイント
 * リファクタリング後のモジュラー構造
 */

import {
  getParentCategories,
  migrateParentCategoriesToDomainNames,
} from '@/lib/storage'
import { defineBackground } from 'wxt/utils/define-background'

import { setupExpiredTabsCheckAlarm } from '@/lib/background/alarm-notification'
// 分離したモジュールをインポート
import { createContextMenus } from '@/lib/background/context-menu'
import { handleExtensionActionClick } from '@/lib/background/extension-actions'
import { setupMessageListener } from '@/lib/background/message-handler'
import { handleTabCreated } from '@/lib/background/url-storage'

export default defineBackground(() => {
  // 拡張機能インストール・更新時の処理
  chrome.runtime.onInstalled.addListener(details => {
    const manifestVersion = chrome.runtime.getManifest().version
    if (details.reason === 'install') {
      chrome.tabs.create({ url: chrome.runtime.getURL('saved-tabs.html') })
      chrome.storage.local.set({
        seenVersion: manifestVersion,
        changelogShown: true,
      })
    } else if (details.reason === 'update') {
      // バージョンアップ時に変更点を表示（一度だけ）
      chrome.storage.local.get(
        { seenVersion: '', changelogShown: false },
        items => {
          if (items.seenVersion !== manifestVersion) {
            // 新しいバージョンの場合、changelogShownをリセット
            if (!items.changelogShown) {
              // まだ表示していない場合のみ開く
              chrome.tabs.create({
                url: chrome.runtime.getURL('changelog.html'),
              })
              chrome.storage.local.set({
                seenVersion: manifestVersion,
                changelogShown: true, // 表示したことをマークする
              })
              console.log(
                `新バージョン ${manifestVersion} の変更履歴を表示しました`,
              )
            } else {
              // ただしバージョンは更新する
              chrome.storage.local.set({ seenVersion: manifestVersion })
              console.log(
                `新バージョン ${manifestVersion} に更新されましたが、変更履歴は既に表示済みです`,
              )
            }
          }
        },
      )
    }
  })

  // 初期化時にコンテキストメニューとハンドラーを設定
  try {
    // コンテキストメニューを作成
    createContextMenus()
    console.log('コンテキストメニューの初期化が完了しました')
  } catch (error) {
    console.error('コンテキストメニュー初期化エラー:', error)
  }
  // バックグラウンド初期化時に一度だけマイグレーションを実行
  ;(async () => {
    try {
      console.log('バックグラウンド起動時のデータ構造チェックを開始...')

      // 既存のカテゴリを確認
      const categories = await getParentCategories()
      console.log('現在の親カテゴリ:', categories)

      // 強制的にマイグレーションを実行する
      console.log('親カテゴリのdomainNamesの強制マイグレーションを実行')
      await migrateParentCategoriesToDomainNames()

      // 移行後のデータを確認
      const updatedCategories = await getParentCategories()
      console.log('移行後の親カテゴリ:', updatedCategories)

      // 期限切れタブのチェック用アラームを設定
      setupExpiredTabsCheckAlarm()
    } catch (error) {
      console.error('バックグラウンド初期化エラー:', error)
    }
  })()

  // インストール時に実行する処理
  chrome.runtime.onInstalled.addListener(async details => {
    console.log(`拡張機能がインストールまたは更新されました: ${details.reason}`)

    // データ構造の移行を実行
    try {
      console.log(
        '拡張機能インストール/更新時の親カテゴリデータ構造移行を開始...',
      )
      await migrateParentCategoriesToDomainNames()
      console.log('データ構造の移行が完了しました')
    } catch (error) {
      console.error('データ構造の移行に失敗しました:', error)
    }
  })

  // ブラウザアクション（拡張機能アイコン）クリック時の処理
  chrome.action.onClicked.addListener(handleExtensionActionClick)

  // メッセージリスナーを設定
  setupMessageListener()

  // 新しいタブが作成されたときの処理
  chrome.tabs.onCreated.addListener(handleTabCreated)
})
