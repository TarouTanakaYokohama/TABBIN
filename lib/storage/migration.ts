import type {
  DomainParentCategoryMapping,
  ParentCategory,
  TabGroup,
} from '@/types/storage'
import { v4 as uuidv4 } from 'uuid'
import {
  getDomainCategoryMappings,
  getParentCategories,
  saveParentCategories,
  updateDomainCategoryMapping,
} from './categories'
import { autoCategorizeTabs, restoreCategorySettings } from './tabs'

// ドメインを親カテゴリに割り当てる関数
export async function assignDomainToCategory(
  domainId: string,
  categoryId: string,
): Promise<void> {
  const categories = await getParentCategories()
  const tabGroup = await getTabGroupById(domainId)

  // ドメイン-カテゴリのマッピングも更新
  if (tabGroup) {
    // カテゴリが"none"でなければマッピングを更新
    if (categoryId !== 'none') {
      await updateDomainCategoryMapping(tabGroup.domain, categoryId)
    } else {
      // "none"の場合はマッピングを削除
      await updateDomainCategoryMapping(tabGroup.domain, null)
    }
  }

  const updatedCategories = categories.map((category: ParentCategory) => {
    if (category.id === categoryId) {
      // すでに含まれていなければ追加
      if (!category.domains.includes(domainId)) {
        return {
          ...category,
          domains: [...category.domains, domainId],
          domainNames: category.domainNames?.includes(tabGroup?.domain ?? '')
            ? category.domainNames
            : [...(category.domainNames || []), tabGroup?.domain ?? ''],
        }
      }
    } else {
      // 他のカテゴリからは削除（重複を避けるため）
      return {
        ...category,
        domains: category.domains.filter(id => id !== domainId),
        domainNames: (category.domainNames || []).filter(domain =>
          tabGroup ? domain !== tabGroup.domain : true,
        ),
      }
    }
    return category
  })

  await saveParentCategories(updatedCategories)
}

// 既存のデータを更新し、domainNamesプロパティを追加する移行関数
export async function migrateParentCategoriesToDomainNames(): Promise<void> {
  try {
    console.log('親カテゴリのdomainNames移行を緊急実行します')
    const categories = await getParentCategories()
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
    const { domainCategoryMappings = [] } = await chrome.storage.local.get(
      'domainCategoryMappings',
    )

    console.log('現在の親カテゴリ:', categories)
    console.log('現在のタブグループ数:', savedTabs.length)
    console.log('現在のドメインマッピング数:', domainCategoryMappings.length)

    // 各カテゴリの状態をログ出力
    for (const category of categories) {
      console.log(`カテゴリ「${category.name}」の状態:`, {
        id: category.id,
        domains: category.domains,
        domainNames: category.domainNames || [],
      })

      // マッピングから検索
      const mappingsForCategory = domainCategoryMappings.filter(
        (m: DomainParentCategoryMapping) => m.categoryId === category.id,
      )
      console.log(
        `  マッピングから見つかったドメイン: ${mappingsForCategory
          .map((m: DomainParentCategoryMapping) => m.domain)
          .join(', ')}`,
      )

      // savedTabsからドメイン名を検索
      const domainsFromTabs = []
      for (const domainId of category.domains) {
        const tab = savedTabs.find((t: TabGroup) => t.id === domainId)
        if (tab) {
          domainsFromTabs.push(tab.domain)
        }
      }
      console.log(`  タブから見つかったドメイン: ${domainsFromTabs.join(', ')}`)
    }

    // マイグレーション実行
    const updatedCategories = categories.map(category => {
      // ドメインIDに対応するドメイン名を取得
      const domainNames = category.domains
        .map(domainId => {
          const group = savedTabs.find((tab: TabGroup) => tab.id === domainId)
          return group?.domain
        })
        .filter(Boolean) as string[]

      // マッピングからもドメイン名を取得
      const mappingDomains = domainCategoryMappings
        .filter(
          (mapping: DomainParentCategoryMapping) =>
            mapping.categoryId === category.id,
        )
        .map((mapping: DomainParentCategoryMapping) => mapping.domain)

      // 既存のdomainNamesと結合して重複排除
      const allDomains = Array.from(
        new Set([
          ...(category.domainNames || []),
          ...domainNames,
          ...mappingDomains,
        ]),
      )

      console.log(
        `カテゴリ「${category.name}」の更新後domainNames:`,
        allDomains,
      )

      // 強制的にdomainNamesを上書き
      return {
        ...category,
        domainNames: allDomains,
      }
    })

    console.log('更新後の親カテゴリ:', updatedCategories)

    // ストレージに保存
    await chrome.storage.local.set({ parentCategories: updatedCategories })
    console.log('親カテゴリのdomainNames移行が完了しました')

    // 確認のため保存後のデータも取得
    const savedCategories = await getParentCategories()
    console.log('保存後の親カテゴリ:', savedCategories)

    return
  } catch (error) {
    console.error('親カテゴリ移行エラー:', error)
    throw error
  }
}

// saveTabs関数の実装（1つだけ残す）
export async function saveTabs(tabs: chrome.tabs.Tab[]) {
  console.log('タブを保存します:', tabs.length)

  // 既存のタブグループを取得
  const groupedTabs = new Map<string, TabGroup>()
  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

  // 既存のタブグループをIDではなくドメインをキーにしてMapに保存
  for (const group of savedTabs) {
    groupedTabs.set(group.domain, group)
  }

  // 重複チェックのためのデバッグログ
  console.log('既存タブグループ数:', savedTabs.length)
  console.log('重複除外済みタブグループ数:', groupedTabs.size)

  // ドメインカテゴリマッピングを取得
  const domainCategoryMappings = await getDomainCategoryMappings()
  console.log('ドメインマッピング:', domainCategoryMappings)

  // 親カテゴリを取得
  const parentCategories = await getParentCategories()
  console.log('親カテゴリ一覧:', parentCategories)

  // デバッグ用にカテゴリのdomainNamesを出力
  for (const category of parentCategories) {
    console.log(
      `カテゴリ「${category.name}」のドメイン名一覧:`,
      category.domainNames || [],
    )
  }

  // domainNames配列が空のカテゴリがあれば緊急マイグレーション実行
  const hasEmptyDomainNames = parentCategories.some(
    cat => !cat.domainNames || cat.domainNames.length === 0,
  )
  if (hasEmptyDomainNames) {
    console.log('空のdomainNames配列を検出、緊急マイグレーションを実行')
    await migrateParentCategoriesToDomainNames()
    // 更新された親カテゴリを再取得
    const updatedCategories = await getParentCategories()
    console.log('マイグレーション後の親カテゴリ:', updatedCategories)
  }

  // 新しいタブを適切なグループに振り分け
  for (const tab of tabs) {
    if (!tab.url) continue
    if (tab.url.startsWith('chrome-extension://')) continue

    try {
      const url = new URL(tab.url)
      const domain = `${url.protocol}//${url.hostname}`

      // 重複のチェックとログ出力を追加
      if (groupedTabs.has(domain)) {
        console.log(`既存のドメインに追加: ${domain}`)
      } else {
        console.log(`新しいドメインを処理: ${domain}`)

        // 新しいグループを作成（新形式）
        const newGroup: TabGroup = {
          id: uuidv4(),
          domain,
          urlIds: [], // 新形式のURLIDs
          subCategories: [],
          savedAt: Date.now(), // グループ全体の保存時刻を追加
        }

        // 既存の子カテゴリ設定を復元
        const restoredGroup = await restoreCategorySettings(newGroup)

        // このドメインが所属する親カテゴリを探す
        let foundCategory = null
        let categoryFoundMethod = ''

        // マッピングでまず検索（最も優先度が高い）
        const domainMapping = domainCategoryMappings.find(
          m => m.domain === domain,
        )
        if (domainMapping) {
          foundCategory = parentCategories.find(
            c => c.id === domainMapping.categoryId,
          )
          if (foundCategory) {
            console.log(
              `ドメイン ${domain} は親カテゴリ「${foundCategory.name}」のマッピングに見つかりました`,
            )
            categoryFoundMethod = 'mapping'
          }
        }

        // マッピングで見つからない場合、domainNamesで検索
        if (!foundCategory) {
          for (const category of parentCategories) {
            // nullチェックとArrayチェックを追加
            if (!category.domainNames || !Array.isArray(category.domainNames)) {
              console.log(`カテゴリ「${category.name}」のdomainNamesが不正です`)
              continue
            }

            console.log(`カテゴリ「${category.name}」のdomainNamesで検索:`, {
              domainNames: category.domainNames,
              searchDomain: domain,
            })

            // 厳密な比較で検索する
            if (category.domainNames.some(d => d === domain)) {
              console.log(
                `ドメイン ${domain} は親カテゴリ「${category.name}」のdomainNamesに見つかりました`,
              )
              foundCategory = category
              categoryFoundMethod = 'domainNames'
              break
            }
          }
        }

        // 親カテゴリが見つかった場合、グループに割り当てて更新
        if (foundCategory) {
          console.log(
            `ドメイン ${domain} を親カテゴリ「${foundCategory.name}」に割り当てます (検出方法: ${categoryFoundMethod})`,
          )

          restoredGroup.parentCategoryId = foundCategory.id

          // 親カテゴリにこの新しいグループを追加
          const updatedCategory = {
            ...foundCategory,
            domains: [...foundCategory.domains, restoredGroup.id],
          }

          // domainNamesにドメインを確実に追加
          if (!updatedCategory.domainNames) {
            updatedCategory.domainNames = [domain]
          } else if (!updatedCategory.domainNames.includes(domain)) {
            updatedCategory.domainNames = [
              ...updatedCategory.domainNames,
              domain,
            ]
          }

          // 親カテゴリを更新
          await updateCategoryDomains(updatedCategory)
          console.log(`親カテゴリ「${foundCategory.name}」を更新しました`)

          // ドメインカテゴリのマッピングも更新
          await updateDomainCategoryMapping(domain, foundCategory.id)
          console.log(
            `ドメイン ${domain} と親カテゴリのマッピングを更新しました`,
          )
        } else {
          console.log(
            `ドメイン ${domain} の親カテゴリが見つからないため未分類です`,
          )
        }

        groupedTabs.set(domain, restoredGroup)
      }

      // グループにURLを追加（新形式対応）
      const group = groupedTabs.get(domain)
      if (!group) continue

      // URLレコードを作成または取得
      const { createOrUpdateUrlRecord } = await import('./urls')
      const urlRecord = await createOrUpdateUrlRecord(tab.url, tab.title || '')

      // URLIDsが存在しない場合は初期化
      if (!group.urlIds) {
        group.urlIds = []
      }

      // URLが既に存在するかチェック
      const urlExists = group.urlIds.includes(urlRecord.id)
      if (!urlExists) {
        group.urlIds.push(urlRecord.id)
      }
    } catch (error) {
      console.error(`Invalid URL: ${tab.url}`, error)
    }
  }

  // ストレージに保存（重複がないことを確認）
  const groupArray = Array.from(groupedTabs.values())
  console.log('保存前の重複チェック:', groupArray.length)

  // 重複IDがないかチェック
  const idSet = new Set<string>()
  const uniqueGroups = groupArray.filter(group => {
    if (idSet.has(group.id)) {
      console.warn(`重複ID検出: ${group.id} (${group.domain})`)
      return false
    }
    idSet.add(group.id)
    return true
  })

  console.log('重複除去後のタブグループ数:', uniqueGroups.length)
  await chrome.storage.local.set({ savedTabs: uniqueGroups })

  // 保存したすべてのグループに自動カテゴライズを適用
  for (const group of uniqueGroups) {
    if (group.categoryKeywords && group.categoryKeywords.length > 0) {
      await autoCategorizeTabs(group.id)
    }
  }
}

// タブ保存時に自動分類も行うようにsaveTabsを拡張
export async function saveTabsWithAutoCategory(tabs: chrome.tabs.Tab[]) {
  await saveTabs(tabs)

  // 保存したタブグループのIDを取得
  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

  // 重複チェックを追加
  const uniqueIds = new Set<string>()
  const uniqueGroups: TabGroup[] = []

  for (const group of savedTabs) {
    if (!uniqueIds.has(group.id)) {
      uniqueIds.add(group.id)
      uniqueGroups.push(group)
    } else {
      console.warn(`重複グループを検出: ${group.id} (${group.domain})`)
    }
  }

  // 重複があれば修正して保存
  if (uniqueGroups.length < savedTabs.length) {
    console.log(`重複を修正: ${savedTabs.length} → ${uniqueGroups.length}`)
    await chrome.storage.local.set({ savedTabs: uniqueGroups })
  }

  const uniqueDomains = new Set(
    tabs
      .map(tab => {
        try {
          const url = new URL(tab.url || '')
          return `${url.protocol}//${url.hostname}`
        } catch {
          return null
        }
      })
      .filter(Boolean),
  )

  // 各ドメインで自動カテゴライズを実行
  for (const domain of uniqueDomains) {
    const group = uniqueGroups.find((g: TabGroup) => g.domain === domain)
    if (group?.categoryKeywords?.length && group) {
      await autoCategorizeTabs(group.id)
    }
  }
}

// 親カテゴリの domains と domainNames を更新する関数
async function updateCategoryDomains(category: ParentCategory): Promise<void> {
  const categories = await getParentCategories()
  const updatedCategories = categories.map(c =>
    c.id === category.id ? category : c,
  )
  await saveParentCategories(updatedCategories)
}

// TabGroup IDからグループを取得する関数
async function getTabGroupById(groupId: string): Promise<TabGroup | null> {
  const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
  return savedTabs.find((group: TabGroup) => group.id === groupId) || null
}

/**
 * URL管理の正規化マイグレーション
 * SavedTabsとCustomProjectsのURLsを共通のUrlsストレージに移行する
 */
export async function migrateToUrlsStorage(): Promise<void> {
  try {
    console.log('URL管理正規化マイグレーションを開始します')

    // 既にマイグレーション済みかチェック
    const { urlsMigrationCompleted } = await chrome.storage.local.get(
      'urlsMigrationCompleted',
    )
    if (urlsMigrationCompleted) {
      console.log('URL管理マイグレーションは既に完了済みです')
      return
    }

    // 既存のURLsストレージをチェック
    const { urls: existingUrls = [] } = await chrome.storage.local.get('urls')
    const urlMap = new Map<
      string,
      { id: string; record: import('@/types/storage').UrlRecord }
    >()

    // 既存のURLレコードをマップに追加
    for (const record of existingUrls) {
      urlMap.set(record.url, { id: record.id, record })
    }

    console.log(`既存のURLレコード: ${existingUrls.length}個`)

    // SavedTabsのマイグレーション
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
    console.log(`SavedTabsの処理開始: ${savedTabs.length}個のタブグループ`)

    for (const tabGroup of savedTabs) {
      if (
        tabGroup.urls &&
        Array.isArray(tabGroup.urls) &&
        tabGroup.urls.length > 0
      ) {
        const urlIds: string[] = []
        const urlSubCategories: Record<string, string> = {}

        for (const urlItem of tabGroup.urls) {
          // URLからレコードを検索または作成
          let urlEntry = urlMap.get(urlItem.url)

          if (!urlEntry) {
            // 新しいURLレコードを作成
            const { v4: uuidv4 } = await import('uuid')
            const newRecord: import('@/types/storage').UrlRecord = {
              id: uuidv4(),
              url: urlItem.url,
              title: urlItem.title || '',
              savedAt: urlItem.savedAt || Date.now(),
              favIconUrl: undefined,
            }

            urlEntry = { id: newRecord.id, record: newRecord }
            urlMap.set(urlItem.url, urlEntry)
          } else {
            // 既存レコードのタイトルを更新（より詳細な情報があれば）
            if (
              urlItem.title &&
              urlItem.title.length > urlEntry.record.title.length
            ) {
              urlEntry.record.title = urlItem.title
            }
          }

          urlIds.push(urlEntry.id)

          // サブカテゴリ情報を保存
          if (urlItem.subCategory) {
            urlSubCategories[urlEntry.id] = urlItem.subCategory
          }
        }

        // TabGroupを新形式に更新
        tabGroup.urlIds = urlIds
        if (Object.keys(urlSubCategories).length > 0) {
          tabGroup.urlSubCategories = urlSubCategories
        }

        // 旧形式のurlsプロパティを削除
        tabGroup.urls = undefined

        console.log(
          `TabGroup ${tabGroup.domain}: ${urlIds.length}個のURLを移行`,
        )
      }
    }

    // CustomProjectsのマイグレーション
    const { customProjects = [] } =
      await chrome.storage.local.get('customProjects')
    console.log(
      `CustomProjectsの処理開始: ${customProjects.length}個のプロジェクト`,
    )

    for (const project of customProjects) {
      if (
        project.urls &&
        Array.isArray(project.urls) &&
        project.urls.length > 0
      ) {
        const urlIds: string[] = []
        const urlMetadata: Record<
          string,
          { notes?: string; category?: string }
        > = {}

        for (const urlItem of project.urls) {
          // URLからレコードを検索または作成
          let urlEntry = urlMap.get(urlItem.url)

          if (!urlEntry) {
            // 新しいURLレコードを作成
            const { v4: uuidv4 } = await import('uuid')
            const newRecord: import('@/types/storage').UrlRecord = {
              id: uuidv4(),
              url: urlItem.url,
              title: urlItem.title || '',
              savedAt: urlItem.savedAt || Date.now(),
              favIconUrl: undefined,
            }

            urlEntry = { id: newRecord.id, record: newRecord }
            urlMap.set(urlItem.url, urlEntry)
          } else {
            // 既存レコードのタイトルを更新（より詳細な情報があれば）
            if (
              urlItem.title &&
              urlItem.title.length > urlEntry.record.title.length
            ) {
              urlEntry.record.title = urlItem.title
            }
          }

          urlIds.push(urlEntry.id)

          // メタデータを保存
          const metadata: { notes?: string; category?: string } = {}
          if (urlItem.notes) metadata.notes = urlItem.notes
          if (urlItem.category) metadata.category = urlItem.category

          if (Object.keys(metadata).length > 0) {
            urlMetadata[urlEntry.id] = metadata
          }
        }

        // CustomProjectを新形式に更新
        project.urlIds = urlIds
        if (Object.keys(urlMetadata).length > 0) {
          project.urlMetadata = urlMetadata
        }

        // 旧形式のurlsプロパティを削除
        project.urls = undefined

        console.log(`Project ${project.name}: ${urlIds.length}個のURLを移行`)
      }
    }

    // 更新されたデータを保存
    const allUrlRecords = Array.from(urlMap.values()).map(entry => entry.record)
    await chrome.storage.local.set({
      urls: allUrlRecords,
      savedTabs,
      customProjects,
      urlsMigrationCompleted: true,
    })

    console.log(
      `URL管理マイグレーション完了: ${allUrlRecords.length}個のURLレコードを作成`,
    )
    console.log(`SavedTabs: ${savedTabs.length}個のタブグループを更新`)
    console.log(
      `CustomProjects: ${customProjects.length}個のプロジェクトを更新`,
    )
  } catch (error) {
    console.error('URL管理マイグレーション中にエラーが発生しました:', error)
    throw error
  }
}
