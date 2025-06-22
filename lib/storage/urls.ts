import type { UrlRecord } from '@/types/storage'
import { v4 as uuidv4 } from 'uuid'

/**
 * すべてのURLレコードを取得する
 */
export async function getUrlRecords(): Promise<UrlRecord[]> {
  try {
    const { urls = [] } = await chrome.storage.local.get('urls')
    return urls as UrlRecord[]
  } catch (error) {
    console.error('URLレコード取得エラー:', error)
    return []
  }
}

/**
 * URLレコードを保存する
 */
export async function saveUrlRecords(urlRecords: UrlRecord[]): Promise<void> {
  try {
    await chrome.storage.local.set({ urls: urlRecords })
    console.log(`${urlRecords.length}個のURLレコードを保存しました`)
  } catch (error) {
    console.error('URLレコード保存エラー:', error)
    throw error
  }
}

/**
 * 指定されたIDのURLレコードを取得する
 */
export async function getUrlRecordById(id: string): Promise<UrlRecord | null> {
  const urlRecords = await getUrlRecords()
  return urlRecords.find(record => record.id === id) || null
}

/**
 * 複数のIDからURLレコードを取得する
 */
export async function getUrlRecordsByIds(ids: string[]): Promise<UrlRecord[]> {
  const urlRecords = await getUrlRecords()
  const recordMap = new Map(urlRecords.map(record => [record.id, record]))
  return ids.map(id => recordMap.get(id)).filter(Boolean) as UrlRecord[]
}

/**
 * URLからURLレコードを検索する
 */
export async function findUrlRecordByUrl(
  url: string,
): Promise<UrlRecord | null> {
  const urlRecords = await getUrlRecords()
  return urlRecords.find(record => record.url === url) || null
}

/**
 * 新しいURLレコードを作成または既存のものを更新する
 */
export async function createOrUpdateUrlRecord(
  url: string,
  title: string,
  favIconUrl?: string,
): Promise<UrlRecord> {
  const urlRecords = await getUrlRecords()

  // 既存のURLレコードを検索
  const existingRecord = urlRecords.find(record => record.url === url)

  if (existingRecord) {
    // 既存のレコードを更新
    const updatedRecord: UrlRecord = {
      ...existingRecord,
      title,
      favIconUrl,
      savedAt: Date.now(), // 更新時刻を記録
    }

    const updatedRecords = urlRecords.map(record =>
      record.id === existingRecord.id ? updatedRecord : record,
    )

    await saveUrlRecords(updatedRecords)
    return updatedRecord
  }
  // 新しいレコードを作成
  const newRecord: UrlRecord = {
    id: uuidv4(),
    url,
    title,
    favIconUrl,
    savedAt: Date.now(),
  }

  await saveUrlRecords([...urlRecords, newRecord])
  return newRecord
}

/**
 * URLレコードを削除する（参照されていない場合のみ）
 */
export async function deleteUrlRecord(id: string): Promise<boolean> {
  // 参照チェック（SavedTabsとCustomProjectsで使用されていないか確認）
  const isReferenced = await isUrlRecordReferenced(id)

  if (isReferenced) {
    console.log(`URLレコード ${id} は他の場所で参照されているため削除しません`)
    return false
  }

  const urlRecords = await getUrlRecords()
  const filteredRecords = urlRecords.filter(record => record.id !== id)

  if (filteredRecords.length < urlRecords.length) {
    await saveUrlRecords(filteredRecords)
    console.log(`URLレコード ${id} を削除しました`)
    return true
  }

  return false
}

/**
 * URLレコードが他の場所で参照されているかチェックする
 */
export async function isUrlRecordReferenced(urlId: string): Promise<boolean> {
  try {
    // SavedTabsで参照されているかチェック
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
    for (const tabGroup of savedTabs) {
      if (tabGroup.urlIds?.includes(urlId)) {
        return true
      }
    }

    // CustomProjectsで参照されているかチェック
    const { customProjects = [] } =
      await chrome.storage.local.get('customProjects')
    for (const project of customProjects) {
      if (project.urlIds?.includes(urlId)) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('URL参照チェック中にエラー:', error)
    return true // エラー時は安全のため参照されているとみなす
  }
}

/**
 * 使用されていないURLレコードをクリーンアップする
 */
export async function cleanupUnreferencedUrls(): Promise<number> {
  try {
    const urlRecords = await getUrlRecords()
    const referencedIds = new Set<string>()

    // SavedTabsから参照されているURLIDを収集
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
    for (const tabGroup of savedTabs) {
      if (tabGroup.urlIds) {
        for (const id of tabGroup.urlIds) {
          referencedIds.add(id)
        }
      }
    }

    // CustomProjectsから参照されているURLIDを収集
    const { customProjects = [] } =
      await chrome.storage.local.get('customProjects')
    for (const project of customProjects) {
      if (project.urlIds) {
        for (const id of project.urlIds) {
          referencedIds.add(id)
        }
      }
    }

    // 未参照のURLレコードをフィルタリング
    const referencedRecords = urlRecords.filter(record =>
      referencedIds.has(record.id),
    )

    const deletedCount = urlRecords.length - referencedRecords.length

    if (deletedCount > 0) {
      await saveUrlRecords(referencedRecords)
      console.log(
        `${deletedCount}個の未参照URLレコードをクリーンアップしました`,
      )
    }

    return deletedCount
  } catch (error) {
    console.error('URLクリーンアップ中にエラー:', error)
    return 0
  }
}

/**
 * 重複するURLレコードを統合する
 */
export async function deduplicateUrlRecords(): Promise<number> {
  try {
    const urlRecords = await getUrlRecords()
    const urlMap = new Map<string, UrlRecord>()
    const duplicateIds: string[] = []

    // URLをキーとして重複をチェック
    for (const record of urlRecords) {
      const existingRecord = urlMap.get(record.url)

      if (existingRecord) {
        // 重複が見つかった場合、より新しいレコードを保持
        if (record.savedAt > existingRecord.savedAt) {
          duplicateIds.push(existingRecord.id)
          urlMap.set(record.url, record)
        } else {
          duplicateIds.push(record.id)
        }
      } else {
        urlMap.set(record.url, record)
      }
    }

    if (duplicateIds.length > 0) {
      // 重複IDの参照を更新
      await updateUrlReferences(duplicateIds, urlMap)

      // 重複レコードを削除
      const deduplicatedRecords = Array.from(urlMap.values())
      await saveUrlRecords(deduplicatedRecords)

      console.log(`${duplicateIds.length}個の重複URLレコードを統合しました`)
    }

    return duplicateIds.length
  } catch (error) {
    console.error('URL重複統合中にエラー:', error)
    return 0
  }
}

/**
 * URLの参照を更新する（重複統合時に使用）
 */
async function updateUrlReferences(
  duplicateIds: string[],
  urlMap: Map<string, UrlRecord>,
): Promise<void> {
  try {
    // SavedTabsの参照を更新
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
    let tabsUpdated = false

    for (const tabGroup of savedTabs) {
      if (tabGroup.urlIds) {
        const updatedIds = tabGroup.urlIds.map((id: string) => {
          if (duplicateIds.includes(id)) {
            // 重複IDを正しいIDに置き換え
            const urlRecord = Array.from(urlMap.values()).find(r => r.id === id)
            if (urlRecord) {
              const correctRecord = urlMap.get(urlRecord.url)
              return correctRecord?.id || id
            }
          }
          return id
        })

        if (JSON.stringify(updatedIds) !== JSON.stringify(tabGroup.urlIds)) {
          tabGroup.urlIds = updatedIds
          tabsUpdated = true
        }
      }
    }

    if (tabsUpdated) {
      await chrome.storage.local.set({ savedTabs })
    }

    // CustomProjectsの参照を更新
    const { customProjects = [] } =
      await chrome.storage.local.get('customProjects')
    let projectsUpdated = false

    for (const project of customProjects) {
      if (project.urlIds) {
        const updatedIds = project.urlIds.map((id: string) => {
          if (duplicateIds.includes(id)) {
            // 重複IDを正しいIDに置き換え
            const urlRecord = Array.from(urlMap.values()).find(r => r.id === id)
            if (urlRecord) {
              const correctRecord = urlMap.get(urlRecord.url)
              return correctRecord?.id || id
            }
          }
          return id
        })

        if (JSON.stringify(updatedIds) !== JSON.stringify(project.urlIds)) {
          project.urlIds = updatedIds
          projectsUpdated = true
        }
      }
    }

    if (projectsUpdated) {
      await chrome.storage.local.set({ customProjects })
    }
  } catch (error) {
    console.error('URL参照更新中にエラー:', error)
  }
}
