/**
 * 拡張機能アクション管理モジュール
 */

import { getUserSettings, saveTabsWithAutoCategory } from '@/lib/storage'
import {
  addUrlToCustomProject,
  createCustomProject,
  getCustomProjects,
} from '@/lib/storage'
import { openSavedTabsPage } from './saved-tabs-page'
import { filterTabsByUserSettings, showNotification } from './utils'

/**
 * ブラウザアクション（拡張機能アイコン）クリック時の処理
 */
export async function handleExtensionActionClick(): Promise<void> {
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
      case 'saveCurrentTab':
        savedUrls = await handleSaveCurrentTab()
        break
      case 'saveSameDomainTabs':
        savedUrls = await handleSaveSameDomainTabs()
        break
      case 'saveAllWindowsTabs':
        savedUrls = await handleSaveAllWindowsTabs()
        break
      default:
        // 既存の処理: 現在のウィンドウのタブをすべて保存（saveWindowTabsを含む）
        savedUrls = await handleSaveWindowTabs()
        break
    }

    // カスタムプロジェクトのデフォルトプロジェクトにも同期保存（背景で処理）
    await syncToCustomProjects(savedUrls)
  } catch (error: unknown) {
    console.error(
      'エラーが発生しました:',
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * 現在のタブのみを保存
 */
export async function handleSaveCurrentTab(): Promise<
  { url: string; title: string }[]
> {
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
    return []
  }

  const activeTab = filteredTabs[0]
  console.log(`現在のタブを保存: ${activeTab.url}`)

  // タブを保存
  await saveTabsWithAutoCategory([activeTab])

  // 通知表示
  await showNotification('タブ保存', '現在のタブを保存しました')

  // タブを閉じる
  if (activeTab.id) {
    try {
      await chrome.tabs.remove(activeTab.id)
      console.log(`タブ ${activeTab.id} を閉じました`)
    } catch (error) {
      console.error('タブを閉じる際にエラー:', error)
    }
  }

  return [{ url: activeTab.url || '', title: activeTab.title || '' }]
}

/**
 * 現在のドメインのタブをすべて保存
 */
export async function handleSaveSameDomainTabs(): Promise<
  { url: string; title: string }[]
> {
  const currentTabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })

  if (currentTabs.length === 0 || !currentTabs[0].url) {
    return []
  }

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
    const filteredTabs = await filterTabsByUserSettings(sameDomainTabs)
    if (filteredTabs.length === 0) {
      console.log(
        '保存対象のタブがありません（全て固定タブか除外パターンに一致）',
      )
      return []
    }

    console.log(`同じドメインのタブ数: ${filteredTabs.length}`)

    // タブを保存
    await saveTabsWithAutoCategory(filteredTabs)

    // 通知を表示
    await showNotification(
      'タブ保存',
      `${currentDomain}の${filteredTabs.length}個のタブを保存しました`,
    )

    const settings = await getUserSettings()

    // 保存したタブを閉じる
    for (const tab of filteredTabs) {
      if (
        tab.id &&
        !settings.excludePatterns.some(pattern => tab.url?.includes(pattern))
      ) {
        try {
          await chrome.tabs.remove(tab.id)
          console.log(`タブ ${tab.id} を閉じました`)
        } catch (error) {
          console.error('タブを閉じる際にエラー:', error)
        }
      }
    }

    return filteredTabs.map(tab => ({
      url: tab.url || '',
      title: tab.title || '',
    }))
  } catch (error) {
    console.error('ドメインタブ保存エラー:', error)
    return []
  }
}

/**
 * すべてのウィンドウのタブを保存
 */
export async function handleSaveAllWindowsTabs(): Promise<
  { url: string; title: string }[]
> {
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
      return []
    }

    console.log(`保存対象タブ数: ${filteredTabs.length}`)

    // タブを保存
    await saveTabsWithAutoCategory(filteredTabs)

    // 通知を表示
    await showNotification(
      'タブ保存',
      `すべてのウィンドウから${filteredTabs.length}個のタブを保存しました`,
    )

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

    return filteredTabs.map(tab => ({
      url: tab.url || '',
      title: tab.title || '',
    }))
  } catch (error) {
    console.error('すべてのタブ保存エラー:', error)
    return []
  }
}

/**
 * 現在のウィンドウのタブをすべて保存（デフォルト）
 */
export async function handleSaveWindowTabs(): Promise<
  { url: string; title: string }[]
> {
  const allTabs = await chrome.tabs.query({ currentWindow: true })
  console.log(`取得したタブ: ${allTabs.length}個`)

  // タブをフィルタリング（固定タブと除外パターンを除外）
  const filteredTabs = await filterTabsByUserSettings(allTabs)
  if (filteredTabs.length === 0) {
    console.log(
      '保存対象のタブがありません（全て固定タブか除外パターンに一致）',
    )
    return []
  }

  console.log(`保存対象タブ: ${filteredTabs.length}個`)

  // タブを保存して自動カテゴライズする
  await saveTabsWithAutoCategory(filteredTabs)

  console.log('タブの保存と自動カテゴライズが完了しました')

  // 保存完了通知を表示
  await showNotification(
    'タブ保存',
    `${filteredTabs.length}個のタブが保存されました。タブを閉じます。`,
  )

  // saved-tabsページを開く
  const savedTabsTabId = await openSavedTabsPage()

  // 閉じるタブを収集
  const settings = await getUserSettings()
  const tabIdsToClose: number[] = []

  for (const tab of filteredTabs) {
    if (
      tab.id &&
      tab.id !== savedTabsTabId &&
      tab.url &&
      !settings.excludePatterns.some(pattern => tab.url?.includes(pattern))
    ) {
      tabIdsToClose.push(tab.id)
    }
  }

  // タブを閉じる
  if (tabIdsToClose.length > 0) {
    console.log(`${tabIdsToClose.length}個のタブを閉じます:`, tabIdsToClose)

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

  return filteredTabs.map(tab => ({
    url: tab.url || '',
    title: tab.title || '',
  }))
}

/**
 * カスタムプロジェクトに同期保存（新形式対応）
 */
export async function syncToCustomProjects(
  savedUrls: { url: string; title: string }[],
): Promise<void> {
  try {
    // 新形式でカスタムプロジェクトを取得
    const customProjects = await getCustomProjects()

    // プロジェクトが存在しなければデフォルトプロジェクトを作成
    if (customProjects.length === 0) {
      console.log(
        'カスタムプロジェクトが存在しないため、デフォルトプロジェクトを作成します',
      )

      // 新形式でデフォルトプロジェクトを作成
      const defaultProject = await createCustomProject(
        'デフォルトプロジェクト',
        '自動的に作成されたプロジェクト',
      )

      // URLsを新形式で追加
      for (const item of savedUrls) {
        await addUrlToCustomProject(defaultProject.id, item.url, item.title)
      }

      console.log('デフォルトプロジェクトを作成し、URLを追加しました')
    } else {
      // 最初のプロジェクトに追加
      const firstProject = customProjects[0]
      console.log(`既存プロジェクト「${firstProject.name}」にURLを追加します`)

      // 新形式でURLを追加（重複チェックは addUrlToCustomProject 内で実行）
      for (const item of savedUrls) {
        await addUrlToCustomProject(firstProject.id, item.url, item.title)
      }

      console.log('既存プロジェクトにURLを追加しました')
    }
  } catch (syncError) {
    console.error(
      'カスタムプロジェクトへの同期中にエラーが発生しました:',
      syncError,
    )
  }
}
