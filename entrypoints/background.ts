import { defineBackground } from 'wxt/utils/define-background'
import {
  type SubCategoryKeyword,
  getParentCategories,
  getUserSettings,
  migrateParentCategoriesToDomainNames,
  saveTabsWithAutoCategory,
} from '../utils/storage'

// 型定義
interface ProjectUrl {
  url: string
  title: string
  savedAt: number
}

interface Project {
  id: string
  name: string
  description: string
  urls: ProjectUrl[]
  categories: string[]
  createdAt: number
  updatedAt: number
}

interface TabGroup {
  id: string
  domain: string
  parentCategoryId?: string
  urls: Array<{
    url: string
    title: string
    subCategory?: string
    savedAt?: number // 個別URL保存時刻
  }>
  subCategories?: string[]
  categoryKeywords?: SubCategoryKeyword[]
  savedAt?: number // グループ全体の保存時刻
}

interface ParentCategory {
  id: string
  name: string
  domains: string[]
  domainNames: string[]
}

export default defineBackground(() => {
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

  // ドラッグされたURL情報を一時保存するためのストア
  let draggedUrlInfo: {
    url: string
    timestamp: number
    processed: boolean // 処理済みフラグを追加
  } | null = null

  // タブ作成を制御するためのフラグ (新規追加)
  let isCreatingSavedTabsPage = false
  let savedTabsPageId: number | null = null

  // コンテキストメニューを作成する関数を改善
  function createContextMenus() {
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
            // 保存したタブを開くメニュー
            chrome.contextMenus.create({
              id: 'openSavedTabs',
              title: '保存したタブを開く',
              contexts: ['page'],
            })
            chrome.contextMenus.create({
              id: 'sepOpenSavedTabs',
              type: 'separator',
              contexts: ['page'],
            })
            // 現在のタブを保存メニュー
            chrome.contextMenus.create({
              id: 'saveCurrentTab',
              title: '現在のタブを保存',
              contexts: ['page'],
            })

            // すべてのタブを保存メニュー
            chrome.contextMenus.create({
              id: 'saveAllTabs',
              title: 'ウィンドウをすべてのタブを保存',
              contexts: ['page'],
            })

            // 現在開いているドメインのタブをすべて保存するメニュー
            chrome.contextMenus.create({
              id: 'saveSameDomainTabs',
              title: '現在開いているドメインのタブをすべて保存',
              contexts: ['page'],
            })

            // 他のウィンドウを含めすべてのタブを保存するメニュー
            chrome.contextMenus.create({
              id: 'saveAllWindowsTabs',
              title: '他のウィンドウを含めすべてのタブを保存',
              contexts: ['page'],
            })

            console.log('コンテキストメニューを作成しました')

            // コンテキストメニュークリックイベントを設定（この位置に移動）
            chrome.contextMenus.onClicked.addListener(async (info, tab) => {
              console.log(
                `コンテキストメニューがクリックされました: ${info.menuItemId}`,
              )

              try {
                if (info.menuItemId === 'saveCurrentTab' && tab && tab.id) {
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

                  // 通知を表示（エラーハンドリング改善）
                  try {
                    // 正しいアイコンパスを設定
                    const iconUrl = chrome.runtime.getURL('icon/128.png')
                    console.log('通知アイコンURL:', iconUrl)

                    await chrome.notifications.create({
                      type: 'basic',
                      iconUrl: iconUrl,
                      title: 'タブ保存',
                      message: '現在のタブを保存しました',
                    })
                  } catch (notificationError) {
                    // 通知エラーをキャッチしても処理を続行
                    console.error('通知表示エラー:', notificationError)
                  }

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
                } else if (info.menuItemId === 'saveAllTabs') {
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

                  console.log(
                    `フィルタリング後のタブ数: ${filteredTabs.length}`,
                  )

                  // 先にタブを保存してから、保存完了後にsaved-tabsページを開く
                  await saveTabsWithAutoCategory(filteredTabs)
                  console.log('すべてのタブの保存が完了しました')

                  // 通知を表示（エラーハンドリング改善）
                  try {
                    // 正しいアイコンパスを設定
                    const iconUrl = chrome.runtime.getURL('icon/128.png')
                    console.log('通知アイコンURL:', iconUrl)

                    await chrome.notifications.create({
                      type: 'basic',
                      iconUrl: iconUrl,
                      title: 'タブ保存',
                      message: `${filteredTabs.length}個のタブを保存しました`,
                    })
                  } catch (notificationError) {
                    // 通知エラーをキャッチしても処理を続行
                    console.error('通知表示エラー:', notificationError)
                  }

                  // 保存処理の完了を確実に待ってからsaved-tabsページを開く
                  console.log('saved-tabsページを開きます...')
                  const savedTabsTabId = await openSavedTabsPage()
                  console.log(`saved-tabsページID: ${savedTabsTabId}`)

                  // 少し待機してから重複タブをチェック (安全対策)
                  setTimeout(async () => {
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
                  }, 500)
                } else if (
                  info.menuItemId === 'saveSameDomainTabs' &&
                  tab &&
                  tab.url
                ) {
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
                  const filteredTabs =
                    await filterTabsByUserSettings(sameDomainTabs)
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
                  try {
                    const iconUrl = chrome.runtime.getURL('icon/128.png')
                    await chrome.notifications.create({
                      type: 'basic',
                      iconUrl: iconUrl,
                      title: 'タブ保存',
                      message: `${currentDomain}の${filteredTabs.length}個のタブを保存しました`,
                    })
                  } catch (notificationError) {
                    console.error('通知表示エラー:', notificationError)
                  }

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
                } else if (info.menuItemId === 'saveAllWindowsTabs') {
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

                  console.log(
                    `フィルタリング後のタブ数: ${filteredTabs.length}`,
                  )

                  // タブを保存
                  await saveTabsWithAutoCategory(filteredTabs)
                  console.log('すべてのウィンドウのタブの保存が完了しました')

                  // 通知を表示
                  try {
                    const iconUrl = chrome.runtime.getURL('icon/128.png')
                    await chrome.notifications.create({
                      type: 'basic',
                      iconUrl: iconUrl,
                      title: 'タブ保存',
                      message: `すべてのウィンドウから${filteredTabs.length}個のタブを保存しました`,
                    })
                  } catch (notificationError) {
                    console.error('通知表示エラー:', notificationError)
                  }

                  // タブを閉じる
                  const savedTabsUrls = [
                    'saved-tabs.html',
                    'chrome-extension://',
                  ]
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
                } else if (info.menuItemId === 'openSavedTabs') {
                  await openSavedTabsPage()
                  return
                }
              } catch (error) {
                console.error('コンテキストメニュー処理エラー:', error)
              }
            })

            console.log('コンテキストメニュークリックハンドラーを設定しました')
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

  // 保存されたタブを表示する共通関数を改善
  async function openSavedTabsPage() {
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
            console.log(
              `保存されていたタブID ${savedTabsPageId} を再利用します`,
            )
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

        return savedTabsPageId
      }

      // 新しいタブを作成
      console.log('新しいタブを作成します')

      // タブを同期的に作成してIDを保存
      const newTab = await chrome.tabs.create({ url: savedTabsUrl })
      savedTabsPageId = newTab.id || null

      console.log(
        `新しいsaved-tabsページを作成しました。ID: ${savedTabsPageId}`,
      )

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

  // 期限切れタブのチェック用アラームを設定
  function setupExpiredTabsCheckAlarm() {
    try {
      console.log('期限切れタブのチェックアラームを設定しています...')

      // chrome.alarmsが利用可能か確認
      if (!chrome.alarms) {
        console.error(
          'chrome.alarms APIが利用できません。Manifest.jsonで権限を確認してください。',
        )
        // アラーム処理が使えない場合でも、初回のチェックは実行
        checkAndRemoveExpiredTabs()
        return
      }

      // エラーハンドリングを追加してアラームを作成
      const createAlarm = () => {
        try {
          console.log('アラームを作成します')
          chrome.alarms.create('checkExpiredTabs', {
            periodInMinutes: 0.5, // 30秒間隔でテスト
          })
          console.log('アラームが作成されました')
        } catch (error) {
          console.error('アラーム作成エラー:', error)
        }
      }

      // 既存のアラームを確認
      chrome.alarms.get('checkExpiredTabs', alarm => {
        if (alarm) {
          console.log('既存のアラームを検出:', alarm)
          try {
            // 既存のアラームをクリア（必要に応じて）
            chrome.alarms.clear('checkExpiredTabs', wasCleared => {
              console.log('既存のアラームをクリア:', wasCleared)
              createAlarm()
            })
          } catch (error) {
            console.error('アラームクリアエラー:', error)
            // エラーが発生しても続行
            createAlarm()
          }
        } else {
          console.log('既存のアラームはありません')
          createAlarm()
        }
      })

      // アラームリスナーを登録
      chrome.alarms.onAlarm.addListener(alarm => {
        console.log(
          `アラームが発火しました: ${alarm.name} (${new Date().toLocaleString()})`,
        )
        if (alarm.name === 'checkExpiredTabs') {
          checkAndRemoveExpiredTabs()
        }
      })

      // 初回チェックは即時実行
      setTimeout(() => {
        checkAndRemoveExpiredTabs()
      }, 1000)
    } catch (error: unknown) {
      console.error(
        'アラーム設定エラー:',
        error instanceof Error ? error.message : error,
      )

      // エラーが発生しても初回チェックは実行
      setTimeout(() => {
        checkAndRemoveExpiredTabs()
      }, 1000)
    }
  }

  // 期限切れのタブをチェックして削除する関数
  async function checkAndRemoveExpiredTabs() {
    try {
      console.log(
        '期限切れタブのチェックを開始...',
        new Date().toLocaleString(),
      )

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
              console.log(
                `削除: URL ${urlEntry.url} (ドメイン: ${group.domain})`,
              )
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

  // 期限の文字列を対応するミリ秒に変換
  function getExpirationPeriodMs(period: string): number | null {
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
  chrome.action.onClicked.addListener(async () => {
    console.log('拡張機能アイコンがクリックされました')

    try {
      // ユーザー設定を取得
      const settings = await getUserSettings()

      // クリック挙動を取得（デフォルトはウィンドウのタブ保存）
      const clickBehavior = settings.clickBehavior || 'saveWindowTabs'
      console.log(`選択されたクリック挙動: ${clickBehavior}`)

      // 保存したTabsとURLsを追跡するための配列（カスタムプロジェクト同期用）
      let savedUrls: { url: string; title: string }[] = []

      // 選択された挙動に基づいて処理を実行
      switch (clickBehavior) {
        case 'saveCurrentTab': {
          // 現在アクティブなタブのみを保存
          const activeTabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          })

          // タブをフィルタリング（固定タブを除外）
          const filteredTabs = await filterTabsByUserSettings(activeTabs)
          if (filteredTabs.length === 0) {
            console.log(
              '保存対象のタブがありません（全て固定タブか除外パターンに一致）',
            )
            return
          }

          const activeTab = filteredTabs[0]
          console.log(`現在のタブを保存: ${activeTab.url}`)

          // タブを保存
          await saveTabsWithAutoCategory([activeTab])

          // カスタムプロジェクト同期用にURLを記録
          savedUrls = [
            { url: activeTab.url || '', title: activeTab.title || '' },
          ]

          // 通知表示
          try {
            const iconUrl = chrome.runtime.getURL('icon/128.png')
            await chrome.notifications.create({
              type: 'basic',
              iconUrl: iconUrl,
              title: 'タブ保存',
              message: '現在のタブを保存しました',
            })
          } catch (error) {
            console.error('通知表示エラー:', error)
          }

          // タブを閉じる
          if (activeTab.id) {
            try {
              await chrome.tabs.remove(activeTab.id)
              console.log(`タブ ${activeTab.id} を閉じました`)
            } catch (error) {
              console.error('タブを閉じる際にエラー:', error)
            }
          }
          break
        }

        case 'saveSameDomainTabs': {
          // 現在のドメインのタブをすべて保存
          const currentTabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          })
          if (currentTabs.length > 0 && currentTabs[0].url) {
            try {
              // 現在のタブからドメインを取得
              const url = new URL(currentTabs[0].url)
              const currentDomain = url.hostname
              console.log(`現在のドメイン: ${currentDomain}`)

              // 現在のウィンドウの同じドメインのタブをすべて取得
              const tabs = await chrome.tabs.query({ currentWindow: true })
              const sameDomainTabs = tabs.filter(tab => {
                if (!tab.url) return false
                try {
                  const tabUrl = new URL(tab.url)
                  return tabUrl.hostname === currentDomain
                } catch (_e) {
                  return false
                }
              })

              // タブをフィルタリング（固定タブを除外）
              const filteredTabs =
                await filterTabsByUserSettings(sameDomainTabs)
              if (filteredTabs.length === 0) {
                console.log(
                  '保存対象のタブがありません（全て固定タブか除外パターンに一致）',
                )
                return
              }

              console.log(`同じドメインのタブ数: ${filteredTabs.length}`)

              // タブを保存
              await saveTabsWithAutoCategory(filteredTabs)

              // カスタムプロジェクト同期用にURLを記録
              savedUrls = filteredTabs.map(tab => ({
                url: tab.url || '',
                title: tab.title || '',
              }))

              // 通知を表示
              try {
                const iconUrl = chrome.runtime.getURL('icon/128.png')
                await chrome.notifications.create({
                  type: 'basic',
                  iconUrl: iconUrl,
                  title: 'タブ保存',
                  message: `${currentDomain}の${filteredTabs.length}個のタブを保存しました`,
                })
              } catch (error) {
                console.error('通知表示エラー:', error)
              }

              // 保存したタブを閉じる
              for (const tab of filteredTabs) {
                if (
                  tab.id &&
                  !settings.excludePatterns.some(pattern =>
                    tab.url?.includes(pattern),
                  )
                ) {
                  try {
                    await chrome.tabs.remove(tab.id)
                    console.log(`タブ ${tab.id} を閉じました`)
                  } catch (error) {
                    console.error('タブを閉じる際にエラー:', error)
                  }
                }
              }
            } catch (error) {
              console.error('ドメインタブ保存エラー:', error)
            }
          }
          break
        }

        case 'saveAllWindowsTabs': {
          // すべてのウィンドウのタブを保存
          try {
            // すべてのウィンドウのタブを取得
            const allTabs = await chrome.tabs.query({})
            console.log(`取得したすべてのタブ数: ${allTabs.length}`)

            // タブをフィルタリング（固定タブと除外パターンを除外）
            const filteredTabs = await filterTabsByUserSettings(allTabs)
            if (filteredTabs.length === 0) {
              console.log(
                '保存対象のタブがありません（全て固定タブか除外パターンに一致）',
              )
              return
            }

            console.log(`保存対象タブ数: ${filteredTabs.length}`)

            // タブを保存
            await saveTabsWithAutoCategory(filteredTabs)

            // カスタムプロジェクト同期用にURLを記録
            savedUrls = filteredTabs.map(tab => ({
              url: tab.url || '',
              title: tab.title || '',
            }))

            // 通知を表示
            try {
              const iconUrl = chrome.runtime.getURL('icon/128.png')
              await chrome.notifications.create({
                type: 'basic',
                iconUrl: iconUrl,
                title: 'タブ保存',
                message: `すべてのウィンドウから${filteredTabs.length}個のタブを保存しました`,
              })
            } catch (error) {
              console.error('通知表示エラー:', error)
            }

            // saved-tabsページを開く
            const savedTabsTabId = await openSavedTabsPage()

            // タブを閉じる

            for (const tab of filteredTabs) {
              if (tab.id && tab.id !== savedTabsTabId) {
                try {
                  await chrome.tabs.remove(tab.id)
                } catch (error) {
                  console.error(`タブ ${tab.id} を閉じる際にエラー:`, error)
                }
              }
            }
          } catch (error) {
            console.error('すべてのタブ保存エラー:', error)
          }
          break
        }

        default: {
          // 既存の処理: 現在のウィンドウのタブをすべて保存（saveWindowTabsを含む）
          const allTabs = await chrome.tabs.query({ currentWindow: true })
          console.log(`取得したタブ: ${allTabs.length}個`)

          // タブをフィルタリング（固定タブと除外パターンを除外）
          const filteredTabs = await filterTabsByUserSettings(allTabs)
          if (filteredTabs.length === 0) {
            console.log(
              '保存対象のタブがありません（全て固定タブか除外パターンに一致）',
            )
            return
          }

          console.log(`保存対象タブ: ${filteredTabs.length}個`)

          // タブを保存して自動カテゴライズする
          await saveTabsWithAutoCategory(filteredTabs)

          // カスタムプロジェクト同期用にURLを記録
          savedUrls = filteredTabs.map(tab => ({
            url: tab.url || '',
            title: tab.title || '',
          }))

          console.log('タブの保存と自動カテゴライズが完了しました')

          // 保存完了通知を表示
          try {
            const iconUrl = chrome.runtime.getURL('icon/128.png')
            console.log('通知アイコンURL:', iconUrl)

            await chrome.notifications?.create({
              type: 'basic',
              iconUrl: iconUrl,
              title: 'タブ保存',
              message: `${filteredTabs.length}個のタブが保存されました。タブを閉じます。`,
            })
          } catch (notificationError) {
            console.error('通知表示エラー:', notificationError)
          }

          // saved-tabsページを開く
          const savedTabsTabId = await openSavedTabsPage()

          // 閉じるタブを収集
          const tabIdsToClose: number[] = []

          for (const tab of filteredTabs) {
            if (
              tab.id &&
              tab.id !== savedTabsTabId &&
              tab.url &&
              !settings.excludePatterns.some(pattern =>
                tab.url?.includes(pattern),
              )
            ) {
              tabIdsToClose.push(tab.id)
            }
          }

          // タブを閉じる
          if (tabIdsToClose.length > 0) {
            console.log(
              `${tabIdsToClose.length}個のタブを閉じます:`,
              tabIdsToClose,
            )

            for (const tabId of tabIdsToClose) {
              try {
                await chrome.tabs.remove(tabId)
                console.log(`タブID ${tabId} を閉じました`)
              } catch (error: unknown) {
                console.error(
                  `タブID ${tabId} を閉じる際にエラーが発生しました:`,
                  error instanceof Error ? error.message : error,
                )
              }
            }

            console.log('すべてのタブを閉じました')
          } else {
            console.log('閉じるべきタブはありません')
          }
          break
        }
      }

      // カスタムプロジェクトのデフォルトプロジェクトにも同期保存（背景で処理）
      try {
        // カスタムプロジェクトを取得
        const { customProjects = [] } =
          await chrome.storage.local.get('customProjects')

        // プロジェクトが存在しなければデフォルトプロジェクトを作成
        if (customProjects.length === 0) {
          console.log(
            'カスタムプロジェクトが存在しないため、デフォルトプロジェクトを作成します',
          )

          const defaultProject: Project = {
            id: crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).substring(2, 15),
            name: 'デフォルトプロジェクト',
            description: '自動的に作成されたプロジェクト',
            urls: [],
            categories: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }

          // URLsを追加
          for (const item of savedUrls) {
            defaultProject.urls.push({
              url: item.url,
              title: item.title,
              savedAt: Date.now(),
            })
          }

          // 保存
          await chrome.storage.local.set({ customProjects: [defaultProject] })
          console.log('デフォルトプロジェクトを作成し、URLを追加しました')
        } else {
          // 最初のプロジェクトに追加
          const firstProject = customProjects[0] as Project
          console.log(
            `既存プロジェクト「${firstProject.name}」にURLを追加します`,
          )

          // 重複を避けるため既存URLをチェック
          const existingUrls = new Set(
            firstProject.urls.map((u: ProjectUrl) => u.url),
          )

          for (const item of savedUrls) {
            if (!existingUrls.has(item.url)) {
              firstProject.urls.push({
                url: item.url,
                title: item.title,
                savedAt: Date.now(),
              })
            }
          }

          firstProject.updatedAt = Date.now()

          // 保存
          await chrome.storage.local.set({ customProjects })
          console.log(
            `既存プロジェクトにURLを追加しました (合計: ${firstProject.urls.length} URLs)`,
          )
        }
      } catch (syncError) {
        console.error(
          'カスタムプロジェクトへの同期中にエラーが発生しました:',
          syncError,
        )
      }
    } catch (error: unknown) {
      console.error(
        'エラーが発生しました:',
        error instanceof Error ? error.message : error,
      )
    }
  })

  // タブの保存時刻を指定の期間に応じて更新する関数
  async function updateTabTimestamps(period?: string) {
    try {
      console.log(`タブの保存時刻を更新します: ${period || '不明な期間'}`)

      const storageResult = await chrome.storage.local.get('savedTabs')
      const savedTabs: TabGroup[] = storageResult.savedTabs || []
      if (savedTabs.length === 0) {
        console.log('保存されたタブがありません')
        return
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

  // メッセージリスナーを追加
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('バックグラウンドがメッセージを受信:', message)

    // URLのドラッグ開始を処理
    if (message.action === 'urlDragStarted') {
      console.log('ドラッグ開始を検知:', message.url)
      // ドラッグ情報を一時保存
      draggedUrlInfo = {
        url: message.url,
        timestamp: Date.now(),
        processed: false,
      }

      // 10秒後に情報を自動消去（タイムアウト）
      setTimeout(() => {
        if (
          draggedUrlInfo &&
          draggedUrlInfo.timestamp === Date.now() &&
          !draggedUrlInfo.processed
        ) {
          console.log('ドラッグ情報のタイムアウト:', draggedUrlInfo.url)
          draggedUrlInfo = null
        }
      }, 10000)

      sendResponse({ status: 'ok' })
      return true
    }

    // ドラッグ&ドロップ後のURL処理
    if (message.action === 'urlDropped') {
      console.log('URLドロップを検知:', message.url)

      // fromExternal フラグが true の場合のみ処理（外部ドラッグの場合のみ）
      if (message.fromExternal === true) {
        getUserSettings().then(settings => {
          if (settings.removeTabAfterOpen) {
            removeUrlFromStorage(message.url)
              .then(() => {
                console.log('外部ドロップ後にURLを削除しました:', message.url)
                sendResponse({ status: 'removed' })
              })
              .catch(error => {
                console.error('URL削除エラー:', error)
                sendResponse({ status: 'error', error: error.toString() })
              })
          } else {
            console.log('設定により削除をスキップ')
            sendResponse({ status: 'skipped' })
          }
        })
      } else {
        console.log('内部操作のため削除をスキップ')
        sendResponse({ status: 'internal_operation' })
      }
      return true // 非同期応答のため
    }

    // URLをストレージから削除
    if (message.action === 'removeUrlFromStorage') {
      removeUrlFromStorage(message.url)
        .then(() => sendResponse({ status: 'removed' }))
        .catch(error => sendResponse({ status: 'error', error }))
      return true // 非同期応答のため
    }

    // 残り時間計算リクエストの処理
    if (message.action === 'calculateTimeRemaining') {
      const { savedAt, autoDeletePeriod } = message

      if (!autoDeletePeriod || autoDeletePeriod === 'never' || !savedAt) {
        sendResponse({ timeRemaining: null })
        return true
      }

      try {
        const expirationMs = getExpirationPeriodMs(autoDeletePeriod)
        if (!expirationMs) {
          sendResponse({ timeRemaining: null })
          return true
        }

        const now = Date.now()
        const expirationTime = savedAt + expirationMs
        const remainingMs = expirationTime - now

        sendResponse({
          timeRemaining: remainingMs,
          expirationTime,
        })
      } catch (error) {
        console.error('残り時間計算エラー:', error)
        sendResponse({ error: error?.toString() })
      }

      return true // 非同期応答のため
    }

    // 期限切れタブのチェックを即時実行
    if (message.action === 'checkExpiredTabs') {
      console.log('明示的な期限切れチェックリクエストを受信:', message)

      // 設定情報も出力
      chrome.storage.local.get(['userSettings'], data => {
        console.log('現在のストレージ内の設定:', data)
      })

      // updateTimestampsフラグがあり、periodも指定されている場合は時刻を更新
      if (message.updateTimestamps) {
        console.log(`タブの保存時刻を更新します (${message.period || '不明'})`)
        // 処理の簡略化 - まずタイムスタンプを更新し、待機せずにチェック実行
        updateTabTimestamps(message.period)
          .then(_result => {
            console.log('タブの時刻更新完了。チェックを実行します。')

            // 設定を再読み込みし、チェック実行
            checkAndRemoveExpiredTabs()
              .then(() => {
                console.log('期限切れチェック完了')
                sendResponse({ status: 'completed', success: true })
              })
              .catch(error => {
                console.error('チェックエラー:', error)
                sendResponse({ error: String(error) })
              })
          })
          .catch(error => {
            console.error('タイムスタンプ更新エラー:', error)
            sendResponse({ error: String(error) })
          })
      } else {
        // 単純化 - 常に強制リロードする
        checkAndRemoveExpiredTabs()
          .then(() => {
            console.log('期限切れチェック完了')
            sendResponse({ status: 'completed' })
          })
          .catch(error => sendResponse({ error: String(error) }))
      }
      return true
    }

    // 強制的にタブの保存時刻を更新するメッセージ
    if (message.action === 'updateTabTimestamps') {
      console.log('タブの保存時刻を強制的に更新:', message.period)
      updateTabTimestamps(message.period)
        .then(result => {
          sendResponse({ status: 'completed', result })
        })
        .catch(error => {
          console.error('時刻更新エラー:', error)
          sendResponse({ error: String(error) })
        })
      return true
    }

    // 現在のアラーム状態を確認
    if (message.action === 'getAlarmStatus') {
      chrome.alarms.get('checkExpiredTabs', alarm => {
        const status = alarm
          ? { exists: true, scheduledTime: alarm.scheduledTime }
          : { exists: false }
        console.log('アラーム状態:', status)
        sendResponse(status)
      })
      return true
    }
  })

  // 新しいタブが作成されたときの処理
  chrome.tabs.onCreated.addListener(async tab => {
    console.log('新しいタブが作成されました:', tab.url)

    // ドラッグされた情報が存在するか確認
    if (draggedUrlInfo && !draggedUrlInfo.processed) {
      console.log('ドラッグ情報が存在します:', draggedUrlInfo.url)
      console.log('新しいタブのURL:', tab.url)

      // URLを正規化して比較
      const normalizedDraggedUrl = normalizeUrl(draggedUrlInfo.url)
      const normalizedTabUrl = normalizeUrl(tab.url || '')

      console.log('正規化されたドラッグURL:', normalizedDraggedUrl)
      console.log('正規化された新タブURL:', normalizedTabUrl)

      // URLが類似していれば処理
      if (
        normalizedTabUrl &&
        normalizedDraggedUrl &&
        (normalizedTabUrl === normalizedDraggedUrl ||
          normalizedTabUrl.includes(normalizedDraggedUrl) ||
          normalizedDraggedUrl.includes(normalizedTabUrl))
      ) {
        console.log('URLが一致または類似しています')

        try {
          // 処理済みとマーク
          draggedUrlInfo.processed = true

          const settings = await getUserSettings()
          if (settings.removeTabAfterOpen) {
            console.log('設定に基づきURLを削除します:', draggedUrlInfo.url)
            await removeUrlFromStorage(draggedUrlInfo.url)
          } else {
            console.log('設定により削除をスキップします')
          }
        } catch (error) {
          console.error('タブ作成後の処理でエラー:', error)
        } finally {
          // 処理完了後、ドラッグ情報をクリア
          draggedUrlInfo = null
        }
      } else {
        console.log('URLが一致しません。削除をスキップします')
      }
    }
  })

  // URLを正規化する関数（比較のため）
  function normalizeUrl(url: string): string {
    try {
      // 不要なパラメータやフラグメントを取り除く
      return url.trim().toLowerCase().split('#')[0].split('?')[0]
    } catch {
      return url.toLowerCase()
    }
  }

  // URLをストレージから削除する関数（カテゴリ設定とマッピングを保持）
  // TabGroupが空になった時の処理関数
  async function handleTabGroupRemoval(groupId: string) {
    console.log(`空になったグループの処理を開始: ${groupId}`)
    await removeFromParentCategories(groupId)
    console.log(`グループ ${groupId} の処理が完了しました`)
  }

  async function removeUrlFromStorage(url: string) {
    try {
      const storageResult = await chrome.storage.local.get('savedTabs')
      const savedTabs: TabGroup[] = storageResult.savedTabs || []

      // URLを含むグループを更新
      const updatedGroups = savedTabs
        .map((group: TabGroup) => {
          const updatedUrls = group.urls.filter(item => item.url !== url)
          if (updatedUrls.length === 0) {
            // グループが空になる場合は専用の処理関数を呼び出し
            handleTabGroupRemoval(group.id)
            return null // 空グループを削除
          }
          return { ...group, urls: updatedUrls }
        })
        .filter(Boolean)

      // 更新したグループをストレージに保存
      await chrome.storage.local.set({ savedTabs: updatedGroups })
      console.log(`ストレージからURL ${url} を削除しました`)
    } catch (error) {
      console.error('URLの削除中にエラーが発生しました:', error)
      throw error
    }
  }

  // グループを親カテゴリから削除する関数を更新
  async function removeFromParentCategories(groupId: string) {
    try {
      const storageResult = await chrome.storage.local.get('parentCategories')
      const parentCategories: ParentCategory[] =
        storageResult.parentCategories || []

      // 削除対象のドメイン名を取得
      const storageResult2 = await chrome.storage.local.get('savedTabs')
      const savedTabs: TabGroup[] = storageResult2.savedTabs || []
      const groupToRemove = savedTabs.find(
        (group: TabGroup) => group.id === groupId,
      )
      const domainName = groupToRemove?.domain

      if (!groupToRemove || !domainName) {
        console.log(
          `削除対象のグループID ${groupId} が見つからないか、ドメイン名がありません`,
        )
        return
      }

      console.log(
        `カテゴリから削除: グループID ${groupId}, ドメイン ${domainName}`,
      )

      // ドメイン名を保持したままドメインIDのみを削除
      const updatedCategories = parentCategories.map(
        (category: ParentCategory) => {
          // domainNamesは変更せず、domainsからIDのみを削除
          const updated = {
            ...category,
            domains: category.domains.filter((id: string) => id !== groupId),
          }

          // ドメイン名がdomainNamesにあるか確認してログ出力
          if (category.domainNames && Array.isArray(category.domainNames)) {
            if (category.domainNames.includes(domainName)) {
              console.log(
                `ドメイン名 ${domainName} は ${category.name} のdomainNamesに保持されます`,
              )
            }
          }

          return updated
        },
      )

      await chrome.storage.local.set({ parentCategories: updatedCategories })

      // 必要ならドメイン-カテゴリのマッピングを更新（削除しない）
      if (groupToRemove.parentCategoryId) {
        console.log(
          `ドメイン ${domainName} のマッピングを親カテゴリ ${groupToRemove.parentCategoryId} に保持します`,
        )
      }

      console.log(
        `カテゴリからグループID ${groupId} を削除しました（ドメイン名を保持）`,
      )
    } catch (error: unknown) {
      console.error(
        '親カテゴリからの削除中にエラーが発生しました:',
        error instanceof Error ? error.message : error,
      )
    }
  }

  // タブをユーザー設定に基づいてフィルタリングする共通関数を追加
  async function filterTabsByUserSettings(
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
})
