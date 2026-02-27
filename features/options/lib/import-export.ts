import { z } from 'zod'
import { saveParentCategories } from '@/lib/storage/categories'
import { migrateToUrlsStorage } from '@/lib/storage/migration'
import {
  defaultSettings,
  getUserSettings,
  saveUserSettings,
} from '@/lib/storage/settings'
import { createOrUpdateUrlRecord } from '@/lib/storage/urls'
import type {
  ParentCategory,
  SubCategoryKeyword,
  TabGroup,
  UrlRecord,
  UserSettings,
} from '@/types/storage'

// バックアップデータの型定義
interface BackupData {
  version: string
  timestamp: string
  userSettings: UserSettings
  parentCategories: ParentCategory[]
  savedTabs: TabGroup[]
  urls?: UrlRecord[]
}

// インポート時のURL形式に対応するインターフェース
interface ImportedUrlData {
  url: string
  title?: string
  favIconUrl?: string
  timestamp?: number
  tabId?: number
  subCategory?: string
  savedAt?: number
}
interface ImportedUrlRecordData {
  id: string
  url: string
  title?: string
  savedAt?: number
  favIconUrl?: string
}
interface ImportedTabData {
  id: string
  domain: string
  urls?: ImportedUrlData[]
  urlIds?: string[]
  urlSubCategories?: Record<string, string>
  parentCategoryId?: string
  subCategories?: unknown[]
  categoryKeywords?: unknown[]
  savedAt?: number
}

// インポート時のカテゴリキーワード形式に対応するインターフェース
interface ImportedKeywordData {
  categoryName: string // 必須プロパティに変更
  keywords?: string[] // オプショナルのままにする
  [key: string]: unknown // その他の可能性のあるプロパティ
}
interface ConvertedUrlData {
  urlIds: string[]
  urlSubCategories?: Record<string, string>
}
const importedUrlDataSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  favIconUrl: z.string().optional(),
  timestamp: z.number().optional(),
  tabId: z.number().optional(),
  // インポート用に他のプロパティも許可
  subCategory: z.string().optional(),
  savedAt: z.number().optional(),
})
const importedUrlRecordSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().optional(),
  savedAt: z.number().optional(),
  favIconUrl: z.string().optional(),
})

// バックアップデータのバリデーションスキーマ
const backupDataSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  userSettings: z.object({
    removeTabAfterOpen: z.boolean(),
    removeTabAfterExternalDrop: z.boolean().optional(),
    excludePatterns: z.array(z.string()),
    enableCategories: z.boolean(),
    showSavedTime: z.boolean(),
    autoDeletePeriod: z.string().optional(),
    clickBehavior: z.enum([
      'saveCurrentTab',
      'saveWindowTabs',
      'saveSameDomainTabs',
      'saveAllWindowsTabs',
    ]),
  }),
  parentCategories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      domains: z.array(z.string()),
      domainNames: z.array(z.string()),
      // keywords はスキーマ上は許可するが、処理中に適切に扱う
      keywords: z.array(z.string()).optional(),
    }),
  ),
  savedTabs: z.array(
    z.object({
      id: z.string(),
      domain: z.string(),
      // 旧形式: URLsを直接保持
      urls: z.array(importedUrlDataSchema).optional(),
      // 新形式: URL ID参照
      urlIds: z.array(z.string()).optional(),
      urlSubCategories: z.record(z.string(), z.string()).optional(),
      parentCategoryId: z.string().optional(),
      subCategories: z.array(z.unknown()).optional(),
      categoryKeywords: z.array(z.unknown()).optional(),
      savedAt: z.number().optional(),
    }),
  ),
  // 新形式バックアップ用: URLレコード本体
  urls: z.array(importedUrlRecordSchema).optional(),
})

/**
 * インポートされたURLデータを新形式に変換する
 * @param urls インポートされたURL配列
 * @returns 新形式のTabGroup（urlIdsとurlSubCategoriesを含む）
 */
const convertImportedUrlsToNewFormat = async (
  urls: ImportedUrlData[],
): Promise<ConvertedUrlData> => {
  const urlIds: string[] = []
  const urlSubCategories: Record<string, string> = {}
  for (const urlData of urls) {
    try {
      // URLレコードを作成または更新
      const urlRecord = await createOrUpdateUrlRecord(
        urlData.url,
        urlData.title || '',
        urlData.favIconUrl,
      )
      urlIds.push(urlRecord.id)

      // サブカテゴリ情報があれば保存
      if (urlData.subCategory) {
        urlSubCategories[urlRecord.id] = urlData.subCategory
      }
      console.log(`URL変換完了: ${urlData.url} -> ${urlRecord.id}`)
    } catch (error) {
      console.error(`URL変換エラー: ${urlData.url}`, error)
    }
  }
  return {
    urlIds,
    urlSubCategories:
      Object.keys(urlSubCategories).length > 0 ? urlSubCategories : undefined,
  }
}
/**
 * categoryKeywordsを型安全に正規化する
 */
const normalizeCategoryKeywords = (
  keywords: unknown[] | undefined,
): SubCategoryKeyword[] => {
  if (!Array.isArray(keywords)) {
    return []
  }
  return keywords
    .filter(
      (k): k is ImportedKeywordData =>
        typeof k === 'object' &&
        k !== null &&
        'categoryName' in k &&
        typeof k.categoryName === 'string',
    )
    .map(k => {
      const keywordData = k as {
        categoryName: string
        keywords?: unknown
      }
      return {
        categoryName: k.categoryName,
        keywords: Array.isArray(keywordData.keywords)
          ? keywordData.keywords
          : [],
      }
    })
}
/**
 * サブカテゴリ配列を文字列配列に正規化する
 */
const normalizeSubCategories = (items: unknown[] | undefined): string[] => {
  if (!Array.isArray(items)) {
    return []
  }
  const names: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    let name: string | null = null
    if (typeof item === 'string') {
      name = item
    } else if (
      typeof item === 'object' &&
      item !== null &&
      'name' in item &&
      typeof item.name === 'string'
    ) {
      name = item.name
    }
    if (!name || seen.has(name)) {
      continue
    }
    seen.add(name)
    names.push(name)
  }
  return names
}
/**
 * categoryKeywordsをカテゴリ名単位でマージする
 */
const mergeCategoryKeywords = (
  existing: SubCategoryKeyword[] | undefined,
  imported: unknown[] | undefined,
): SubCategoryKeyword[] => {
  const keywordMap = new Map<string, SubCategoryKeyword>()
  for (const keyword of existing || []) {
    keywordMap.set(keyword.categoryName, keyword)
  }
  for (const keyword of normalizeCategoryKeywords(imported)) {
    const existingKeyword = keywordMap.get(keyword.categoryName)
    if (!existingKeyword) {
      keywordMap.set(keyword.categoryName, keyword)
      continue
    }
    keywordMap.set(keyword.categoryName, {
      categoryName: keyword.categoryName,
      keywords: [
        ...new Set([...existingKeyword.keywords, ...keyword.keywords]),
      ],
    })
  }
  return Array.from(keywordMap.values())
}
/**
 * サブカテゴリを順序を保ってマージする（既存優先）
 */
const mergeSubCategories = (
  existing: unknown[] | undefined,
  imported: unknown[] | undefined,
): string[] => {
  const existingNames = normalizeSubCategories(existing)
  const merged = [...existingNames]
  const seen = new Set(existingNames)
  for (const name of normalizeSubCategories(imported)) {
    if (seen.has(name)) {
      continue
    }
    seen.add(name)
    merged.push(name)
  }
  return merged
}
/**
 * URL参照情報（urlIds/urlSubCategories）をマージする
 */
const mergeUrlData = (
  existingTab: TabGroup,
  importedUrlData: ConvertedUrlData,
): ConvertedUrlData => {
  const urlIdSet = new Set(existingTab.urlIds || [])
  for (const urlId of importedUrlData.urlIds) {
    urlIdSet.add(urlId)
  }
  const mergedUrlSubCategories = {
    ...(existingTab.urlSubCategories || {}),
    ...(importedUrlData.urlSubCategories || {}),
  }
  return {
    urlIds: Array.from(urlIdSet),
    urlSubCategories:
      Object.keys(mergedUrlSubCategories).length > 0
        ? mergedUrlSubCategories
        : undefined,
  }
}
/**
 * TabGroupのURL情報をエクスポート用の旧形式配列に変換する
 */
const convertTabGroupToExportUrls = (
  tab: TabGroup,
  urlRecordMap: Map<string, UrlRecord>,
  placeholderUrlRecordMap: Map<string, UrlRecord>,
): NonNullable<TabGroup['urls']> => {
  if (Array.isArray(tab.urls) && tab.urls.length > 0) {
    return tab.urls.filter(
      (item): item is NonNullable<TabGroup['urls']>[number] =>
        Boolean(item?.url),
    )
  }
  if (!Array.isArray(tab.urlIds) || tab.urlIds.length === 0) {
    return []
  }
  const exportedUrls: NonNullable<TabGroup['urls']> = []
  const baseDomain = tab.domain.replace(/\/+$/, '')
  let offset = 0
  for (const urlId of tab.urlIds) {
    const urlRecord =
      urlRecordMap.get(urlId) || placeholderUrlRecordMap.get(urlId)
    const resolvedUrlRecord = urlRecord || {
      id: urlId,
      url: `${baseDomain}/#tabbin-export-missing-${urlId}`,
      title: '復元データ（元URL欠損）',
      savedAt:
        typeof tab.savedAt === 'number'
          ? tab.savedAt + offset
          : Date.now() + offset,
    }
    if (!(urlRecord || placeholderUrlRecordMap.has(urlId))) {
      placeholderUrlRecordMap.set(urlId, resolvedUrlRecord)
    }
    offset += 1
    exportedUrls.push({
      url: resolvedUrlRecord.url,
      title: resolvedUrlRecord.title || '',
      savedAt: resolvedUrlRecord.savedAt,
      subCategory: tab.urlSubCategories?.[urlId],
    })
  }
  return exportedUrls
}
/**
 * urlIds形式のタブデータをURL配列に復元する
 */
const restoreImportedUrlsFromIds = (
  tab: ImportedTabData,
  importedUrlRecordMap: Map<string, ImportedUrlRecordData>,
  currentUrlRecordMap: Map<string, UrlRecord>,
): ImportedUrlData[] => {
  if (!Array.isArray(tab.urlIds) || tab.urlIds.length === 0) {
    return []
  }
  const restoredUrls: ImportedUrlData[] = []
  for (const urlId of tab.urlIds) {
    const urlRecord =
      importedUrlRecordMap.get(urlId) || currentUrlRecordMap.get(urlId)
    if (!urlRecord) {
      continue
    }
    restoredUrls.push({
      url: urlRecord.url,
      title: urlRecord.title || '',
      favIconUrl: urlRecord.favIconUrl,
      savedAt: urlRecord.savedAt,
      subCategory: tab.urlSubCategories?.[urlId],
    })
  }
  return restoredUrls
}
const normalizeImportedTabsForImport = (
  importedTabs: ImportedTabData[],
  importedUrlRecordMap: Map<string, ImportedUrlRecordData>,
  currentUrlRecordMap: Map<string, UrlRecord>,
): {
  normalizedImportedTabs: Array<
    ImportedTabData & {
      urls: ImportedUrlData[]
    }
  >
  unresolvedTabs: Array<{
    domain: string
    urlIds: string[]
    savedAt?: number
  }>
} => {
  const unresolvedTabs: Array<{
    domain: string
    urlIds: string[]
    savedAt?: number
  }> = []
  const normalizedImportedTabs: Array<
    ImportedTabData & {
      urls: ImportedUrlData[]
    }
  > = importedTabs.map(tab => {
    if (Array.isArray(tab.urls)) {
      return {
        ...tab,
        urls: tab.urls,
      }
    }
    const restoredUrls = restoreImportedUrlsFromIds(
      tab,
      importedUrlRecordMap,
      currentUrlRecordMap,
    )
    if (
      Array.isArray(tab.urlIds) &&
      tab.urlIds.length > 0 &&
      restoredUrls.length === 0
    ) {
      unresolvedTabs.push({
        domain: tab.domain,
        urlIds: Array.from(new Set(tab.urlIds)),
        savedAt: tab.savedAt,
      })
    }
    return {
      ...tab,
      urls: restoredUrls,
    }
  })
  return {
    normalizedImportedTabs,
    unresolvedTabs,
  }
}
/**
 * 変換結果が空のときは、インポート元のurlIdsをそのまま保持して復元性を高める
 */
const resolveUrlDataForStorage = (
  tab: ImportedTabData & {
    urls: ImportedUrlData[]
  },
  convertedUrlData: {
    urlIds: string[]
    urlSubCategories?: Record<string, string>
  },
): {
  urlIds: string[]
  urlSubCategories?: Record<string, string>
} => {
  if (convertedUrlData.urlIds.length > 0) {
    return convertedUrlData
  }
  if (
    tab.urls.length > 0 ||
    !Array.isArray(tab.urlIds) ||
    tab.urlIds.length === 0
  ) {
    return convertedUrlData
  }
  const rawUrlIds = Array.from(new Set(tab.urlIds))
  const rawSubCategories = tab.urlSubCategories
    ? Object.fromEntries(
        Object.entries(tab.urlSubCategories).filter(([urlId]) =>
          rawUrlIds.includes(urlId),
        ),
      )
    : undefined
  return {
    urlIds: rawUrlIds,
    urlSubCategories:
      rawSubCategories && Object.keys(rawSubCategories).length > 0
        ? rawSubCategories
        : undefined,
  }
}
/**
 * バックアップ内にURL実体が無いurlIdsに対して、代替URLレコードを生成する
 */
const ensurePlaceholderUrlRecords = async (
  unresolvedTabs: Array<{
    domain: string
    urlIds: string[]
    savedAt?: number
  }>,
): Promise<number> => {
  if (unresolvedTabs.length === 0) {
    return 0
  }
  const urlsData = await chrome.storage.local.get({
    urls: [],
  })
  const currentUrlRecords: UrlRecord[] = Array.isArray(urlsData.urls)
    ? urlsData.urls
    : []
  const existingIdSet = new Set(currentUrlRecords.map(record => record.id))
  const newRecords: UrlRecord[] = []
  let offset = 0
  for (const tab of unresolvedTabs) {
    const baseDomain = tab.domain.replace(/\/+$/, '')
    for (const urlId of tab.urlIds) {
      if (existingIdSet.has(urlId)) {
        continue
      }
      existingIdSet.add(urlId)
      newRecords.push({
        id: urlId,
        // 元URLが欠損しているため、ドメインに一意アンカーを付けて代替URLを生成
        url: `${baseDomain}/#tabbin-restored-${urlId}`,
        title: '復元データ（元URL欠損）',
        savedAt: tab.savedAt || Date.now() + offset,
      })
      offset += 1
    }
  }
  if (newRecords.length === 0) {
    return 0
  }
  await chrome.storage.local.set({
    urls: [...currentUrlRecords, ...newRecords],
  })
  return newRecords.length
}
/**
 * 現在の設定とタブデータをエクスポートする
 * @returns エクスポートされたデータを含むJSONオブジェクト
 */
const exportSettings = async (): Promise<BackupData> => {
  try {
    // 先にマイグレーションを実行し、新形式URLデータの整合性を高める
    await migrateToUrlsStorage()
    const [userSettings, storageData] = await Promise.all([
      getUserSettings(),
      chrome.storage.local.get({
        parentCategories: [],
        savedTabs: [],
        urls: [],
      }),
    ])
    const parentCategories: ParentCategory[] = Array.isArray(
      storageData.parentCategories,
    )
      ? storageData.parentCategories
      : []
    const savedTabs: TabGroup[] = Array.isArray(storageData.savedTabs)
      ? storageData.savedTabs
      : []
    const urlRecords: UrlRecord[] = Array.isArray(storageData.urls)
      ? storageData.urls
      : []
    const urlRecordMap = new Map(
      urlRecords.map(urlRecord => [urlRecord.id, urlRecord]),
    )
    const placeholderUrlRecordMap = new Map<string, UrlRecord>()
    const normalizedSavedTabs: TabGroup[] = savedTabs.map(tab => ({
      ...tab,
      urls: convertTabGroupToExportUrls(
        tab,
        urlRecordMap,
        placeholderUrlRecordMap,
      ),
    }))
    const mergedUrlRecordMap = new Map(urlRecordMap)
    for (const [id, urlRecord] of placeholderUrlRecordMap) {
      if (!mergedUrlRecordMap.has(id)) {
        mergedUrlRecordMap.set(id, urlRecord)
      }
    }
    const exportUrlRecords = Array.from(mergedUrlRecordMap.values())
    if (placeholderUrlRecordMap.size > 0) {
      console.warn(
        `エクスポート補完: ${placeholderUrlRecordMap.size}件の欠損URLに代替URLを付与`,
      )
    }

    // バックアップデータを作成
    const backupData: BackupData = {
      version: chrome.runtime.getManifest().version || '1.0.0',
      timestamp: new Date().toISOString(),
      userSettings,
      parentCategories,
      savedTabs: normalizedSavedTabs,
      urls: exportUrlRecords,
    }
    return backupData
  } catch (error) {
    console.error('エクスポート中にエラーが発生しました:', error)
    throw new Error('データのエクスポート中にエラーが発生しました')
  }
}

/**
 * データをJSONとしてダウンロードする
 * @param data ダウンロードするデータ
 * @param filename ファイル名
 */
const downloadAsJson = (data: BackupData, filename: string): void => {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()

  // クリーンアップ
  requestAnimationFrame(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
}

/**
 * インポートされたJSONデータをバリデーションして適用する
 * @param jsonData インポートされたJSONデータ
 * @param mergeData 既存データとマージするかどうか
 * @returns インポート結果（成功/エラー）
 */
interface ImportResult {
  success: boolean
  message: string
}
type NormalizedImportResult = ReturnType<typeof normalizeImportedTabsForImport>
type NormalizedImportedTab =
  NormalizedImportResult['normalizedImportedTabs'][number]
type UnresolvedImportTab = NormalizedImportResult['unresolvedTabs'][number]
const parseBackupData = (jsonData: string): BackupData | null => {
  const parsedData = JSON.parse(jsonData)
  const validationResult = backupDataSchema.safeParse(parsedData)
  if (!validationResult.success) {
    console.error('バリデーションエラー:', validationResult.error)
    return null
  }
  return validationResult.data as BackupData
}
const createImportedUrlRecordMap = (
  importedData: BackupData,
): Map<string, ImportedUrlRecordData> => {
  return new Map(
    (importedData.urls || []).map(urlRecord => [urlRecord.id, urlRecord]),
  )
}
const createCurrentUrlRecordMap = async (): Promise<Map<string, UrlRecord>> => {
  const currentUrlsData = await chrome.storage.local.get({
    urls: [],
  })
  const currentUrlRecords: UrlRecord[] = Array.isArray(currentUrlsData.urls)
    ? currentUrlsData.urls
    : []
  return new Map(currentUrlRecords.map(urlRecord => [urlRecord.id, urlRecord]))
}
const mergeUserSettings = (
  currentSettings: UserSettings,
  importedSettings: UserSettings,
): UserSettings => {
  return {
    ...currentSettings,
    ...importedSettings,
    excludePatterns: [
      ...new Set([
        ...currentSettings.excludePatterns,
        ...importedSettings.excludePatterns,
      ]),
    ],
  }
}
const normalizeImportedCategory = (
  category: ParentCategory,
): ParentCategory => {
  const { keywords, ...rest } = category as ParentCategory & {
    keywords?: string[]
  }
  return rest
}
const mergeParentCategoriesData = (
  currentCategories: ParentCategory[],
  importedCategories: ParentCategory[],
): ParentCategory[] => {
  const categoryMap = new Map<string, ParentCategory>()
  for (const category of currentCategories) {
    categoryMap.set(category.id, category)
  }
  for (const importedCategory of importedCategories) {
    const existing = categoryMap.get(importedCategory.id)
    if (!existing) {
      categoryMap.set(
        importedCategory.id,
        normalizeImportedCategory(importedCategory),
      )
      continue
    }
    categoryMap.set(importedCategory.id, {
      ...existing,
      name: importedCategory.name,
      domains: [...new Set([...existing.domains, ...importedCategory.domains])],
      domainNames: [
        ...new Set([...existing.domainNames, ...importedCategory.domainNames]),
      ],
    })
  }
  return Array.from(categoryMap.values())
}
const resolveImportedTabUrlData = async (
  importedTab: NormalizedImportedTab,
): Promise<ConvertedUrlData> => {
  const convertedUrlData = await convertImportedUrlsToNewFormat(
    importedTab.urls,
  )
  return resolveUrlDataForStorage(importedTab, convertedUrlData)
}
const resolveMergedSavedAt = (
  existingSavedAt?: number,
  importedSavedAt?: number,
): number | undefined => {
  if (existingSavedAt && importedSavedAt) {
    return Math.min(existingSavedAt, importedSavedAt)
  }
  return existingSavedAt || importedSavedAt
}
const buildMergedExistingDomainTab = async (
  existingTab: TabGroup,
  importedTab: NormalizedImportedTab,
): Promise<TabGroup> => {
  const resolvedUrlData = await resolveImportedTabUrlData(importedTab)
  const mergedUrlData = mergeUrlData(existingTab, resolvedUrlData)
  const mergedKeywords = mergeCategoryKeywords(
    existingTab.categoryKeywords,
    importedTab.categoryKeywords,
  )
  const mergedSubCategories = mergeSubCategories(
    existingTab.subCategories,
    importedTab.subCategories,
  )
  return {
    id: existingTab.id,
    domain: existingTab.domain,
    urlIds: mergedUrlData.urlIds,
    urlSubCategories: mergedUrlData.urlSubCategories,
    parentCategoryId:
      importedTab.parentCategoryId || existingTab.parentCategoryId,
    categoryKeywords: mergedKeywords,
    subCategories: mergedSubCategories,
    savedAt: resolveMergedSavedAt(existingTab.savedAt, importedTab.savedAt),
  }
}
const buildMergedNewDomainTab = async (
  importedTab: NormalizedImportedTab,
): Promise<TabGroup> => {
  const resolvedUrlData = await resolveImportedTabUrlData(importedTab)
  const normalizedKeywords = normalizeCategoryKeywords(
    importedTab.categoryKeywords,
  )
  const normalizedSubCategories = normalizeSubCategories(
    importedTab.subCategories,
  )
  return {
    id: importedTab.id,
    domain: importedTab.domain,
    urlIds: resolvedUrlData.urlIds,
    urlSubCategories: resolvedUrlData.urlSubCategories,
    parentCategoryId: importedTab.parentCategoryId,
    categoryKeywords: normalizedKeywords,
    subCategories: normalizedSubCategories,
    savedAt: importedTab.savedAt,
  }
}
const mergeTabsByDomain = async (
  currentTabs: TabGroup[],
  normalizedImportedTabs: NormalizedImportedTab[],
): Promise<TabGroup[]> => {
  const tabMapByDomain = new Map<string, TabGroup>()
  for (const tab of currentTabs) {
    tabMapByDomain.set(tab.domain, tab)
  }
  for (const importedTab of normalizedImportedTabs) {
    const existingTab = tabMapByDomain.get(importedTab.domain)
    if (existingTab) {
      console.log(`マージ処理: 既存ドメイン ${importedTab.domain}`)
      const mergedTab = await buildMergedExistingDomainTab(
        existingTab,
        importedTab,
      )
      tabMapByDomain.set(importedTab.domain, mergedTab)
      continue
    }
    console.log(`マージ処理: 新規ドメイン ${importedTab.domain}`)
    const newTab = await buildMergedNewDomainTab(importedTab)
    tabMapByDomain.set(importedTab.domain, newTab)
  }
  return Array.from(tabMapByDomain.values())
}
const buildOverwriteTabs = async (
  normalizedImportedTabs: NormalizedImportedTab[],
): Promise<TabGroup[]> => {
  return Promise.all(
    normalizedImportedTabs.map(async importedTab => {
      console.log(`上書きモード: ${importedTab.domain} を新形式に変換中...`)
      return buildMergedNewDomainTab(importedTab)
    }),
  )
}
const createUnresolvedWarning = async (
  unresolvedTabs: UnresolvedImportTab[],
): Promise<string> => {
  const placeholderCount = await ensurePlaceholderUrlRecords(unresolvedTabs)
  if (unresolvedTabs.length === 0) {
    return ''
  }
  return `（注意: ${unresolvedTabs.length}個のドメインでURL実体が欠損していたため、${placeholderCount}件の代替URLを生成しました）`
}
const countAddedCategories = (
  importedCategories: ParentCategory[],
  currentCategories: ParentCategory[],
): number => {
  return importedCategories.filter(
    imported => !currentCategories.some(current => current.id === imported.id),
  ).length
}
const countAddedDomains = (
  normalizedImportedTabs: NormalizedImportedTab[],
  currentTabs: TabGroup[],
): number => {
  const currentDomains = new Set(currentTabs.map(tab => tab.domain))
  return normalizedImportedTabs.filter(tab => !currentDomains.has(tab.domain))
    .length
}
const importWithMerge = async (
  importedData: BackupData,
  normalizedImportedTabs: NormalizedImportedTab[],
  unresolvedTabs: UnresolvedImportTab[],
): Promise<ImportResult> => {
  const [currentSettings, storageData] = await Promise.all([
    getUserSettings(),
    chrome.storage.local.get(['parentCategories', 'savedTabs']),
  ])
  const currentCategories: ParentCategory[] = Array.isArray(
    storageData.parentCategories,
  )
    ? storageData.parentCategories
    : []
  const currentTabs: TabGroup[] = Array.isArray(storageData.savedTabs)
    ? storageData.savedTabs
    : []
  const mergedSettings = mergeUserSettings(
    currentSettings,
    importedData.userSettings,
  )
  const mergedCategories = mergeParentCategoriesData(
    currentCategories,
    importedData.parentCategories,
  )
  const mergedTabs = await mergeTabsByDomain(
    currentTabs,
    normalizedImportedTabs,
  )
  await Promise.all([
    saveUserSettings(mergedSettings),
    saveParentCategories(mergedCategories),
    chrome.storage.local.set({
      savedTabs: mergedTabs,
    }),
  ])
  const unresolvedWarning = await createUnresolvedWarning(unresolvedTabs)
  const addedCategories = countAddedCategories(
    importedData.parentCategories,
    currentCategories,
  )
  const addedDomains = countAddedDomains(normalizedImportedTabs, currentTabs)
  console.log('マージ完了: 新形式URLデータで保存済み')
  return {
    success: true,
    message: `データをマージしました (${addedCategories}個のカテゴリと${addedDomains}個のドメインを追加)${unresolvedWarning}`,
  }
}
const importWithOverwrite = async (
  importedData: BackupData,
  normalizedImportedTabs: NormalizedImportedTab[],
  unresolvedTabs: UnresolvedImportTab[],
): Promise<ImportResult> => {
  const cleanParentCategories = importedData.parentCategories.map(
    normalizeImportedCategory,
  )
  const cleanTabGroups = await buildOverwriteTabs(normalizedImportedTabs)
  await Promise.all([
    saveUserSettings({
      ...defaultSettings,
      ...importedData.userSettings,
    }),
    saveParentCategories(cleanParentCategories),
    chrome.storage.local.set({
      savedTabs: cleanTabGroups,
    }),
  ])
  const unresolvedWarning = await createUnresolvedWarning(unresolvedTabs)
  await migrateToUrlsStorage()
  return {
    success: true,
    message: `設定とタブデータを置き換えました（バージョン: ${importedData.version}、作成日時: ${new Date(importedData.timestamp).toLocaleString()}）${unresolvedWarning}`,
  }
}
const importSettings = async (
  jsonData: string,
  mergeData = true, // デフォルトでマージを有効に
): Promise<{
  success: boolean
  message: string
}> => {
  try {
    await migrateToUrlsStorage()
    const importedData = parseBackupData(jsonData)
    if (!importedData) {
      return {
        success: false,
        message: 'インポートされたデータの形式が正しくありません',
      }
    }
    const importedUrlRecordMap = createImportedUrlRecordMap(importedData)
    const currentUrlRecordMap = await createCurrentUrlRecordMap()
    const { normalizedImportedTabs, unresolvedTabs } =
      normalizeImportedTabsForImport(
        importedData.savedTabs,
        importedUrlRecordMap,
        currentUrlRecordMap,
      )
    if (unresolvedTabs.length > 0) {
      console.warn(
        'URLデータ未解決ドメイン（代替URLを生成して継続）:',
        unresolvedTabs.map(tab => tab.domain).join(', '),
      )
    }
    if (mergeData) {
      return importWithMerge(
        importedData,
        normalizedImportedTabs,
        unresolvedTabs,
      )
    }
    return importWithOverwrite(
      importedData,
      normalizedImportedTabs,
      unresolvedTabs,
    )
  } catch (error) {
    console.error('インポートエラー:', error)
    return {
      success: false,
      message: 'データのインポート中にエラーが発生しました',
    }
  }
}
export { downloadAsJson, exportSettings, importSettings }
export type { BackupData }
