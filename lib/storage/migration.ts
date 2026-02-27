import { v4 as uuidv4 } from 'uuid'
import type {
  CustomProject,
  DomainParentCategoryMapping,
  ParentCategory,
  TabGroup,
  UrlRecord,
} from '@/types/storage'
import {
  getDomainCategoryMappings,
  getParentCategories,
  saveParentCategories,
  updateDomainCategoryMapping,
} from './categories'
import { autoCategorizeTabs, restoreCategorySettings } from './tabs'
import { createOrUpdateUrlRecord, invalidateUrlCache } from './urls'

// ドメインを親カテゴリに割り当てる関数
export async function assignDomainToCategory(
  domainId: string,
  categoryId: string,
): Promise<void> {
  const [categories, tabGroup] = await Promise.all([
    getParentCategories(),
    getTabGroupById(domainId),
  ])

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
    const [categories, savedTabsResult, domainCategoryMappingsResult] =
      await Promise.all([
        getParentCategories(),
        chrome.storage.local.get('savedTabs'),
        chrome.storage.local.get('domainCategoryMappings'),
      ])
    const { savedTabs = [] } = savedTabsResult
    const { domainCategoryMappings = [] } = domainCategoryMappingsResult

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

interface DomainCategoryMatch {
  category: ParentCategory
  method: 'mapping' | 'domainNames'
}

function buildGroupedTabsByDomain(
  savedTabs: TabGroup[],
): Map<string, TabGroup> {
  const groupedTabs = new Map<string, TabGroup>()
  for (const group of savedTabs) {
    groupedTabs.set(group.domain, group)
  }
  return groupedTabs
}

function logParentCategorySnapshot(parentCategories: ParentCategory[]): void {
  console.log('親カテゴリ一覧:', parentCategories)
  for (const category of parentCategories) {
    console.log(
      `カテゴリ「${category.name}」のドメイン名一覧:`,
      category.domainNames || [],
    )
  }
}

async function normalizeParentCategoriesIfNeeded(
  parentCategories: ParentCategory[],
): Promise<ParentCategory[]> {
  const hasEmptyDomainNames = parentCategories.some(
    cat => !cat.domainNames || cat.domainNames.length === 0,
  )
  if (!hasEmptyDomainNames) {
    return parentCategories
  }

  console.log('空のdomainNames配列を検出、緊急マイグレーションを実行')
  await migrateParentCategoriesToDomainNames()
  const updatedCategories = await getParentCategories()
  console.log('マイグレーション後の親カテゴリ:', updatedCategories)
  return updatedCategories
}

function findCategoryByDomainMapping(
  domain: string,
  domainCategoryMappings: DomainParentCategoryMapping[],
  parentCategories: ParentCategory[],
): DomainCategoryMatch | null {
  const domainMapping = domainCategoryMappings.find(m => m.domain === domain)
  if (!domainMapping) {
    return null
  }

  const category = parentCategories.find(c => c.id === domainMapping.categoryId)
  if (!category) {
    return null
  }

  console.log(
    `ドメイン ${domain} は親カテゴリ「${category.name}」のマッピングに見つかりました`,
  )
  return { category, method: 'mapping' }
}

function findCategoryByDomainNames(
  domain: string,
  parentCategories: ParentCategory[],
): DomainCategoryMatch | null {
  for (const category of parentCategories) {
    if (!Array.isArray(category.domainNames)) {
      console.log(`カテゴリ「${category.name}」のdomainNamesが不正です`)
      continue
    }

    console.log(`カテゴリ「${category.name}」のdomainNamesで検索:`, {
      domainNames: category.domainNames,
      searchDomain: domain,
    })
    if (category.domainNames.some(d => d === domain)) {
      console.log(
        `ドメイン ${domain} は親カテゴリ「${category.name}」のdomainNamesに見つかりました`,
      )
      return { category, method: 'domainNames' }
    }
  }
  return null
}

function findParentCategoryForDomain(
  domain: string,
  domainCategoryMappings: DomainParentCategoryMapping[],
  parentCategories: ParentCategory[],
): DomainCategoryMatch | null {
  return (
    findCategoryByDomainMapping(
      domain,
      domainCategoryMappings,
      parentCategories,
    ) || findCategoryByDomainNames(domain, parentCategories)
  )
}

async function assignGroupToCategory(
  group: TabGroup,
  domain: string,
  match: DomainCategoryMatch,
): Promise<void> {
  console.log(
    `ドメイン ${domain} を親カテゴリ「${match.category.name}」に割り当てます (検出方法: ${match.method})`,
  )
  group.parentCategoryId = match.category.id

  const domainNames = Array.isArray(match.category.domainNames)
    ? match.category.domainNames
    : []
  const updatedCategory: ParentCategory = {
    ...match.category,
    domains: [...match.category.domains, group.id],
    domainNames: domainNames.includes(domain)
      ? domainNames
      : [...domainNames, domain],
  }

  await Promise.all([
    updateCategoryDomains(updatedCategory),
    updateDomainCategoryMapping(domain, match.category.id),
  ])
  console.log(`ドメイン ${domain} と親カテゴリのマッピングを更新しました`)
}

async function createGroupForDomain(
  domain: string,
  domainCategoryMappings: DomainParentCategoryMapping[],
  parentCategories: ParentCategory[],
): Promise<TabGroup> {
  const newGroup: TabGroup = {
    id: uuidv4(),
    domain,
    urlIds: [],
    subCategories: [],
    savedAt: Date.now(),
  }
  const restoredGroup = await restoreCategorySettings(newGroup)

  const match = findParentCategoryForDomain(
    domain,
    domainCategoryMappings,
    parentCategories,
  )
  if (!match) {
    console.log(`ドメイン ${domain} の親カテゴリが見つからないため未分類です`)
    return restoredGroup
  }

  await assignGroupToCategory(restoredGroup, domain, match)
  return restoredGroup
}

async function appendUrlToGroup(
  group: TabGroup,
  tabUrl: string,
  tabTitle: string,
): Promise<void> {
  const urlRecord = await createOrUpdateUrlRecord(tabUrl, tabTitle)
  if (!group.urlIds) {
    group.urlIds = []
  }
  if (!group.urlIds.includes(urlRecord.id)) {
    group.urlIds.push(urlRecord.id)
  }
}

function dedupeGroupsById(groupArray: TabGroup[]): TabGroup[] {
  const idSet = new Set<string>()
  return groupArray.filter(group => {
    if (idSet.has(group.id)) {
      console.warn(`重複ID検出: ${group.id} (${group.domain})`)
      return false
    }
    idSet.add(group.id)
    return true
  })
}

function getTabDomain(tabUrl: string): string | null {
  try {
    const parsedUrl = new URL(tabUrl)
    return `${parsedUrl.protocol}//${parsedUrl.hostname}`
  } catch (error) {
    console.error(`Invalid URL: ${tabUrl}`, error)
    return null
  }
}

// saveTabs関数の実装（1つだけ残す）
export async function saveTabs(tabs: chrome.tabs.Tab[]) {
  console.log('タブを保存します:', tabs.length)

  const [savedTabsResult, domainCategoryMappings, initialParentCategories] =
    await Promise.all([
      chrome.storage.local.get('savedTabs'),
      getDomainCategoryMappings(),
      getParentCategories(),
    ])
  const { savedTabs = [] } = savedTabsResult
  const groupedTabs = buildGroupedTabsByDomain(savedTabs)

  console.log('既存タブグループ数:', savedTabs.length)
  console.log('重複除外済みタブグループ数:', groupedTabs.size)
  console.log('ドメインマッピング:', domainCategoryMappings)

  const parentCategories = await normalizeParentCategoriesIfNeeded(
    initialParentCategories,
  )
  logParentCategorySnapshot(parentCategories)

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome-extension://')) {
      continue
    }

    const domain = getTabDomain(tab.url)
    if (!domain) {
      continue
    }

    let group = groupedTabs.get(domain)
    if (group) {
      console.log(`既存のドメインに追加: ${domain}`)
    } else {
      console.log(`新しいドメインを処理: ${domain}`)
      group = await createGroupForDomain(
        domain,
        domainCategoryMappings,
        parentCategories,
      )
      groupedTabs.set(domain, group)
    }

    await appendUrlToGroup(group, tab.url, tab.title || '')
  }

  const groupArray = Array.from(groupedTabs.values())
  console.log('保存前の重複チェック:', groupArray.length)
  const uniqueGroups = dedupeGroupsById(groupArray)

  console.log('重複除去後のタブグループ数:', uniqueGroups.length)
  await chrome.storage.local.set({ savedTabs: uniqueGroups })

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
    if (uniqueIds.has(group.id)) {
      console.warn(`重複グループを検出: ${group.id} (${group.domain})`)
    } else {
      uniqueIds.add(group.id)
      uniqueGroups.push(group)
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
    if (group && (group.categoryKeywords?.length ?? 0) > 0) {
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

/** モジュールスコープのメモ化フラグ（ページセッション中の重複ストレージアクセスを防ぐ） */
let _urlsMigrationDone = false

interface UrlMapEntry {
  id: string
  record: UrlRecord
}
type UrlMap = Map<string, UrlMapEntry>
type LegacyTabUrl = NonNullable<TabGroup['urls']>[number]
type LegacyProjectUrl = NonNullable<CustomProject['urls']>[number]

interface UrlMigrationData {
  existingUrls: UrlRecord[]
  savedTabs: TabGroup[]
  customProjects: CustomProject[]
}

async function shouldSkipUrlsMigrationByMemoryFlag(): Promise<boolean> {
  if (!_urlsMigrationDone) {
    return false
  }

  const { urlsMigrationCompleted } = await chrome.storage.local.get(
    'urlsMigrationCompleted',
  )
  if (urlsMigrationCompleted) {
    return true
  }

  _urlsMigrationDone = false
  return false
}

async function isUrlsMigrationCompleted(): Promise<boolean> {
  const { urlsMigrationCompleted } = await chrome.storage.local.get(
    'urlsMigrationCompleted',
  )
  return Boolean(urlsMigrationCompleted)
}

async function loadUrlMigrationData(): Promise<UrlMigrationData> {
  const [existingUrlsResult, savedTabsResult, customProjectsResult] =
    await Promise.all([
      chrome.storage.local.get('urls'),
      chrome.storage.local.get('savedTabs'),
      chrome.storage.local.get('customProjects'),
    ])

  return {
    existingUrls: Array.isArray(existingUrlsResult.urls)
      ? (existingUrlsResult.urls as UrlRecord[])
      : [],
    savedTabs: Array.isArray(savedTabsResult.savedTabs)
      ? (savedTabsResult.savedTabs as TabGroup[])
      : [],
    customProjects: Array.isArray(customProjectsResult.customProjects)
      ? (customProjectsResult.customProjects as CustomProject[])
      : [],
  }
}

function createUrlMap(existingUrls: UrlRecord[]): UrlMap {
  const urlMap: UrlMap = new Map()
  for (const record of existingUrls) {
    urlMap.set(record.url, { id: record.id, record })
  }
  return urlMap
}

function upsertUrlEntry(
  urlMap: UrlMap,
  legacyUrl: { url: string; title?: string; savedAt?: number },
): UrlMapEntry {
  const existing = urlMap.get(legacyUrl.url)
  if (existing) {
    if (
      legacyUrl.title &&
      legacyUrl.title.length > existing.record.title.length
    ) {
      existing.record.title = legacyUrl.title
    }
    return existing
  }

  const newRecord: UrlRecord = {
    id: uuidv4(),
    url: legacyUrl.url,
    title: legacyUrl.title || '',
    savedAt: legacyUrl.savedAt || Date.now(),
    favIconUrl: undefined,
  }
  const created = { id: newRecord.id, record: newRecord }
  urlMap.set(legacyUrl.url, created)
  return created
}

function migrateTabGroupUrls(tabGroup: TabGroup, urlMap: UrlMap): void {
  if (
    !(tabGroup.urls && Array.isArray(tabGroup.urls) && tabGroup.urls.length > 0)
  ) {
    return
  }

  const urlIds: string[] = []
  const urlSubCategories: Record<string, string> = {}

  for (const urlItem of tabGroup.urls as LegacyTabUrl[]) {
    const urlEntry = upsertUrlEntry(urlMap, urlItem)
    urlIds.push(urlEntry.id)
    if (urlItem.subCategory) {
      urlSubCategories[urlEntry.id] = urlItem.subCategory
    }
  }

  tabGroup.urlIds = urlIds
  if (Object.keys(urlSubCategories).length > 0) {
    tabGroup.urlSubCategories = urlSubCategories
  }
  tabGroup.urls = undefined
  console.log(`TabGroup ${tabGroup.domain}: ${urlIds.length}個のURLを移行`)
}

function migrateProjectUrls(project: CustomProject, urlMap: UrlMap): void {
  if (
    !(project.urls && Array.isArray(project.urls) && project.urls.length > 0)
  ) {
    return
  }

  const urlIds: string[] = []
  const urlMetadata: Record<string, { notes?: string; category?: string }> = {}

  for (const urlItem of project.urls as LegacyProjectUrl[]) {
    const urlEntry = upsertUrlEntry(urlMap, urlItem)
    urlIds.push(urlEntry.id)

    const metadata: { notes?: string; category?: string } = {}
    if (urlItem.notes) {
      metadata.notes = urlItem.notes
    }
    if (urlItem.category) {
      metadata.category = urlItem.category
    }
    if (Object.keys(metadata).length > 0) {
      urlMetadata[urlEntry.id] = metadata
    }
  }

  project.urlIds = urlIds
  if (Object.keys(urlMetadata).length > 0) {
    project.urlMetadata = urlMetadata
  }
  project.urls = undefined
  console.log(`Project ${project.name}: ${urlIds.length}個のURLを移行`)
}

async function persistUrlsMigrationResult(
  urlMap: UrlMap,
  savedTabs: TabGroup[],
  customProjects: CustomProject[],
): Promise<void> {
  const allUrlRecords = Array.from(urlMap.values()).map(entry => entry.record)
  await chrome.storage.local.set({
    urls: allUrlRecords,
    savedTabs,
    customProjects,
    urlsMigrationCompleted: true,
  })
  invalidateUrlCache()
  _urlsMigrationDone = true

  console.log(
    `URL管理マイグレーション完了: ${allUrlRecords.length}個のURLレコードを作成`,
  )
  console.log(`SavedTabs: ${savedTabs.length}個のタブグループを更新`)
  console.log(`CustomProjects: ${customProjects.length}個のプロジェクトを更新`)
}

/**
 * URL管理の正規化マイグレーション
 * SavedTabsとCustomProjectsのURLsを共通のUrlsストレージに移行する
 */
export async function migrateToUrlsStorage(): Promise<void> {
  try {
    if (await shouldSkipUrlsMigrationByMemoryFlag()) {
      return
    }

    console.log('URL管理正規化マイグレーションを開始します')

    if (await isUrlsMigrationCompleted()) {
      _urlsMigrationDone = true
      console.log('URL管理マイグレーションは既に完了済みです')
      return
    }

    const { existingUrls, savedTabs, customProjects } =
      await loadUrlMigrationData()
    const urlMap = createUrlMap(existingUrls)

    console.log(`既存のURLレコード: ${existingUrls.length}個`)
    console.log(`SavedTabsの処理開始: ${savedTabs.length}個のタブグループ`)
    for (const tabGroup of savedTabs) {
      migrateTabGroupUrls(tabGroup, urlMap)
    }

    console.log(
      `CustomProjectsの処理開始: ${customProjects.length}個のプロジェクト`,
    )
    for (const project of customProjects) {
      migrateProjectUrls(project, urlMap)
    }

    await persistUrlsMigrationResult(urlMap, savedTabs, customProjects)
  } catch (error) {
    console.error('URL管理マイグレーション中にエラーが発生しました:', error)
    throw error
  }
}
