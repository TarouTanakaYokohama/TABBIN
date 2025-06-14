import type { SubCategoryKeyword, TabGroup } from '@/types/storage'
import {
  getDomainCategorySettings,
  saveDomainCategorySettings,
} from './categories'

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

// URLに子カテゴリを設定する関数
export async function setUrlSubCategory(
  groupId: string,
  url: string,
  subCategory: string,
): Promise<void> {
  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

  const updatedGroups = savedTabs.map((group: TabGroup) => {
    if (group.id === groupId) {
      const updatedUrls = group.urls.map(item => {
        if (item.url === url) {
          return {
            ...item,
            subCategory,
          }
        }
        return item
      })

      return {
        ...group,
        urls: updatedUrls,
      }
    }
    return group
  })

  await chrome.storage.local.set({ savedTabs: updatedGroups })
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

// キーワードに基づいて自動的にURLを分類する
export async function autoCategorizeTabs(groupId: string): Promise<void> {
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

  // 各URLに適切なカテゴリを割り当て
  const updatedUrls = targetGroup.urls.map((item: TabGroup['urls'][number]) => {
    // タイトルをもとに適切なカテゴリを探す
    const title = item.title.toLowerCase()

    for (const catKeyword of categoryKeywords) {
      // いずれかのキーワードがタイトルに含まれているか確認
      const matchesKeyword = catKeyword.keywords.some((keyword: string) =>
        title.includes(keyword.toLowerCase()),
      )

      if (matchesKeyword) {
        return {
          ...item,
          subCategory: catKeyword.categoryName,
        }
      }
    }

    return item // マッチするキーワードがなければそのまま
  })

  // 更新されたURLを保存
  const updatedGroups = uniqueGroups.map((group: TabGroup) => {
    if (group.id === groupId) {
      return {
        ...group,
        urls: updatedUrls,
      }
    }
    return group
  })

  await chrome.storage.local.set({ savedTabs: updatedGroups })
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
