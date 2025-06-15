/**
 * URL・ストレージ操作モジュール
 */

import { getUserSettings } from '@/lib/storage'
import type {
  DraggedUrlInfo,
  ParentCategory,
  TabGroup,
} from '@/types/background'

// ドラッグされたURL情報を一時保存するためのストア
let draggedUrlInfo: DraggedUrlInfo | null = null

/**
 * ドラッグ情報を設定
 */
export function setDraggedUrlInfo(info: DraggedUrlInfo): void {
  draggedUrlInfo = info
}

/**
 * ドラッグ情報を取得
 */
export function getDraggedUrlInfo(): DraggedUrlInfo | null {
  return draggedUrlInfo
}

/**
 * ドラッグ情報をクリア
 */
export function clearDraggedUrlInfo(): void {
  draggedUrlInfo = null
}

/**
 * URLを正規化する関数（比較のため）
 */
export function normalizeUrl(url: string): string {
  try {
    // 不要なパラメータやフラグメントを取り除く
    return url.trim().toLowerCase().split('#')[0].split('?')[0]
  } catch {
    return url.toLowerCase()
  }
}

/**
 * URLをストレージから削除する関数（カテゴリ設定とマッピングを保持）
 */
export async function removeUrlFromStorage(url: string): Promise<void> {
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

/**
 * TabGroupが空になった時の処理関数
 */
async function handleTabGroupRemoval(groupId: string): Promise<void> {
  console.log(`空になったグループの処理を開始: ${groupId}`)
  await removeFromParentCategories(groupId)
  console.log(`グループ ${groupId} の処理が完了しました`)
}

/**
 * グループを親カテゴリから削除する関数を更新
 */
async function removeFromParentCategories(groupId: string): Promise<void> {
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

/**
 * ドラッグ開始処理
 */
export function handleUrlDragStarted(url: string): void {
  console.log('ドラッグ開始を検知:', url)

  // ドラッグ情報を一時保存
  draggedUrlInfo = {
    url: url,
    timestamp: Date.now(),
    processed: false,
  }

  // ドラッグ情報の自動タイムアウト（10秒）
  const dragTimeout = setTimeout(() => {
    if (draggedUrlInfo && !draggedUrlInfo.processed) {
      console.log('ドラッグ情報のタイムアウト:', draggedUrlInfo.url)
      draggedUrlInfo = null
    }
  }, 10000)

  // タイムアウトIDを保存しておくことで、必要に応じてキャンセル可能
  if (draggedUrlInfo) {
    draggedUrlInfo.timeoutId = dragTimeout
  }
}

/**
 * ドラッグドロップ処理
 */
export async function handleUrlDropped(
  url: string,
  fromExternal?: boolean,
): Promise<string> {
  console.log('URLドロップを検知:', url)

  // fromExternal フラグが true の場合のみ処理（外部ドラッグの場合のみ）
  if (fromExternal === true) {
    try {
      const settings = await getUserSettings()
      if (settings.removeTabAfterOpen) {
        await removeUrlFromStorage(url)
        console.log('外部ドロップ後にURLを削除しました:', url)
        return 'removed'
      }
      console.log('設定により削除をスキップ')
      return 'skipped'
    } catch (error) {
      console.error('URL削除エラー:', error)
      throw error
    }
  }

  console.log('内部操作のため削除をスキップ')
  return 'internal_operation'
}

/**
 * 新しいタブ作成時の処理
 */
export async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
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
}
