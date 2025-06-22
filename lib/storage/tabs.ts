import type { SubCategoryKeyword, TabGroup, UrlRecord } from '@/types/storage'
import {
  getDomainCategorySettings,
  saveDomainCategorySettings,
} from './categories'
import { migrateToUrlsStorage } from './migration'
import { createOrUpdateUrlRecord, getUrlRecordsByIds } from './urls'

/**
 * TabGroupからURLデータを取得する（新旧形式対応）
 */
export async function getTabGroupUrls(
  tabGroup: TabGroup,
): Promise<Array<UrlRecord & { subCategory?: string }>> {
  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()

  // 新形式のみサポート: URLIDsから参照して取得
  if (tabGroup.urlIds && tabGroup.urlIds.length > 0) {
    const urlRecords = await getUrlRecordsByIds(tabGroup.urlIds)
    return urlRecords.map(record => ({
      ...record,
      subCategory: tabGroup.urlSubCategories?.[record.id],
    }))
  }

  return []
}

/**
 * TabGroupにURLを追加する（新形式対応）
 */
export async function addUrlToTabGroup(
  groupId: string,
  url: string,
  title: string,
  subCategory?: string,
): Promise<void> {
  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()

  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
  const groupIndex = savedTabs.findIndex((g: TabGroup) => g.id === groupId)

  if (groupIndex === -1) return

  // URLレコードを作成または更新
  const urlRecord = await createOrUpdateUrlRecord(url, title)

  const group = savedTabs[groupIndex]

  // URLIDsが存在しない場合は初期化
  if (!group.urlIds) {
    group.urlIds = []
  }

  // 既にURLが含まれているかチェック
  if (!group.urlIds.includes(urlRecord.id)) {
    group.urlIds.push(urlRecord.id)
  }

  // サブカテゴリが指定されている場合は設定
  if (subCategory) {
    if (!group.urlSubCategories) {
      group.urlSubCategories = {}
    }
    group.urlSubCategories[urlRecord.id] = subCategory
  }

  savedTabs[groupIndex] = group
  await chrome.storage.local.set({ savedTabs })
}

// 子カテゴリを追加する関数（永続設定にも保存）
export async function addSubCategoryToGroup(
  groupId: string,
  subCategoryName: string,
): Promise<void> {
  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

  const group = savedTabs.find((g: TabGroup) => g.id === groupId)
  if (!group) return

  const updatedGroups = savedTabs.map((existingGroup: TabGroup) => {
    if (existingGroup.id === groupId) {
      const subCategories = existingGroup.subCategories || []
      if (!subCategories.includes(subCategoryName)) {
        return {
          ...existingGroup,
          subCategories: [...subCategories, subCategoryName],
        }
      }
    }
    return existingGroup
  })

  // タブグループの更新
  await chrome.storage.local.set({ savedTabs: updatedGroups })

  // ドメイン別設定にも保存して永続化
  if (group) {
    const settings = await getDomainCategorySettings()
    const existingSetting = settings.find(s => s.domain === group.domain)

    if (existingSetting) {
      // 既存の設定がある場合は更新
      if (!existingSetting.subCategories.includes(subCategoryName)) {
        existingSetting.subCategories.push(subCategoryName)
        await saveDomainCategorySettings(settings)
      }
    } else {
      // 新しい設定を作成
      settings.push({
        domain: group.domain,
        subCategories: [subCategoryName],
        categoryKeywords: [],
      })
      await saveDomainCategorySettings(settings)
    }
  }
}

// URLに子カテゴリを設定する関数（新形式対応）
export async function setUrlSubCategory(
  groupId: string,
  url: string,
  subCategory: string,
): Promise<void> {
  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()

  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
  const groupIndex = savedTabs.findIndex((g: TabGroup) => g.id === groupId)

  if (groupIndex === -1) return

  const group = savedTabs[groupIndex]

  // 新形式のみサポート: URLIDsからURLレコードを探してサブカテゴリを設定
  if (group.urlIds && group.urlIds.length > 0) {
    const urlRecords = await getUrlRecordsByIds(group.urlIds)
    const urlRecord = urlRecords.find(record => record.url === url)

    if (urlRecord) {
      if (!group.urlSubCategories) {
        group.urlSubCategories = {}
      }
      group.urlSubCategories[urlRecord.id] = subCategory

      savedTabs[groupIndex] = group
      await chrome.storage.local.set({ savedTabs })
    }
  }
}

// 子カテゴリにキーワードを設定する関数（永続設定にも保存）
export async function setCategoryKeywords(
  groupId: string,
  categoryName: string,
  keywords: string[],
): Promise<void> {
  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

  const group = savedTabs.find((g: TabGroup) => g.id === groupId)
  if (!group) return

  // 更新するグループを見つける
  const updatedGroups = savedTabs.map((currentGroup: TabGroup) => {
    if (currentGroup.id === groupId) {
      // 既存のカテゴリキーワード設定を取得
      const categoryKeywords = currentGroup.categoryKeywords || []

      // 対象カテゴリのインデックスを探す
      const categoryIndex = categoryKeywords.findIndex(
        (ck: SubCategoryKeyword) => ck.categoryName === categoryName,
      )

      const updatedCategoryKeywords = [...categoryKeywords]

      if (categoryIndex >= 0) {
        // 既存カテゴリの更新
        updatedCategoryKeywords[categoryIndex] = {
          ...updatedCategoryKeywords[categoryIndex],
          keywords,
        }
      } else {
        // 新規カテゴリの追加
        updatedCategoryKeywords.push({ categoryName, keywords })
      }

      // グループを更新（URLsはそのまま保持）
      return {
        ...currentGroup,
        categoryKeywords: updatedCategoryKeywords,
      }
    }
    return currentGroup // 対象外のグループはそのまま返す
  })

  // タブグループの更新
  await chrome.storage.local.set({ savedTabs: updatedGroups })

  // ドメイン別設定にも保存して永続化
  if (group) {
    const settings = await getDomainCategorySettings()
    const existingSetting = settings.find(s => s.domain === group.domain)

    if (existingSetting) {
      // 既存の設定がある場合は更新
      const keywordIndex = existingSetting.categoryKeywords.findIndex(
        ck => ck.categoryName === categoryName,
      )

      if (keywordIndex >= 0) {
        // 既存のキーワード設定を更新
        existingSetting.categoryKeywords[keywordIndex].keywords = keywords
      } else {
        // 新しいキーワード設定を追加
        existingSetting.categoryKeywords.push({
          categoryName,
          keywords,
        })
      }

      await saveDomainCategorySettings(settings)
    } else {
      // 新しい設定を作成
      settings.push({
        domain: group.domain,
        subCategories: group.subCategories || [],
        categoryKeywords: [{ categoryName, keywords }],
      })
      await saveDomainCategorySettings(settings)
    }
  }

  // キーワードが更新されたら、既存の全タブに対して自動的に再カテゴライズを実行
  await autoCategorizeTabs(groupId)
}

// キーワードに基づいて自動的にURLを分類する（新形式対応）
export async function autoCategorizeTabs(groupId: string): Promise<void> {
  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()

  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

  // 重複チェックを追加
  const uniqueIds = new Set<string>()
  const uniqueGroups: TabGroup[] = []

  for (const group of savedTabs) {
    if (!uniqueIds.has(group.id)) {
      uniqueIds.add(group.id)
      uniqueGroups.push(group)
    } else {
      console.warn(
        `自動カテゴリ実行前に重複検出: ${group.id} (${group.domain})`,
      )
    }
  }

  // 重複があれば修正
  if (uniqueGroups.length < savedTabs.length) {
    console.log(
      `カテゴリ処理前に重複を修正: ${savedTabs.length} → ${uniqueGroups.length}`,
    )
  }

  const targetGroup = uniqueGroups.find(
    (group: TabGroup) => group.id === groupId,
  )
  if (
    !targetGroup ||
    !targetGroup.categoryKeywords ||
    targetGroup.categoryKeywords.length === 0
  ) {
    console.log('カテゴリキーワードがないか、グループが見つかりません')
    return // カテゴリキーワードがない場合は何もしない
  }

  // この時点でtargetGroup.categoryKeywordsは必ず存在する
  const categoryKeywords = targetGroup.categoryKeywords

  // 新形式のみサポート: URLIDsからURLレコードを取得して分類
  if (targetGroup.urlIds && targetGroup.urlIds.length > 0) {
    const urlRecords = await getUrlRecordsByIds(targetGroup.urlIds)
    const updatedSubCategories: Record<string, string> = {
      ...targetGroup.urlSubCategories,
    }

    for (const urlRecord of urlRecords) {
      const title = urlRecord.title.toLowerCase()

      for (const catKeyword of categoryKeywords) {
        // いずれかのキーワードがタイトルに含まれているか確認
        const matchesKeyword = catKeyword.keywords.some((keyword: string) =>
          title.includes(keyword.toLowerCase()),
        )

        if (matchesKeyword) {
          updatedSubCategories[urlRecord.id] = catKeyword.categoryName
          break // 最初にマッチしたカテゴリを採用
        }
      }
    }

    // 更新されたサブカテゴリ情報を保存
    const groupIndex = uniqueGroups.findIndex(g => g.id === groupId)
    if (groupIndex >= 0) {
      uniqueGroups[groupIndex].urlSubCategories = updatedSubCategories
    }
  }

  await chrome.storage.local.set({ savedTabs: uniqueGroups })
}

// 新しい子カテゴリを追加時、キーワード設定も初期化する拡張版関数
export async function addSubCategoryWithKeywords(
  groupId: string,
  subCategoryName: string,
  keywords: string[] = [],
): Promise<void> {
  // 既存の子カテゴリ追加処理
  await addSubCategoryToGroup(groupId, subCategoryName)

  // キーワードがあれば設定
  if (keywords.length > 0) {
    await setCategoryKeywords(groupId, subCategoryName, keywords)
  }
}

// 既存の設定を新しいタブグループに復元する関数
export async function restoreCategorySettings(
  tabGroup: TabGroup,
): Promise<TabGroup> {
  const settings = await getDomainCategorySettings()
  const domainSettings = settings.find(s => s.domain === tabGroup.domain)

  if (domainSettings) {
    return {
      ...tabGroup,
      subCategories: domainSettings.subCategories,
      categoryKeywords: domainSettings.categoryKeywords,
    }
  }

  return tabGroup
}

/**
 * TabGroup内のURLの順序を並び替える（新形式対応）
 */
export async function reorderTabGroupUrls(
  groupId: string,
  newUrlOrder: string[], // URL文字列の配列
): Promise<void> {
  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()

  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
  const groupIndex = savedTabs.findIndex((g: TabGroup) => g.id === groupId)

  if (groupIndex === -1) return

  const group = savedTabs[groupIndex]

  // 新形式のみサポート: URLIDsから現在のURLレコードを取得
  if (group.urlIds && group.urlIds.length > 0) {
    const urlRecords = await getUrlRecordsByIds(group.urlIds)

    // 新しい順序に基づいてURLIDsを並び替え
    const reorderedUrlIds: string[] = []

    for (const url of newUrlOrder) {
      const urlRecord = urlRecords.find(record => record.url === url)
      if (urlRecord && group.urlIds.includes(urlRecord.id)) {
        reorderedUrlIds.push(urlRecord.id)
      }
    }

    // 新しい順序に含まれていないURLIDsを末尾に追加
    for (const urlId of group.urlIds) {
      if (!reorderedUrlIds.includes(urlId)) {
        reorderedUrlIds.push(urlId)
      }
    }

    // 並び替えたURLIDsを保存
    group.urlIds = reorderedUrlIds
    savedTabs[groupIndex] = group
    await chrome.storage.local.set({ savedTabs })

    console.log(
      `グループ ${groupId} のURL順序を並び替えました:`,
      reorderedUrlIds,
    )
  }
}

/**
 * TabGroupからURLを削除する（新形式対応）
 */
export async function removeUrlFromTabGroup(
  groupId: string,
  url: string,
): Promise<void> {
  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()

  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
  const groupIndex = savedTabs.findIndex((g: TabGroup) => g.id === groupId)

  if (groupIndex === -1) return

  const group = savedTabs[groupIndex]

  // 新形式のみサポート: URLIDsからURLを削除
  if (group.urlIds && group.urlIds.length > 0) {
    const urlRecords = await getUrlRecordsByIds(group.urlIds)
    const urlRecord = urlRecords.find(record => record.url === url)

    if (urlRecord) {
      // URLIDsから削除
      group.urlIds = group.urlIds.filter((id: string) => id !== urlRecord.id)

      // サブカテゴリ情報も削除
      if (group.urlSubCategories?.[urlRecord.id]) {
        delete group.urlSubCategories[urlRecord.id]
      }

      // グループにURLが無くなった場合はグループ自体を削除
      if (group.urlIds.length === 0) {
        savedTabs.splice(groupIndex, 1)
        console.log(
          `グループ ${groupId} のURLがなくなったため、グループを削除しました`,
        )
      } else {
        savedTabs[groupIndex] = group
      }

      await chrome.storage.local.set({ savedTabs })
      console.log(`URL ${url} をグループ ${groupId} から削除しました`)
    }
  }
}
