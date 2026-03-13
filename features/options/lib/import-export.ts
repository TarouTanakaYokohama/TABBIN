import { z } from 'zod'
import { saveParentCategories } from '@/lib/storage/categories'
import { migrateToUrlsStorage } from '@/lib/storage/migration'
import { addUrlsToUncategorizedProject } from '@/lib/storage/projects'
import {
  defaultSettings,
  getUserSettings,
  saveUserSettings,
} from '@/lib/storage/settings'
import {
  createOrUpdateUrlRecord,
  createOrUpdateUrlRecordsBatch,
} from '@/lib/storage/urls'
import type {
  CustomProject,
  ParentCategory,
  ProjectKeywordSettings,
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
  customProjects?: CustomProject[]
  customProjectOrder?: string[]
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
interface ImportedCustomProjectData {
  id: string
  name: string
  projectKeywords?: {
    titleKeywords?: unknown[]
    urlKeywords?: unknown[]
    domainKeywords?: unknown[]
  }
  urlIds?: string[]
  urls?: Array<{
    url: string
    title?: string
    notes?: string
    savedAt?: number
    category?: string
  }>
  urlMetadata?: Record<
    string,
    {
      notes?: string
      category?: string
    }
  >
  categories?: unknown[]
  categoryOrder?: unknown[]
  createdAt?: number
  updatedAt?: number
}
interface ImportedCustomProjectUrlData {
  url: string
  title?: string
  notes?: string
  savedAt?: number
  category?: string
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
const BULK_URL_CONVERSION_THRESHOLD = 100
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
const importedCustomProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectKeywords: z
    .object({
      titleKeywords: z.array(z.unknown()).optional(),
      urlKeywords: z.array(z.unknown()).optional(),
      domainKeywords: z.array(z.unknown()).optional(),
    })
    .optional(),
  urlIds: z.array(z.string()).optional(),
  urls: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        notes: z.string().optional(),
        savedAt: z.number().optional(),
        category: z.string().optional(),
      }),
    )
    .optional(),
  urlMetadata: z
    .record(
      z.string(),
      z.object({
        notes: z.string().optional(),
        category: z.string().optional(),
      }),
    )
    .optional(),
  categories: z.array(z.unknown()).optional(),
  categoryOrder: z.array(z.unknown()).optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
})

const normalizeUrlKey = (url: string): string => url.trim()

const buildConvertedUrlData = (
  urls: ImportedUrlData[],
  resolveRecord: (urlData: ImportedUrlData) => UrlRecord | undefined,
): ConvertedUrlData => {
  const urlIds: string[] = []
  const urlSubCategories: Record<string, string> = {}
  for (const urlData of urls) {
    const urlRecord = resolveRecord(urlData)
    if (!urlRecord) {
      continue
    }
    urlIds.push(urlRecord.id)
    if (urlData.subCategory) {
      urlSubCategories[urlRecord.id] = urlData.subCategory
    }
  }
  return {
    urlIds,
    urlSubCategories:
      Object.keys(urlSubCategories).length > 0 ? urlSubCategories : undefined,
  }
}

const convertImportedUrlsWithPreloadedMap = (
  urls: ImportedUrlData[],
  urlRecordMapByUrl: Map<string, UrlRecord>,
): ConvertedUrlData => {
  return buildConvertedUrlData(urls, urlData =>
    urlRecordMapByUrl.get(normalizeUrlKey(urlData.url)),
  )
}

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
    aiChatEnabled: z.boolean().optional(),
    aiProvider: z.enum(['none', 'ollama']).optional(),
    ollamaModel: z.string().optional(),
    activeAiSystemPromptId: z.string().optional(),
    aiSystemPrompts: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          template: z.string(),
          createdAt: z.number(),
          updatedAt: z.number(),
        }),
      )
      .optional(),
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
  customProjects: z.array(importedCustomProjectSchema).optional(),
  customProjectOrder: z.array(z.string()).optional(),
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
  urlRecordMapByUrl?: Map<string, UrlRecord>,
): Promise<ConvertedUrlData> => {
  if (urlRecordMapByUrl) {
    return convertImportedUrlsWithPreloadedMap(urls, urlRecordMapByUrl)
  }

  const urlRecordMapByUrlFromSingleUpdate = new Map<string, UrlRecord>()
  for (const urlData of urls) {
    try {
      // URLレコードを作成または更新
      const urlRecord = await createOrUpdateUrlRecord(
        urlData.url,
        urlData.title || '',
        urlData.favIconUrl,
      )
      urlRecordMapByUrlFromSingleUpdate.set(
        normalizeUrlKey(urlData.url),
        urlRecord,
      )
      console.log(`URL変換完了: ${urlData.url} -> ${urlRecord.id}`)
    } catch (error) {
      console.error(`URL変換エラー: ${urlData.url}`, error)
    }
  }
  return convertImportedUrlsWithPreloadedMap(
    urls,
    urlRecordMapByUrlFromSingleUpdate,
  )
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

const normalizeStringArray = (items: unknown[] | undefined): string[] => {
  if (!Array.isArray(items)) {
    return []
  }
  const values: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (typeof item !== 'string' || seen.has(item)) {
      continue
    }
    seen.add(item)
    values.push(item)
  }
  return values
}

const normalizeProjectKeywords = (
  projectKeywords: ImportedCustomProjectData['projectKeywords'],
): ProjectKeywordSettings => ({
  titleKeywords: normalizeStringArray(projectKeywords?.titleKeywords),
  urlKeywords: normalizeStringArray(projectKeywords?.urlKeywords),
  domainKeywords: normalizeStringArray(projectKeywords?.domainKeywords),
})

const normalizeImportedCustomProject = (
  project: ImportedCustomProjectData,
): CustomProject => {
  const createdAt = project.createdAt || Date.now()
  const updatedAt = project.updatedAt || createdAt
  const urlIds = Array.isArray(project.urlIds)
    ? project.urlIds.filter((id): id is string => typeof id === 'string')
    : []
  const urls = Array.isArray(project.urls)
    ? project.urls
        .filter((item): item is NonNullable<CustomProject['urls']>[number] =>
          Boolean(item?.url),
        )
        .map(item => ({
          url: item.url,
          title: item.title || '',
          notes: item.notes,
          savedAt: item.savedAt,
          category: item.category,
        }))
    : undefined
  const urlMetadata =
    project.urlMetadata &&
    typeof project.urlMetadata === 'object' &&
    !Array.isArray(project.urlMetadata)
      ? project.urlMetadata
      : undefined
  const categories = normalizeStringArray(project.categories)
  const categoryOrder = normalizeStringArray(project.categoryOrder)

  return {
    id: project.id,
    name: project.name,
    projectKeywords: normalizeProjectKeywords(project.projectKeywords),
    urlIds,
    ...(urls && urls.length > 0 ? { urls } : {}),
    ...(urlMetadata ? { urlMetadata } : {}),
    categories,
    ...(categoryOrder.length > 0 ? { categoryOrder } : {}),
    createdAt,
    updatedAt,
  }
}

const convertCustomProjectToExportUrls = (
  project: CustomProject,
  urlRecordMap: Map<string, UrlRecord>,
  placeholderUrlRecordMap: Map<string, UrlRecord>,
): NonNullable<CustomProject['urls']> => {
  if (Array.isArray(project.urls) && project.urls.length > 0) {
    return project.urls.filter(
      (item): item is NonNullable<CustomProject['urls']>[number] =>
        Boolean(item?.url),
    )
  }
  if (!Array.isArray(project.urlIds) || project.urlIds.length === 0) {
    return []
  }

  const exportedUrls: NonNullable<CustomProject['urls']> = []
  let offset = 0

  for (const urlId of project.urlIds) {
    const urlRecord =
      urlRecordMap.get(urlId) || placeholderUrlRecordMap.get(urlId)
    const resolvedUrlRecord = urlRecord || {
      id: urlId,
      url: `https://tabbin.invalid/#tabbin-export-custom-missing-${project.id}-${urlId}`,
      title: '復元データ（元URL欠損）',
      savedAt:
        typeof project.updatedAt === 'number'
          ? project.updatedAt + offset
          : Date.now() + offset,
    }
    if (!(urlRecord || placeholderUrlRecordMap.has(urlId))) {
      placeholderUrlRecordMap.set(urlId, resolvedUrlRecord)
    }
    offset += 1
    exportedUrls.push({
      url: resolvedUrlRecord.url,
      title: resolvedUrlRecord.title || '',
      notes: project.urlMetadata?.[urlId]?.notes,
      savedAt: resolvedUrlRecord.savedAt,
      category: project.urlMetadata?.[urlId]?.category,
    })
  }

  return exportedUrls
}

const toExportCustomProject = (
  project: CustomProject,
  urlRecordMap: Map<string, UrlRecord>,
  placeholderUrlRecordMap: Map<string, UrlRecord>,
): CustomProject => {
  const exportUrls = convertCustomProjectToExportUrls(
    project,
    urlRecordMap,
    placeholderUrlRecordMap,
  )

  return {
    id: project.id,
    name: project.name,
    projectKeywords: normalizeProjectKeywords(project.projectKeywords),
    urls: exportUrls,
    categories: [...project.categories],
    ...(project.categoryOrder && project.categoryOrder.length > 0
      ? { categoryOrder: [...project.categoryOrder] }
      : {}),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

const normalizeCustomProjectOrder = (
  order: string[] | undefined,
  projects: CustomProject[],
): string[] => {
  const existingIds = new Set(projects.map(project => project.id))
  const normalizedOrder = Array.isArray(order)
    ? order.filter(id => typeof id === 'string' && existingIds.has(id))
    : []
  const missingIds = projects
    .map(project => project.id)
    .filter(id => !normalizedOrder.includes(id))
  return [...normalizedOrder, ...missingIds]
}

const mergeImportedCustomProjects = (
  currentProjects: CustomProject[],
  currentOrder: string[],
  importedProjects: CustomProject[],
  importedOrder: string[] | undefined,
): {
  customProjects: CustomProject[]
  customProjectOrder: string[]
} => {
  const normalizedCurrentProjects = currentProjects.map(project =>
    normalizeImportedCustomProject(project),
  )
  const normalizedImportedProjects = importedProjects.map(project =>
    normalizeImportedCustomProject(project),
  )
  const currentIds = new Set(
    normalizedCurrentProjects.map(project => project.id),
  )
  const newProjects = normalizedImportedProjects.filter(
    project => !currentIds.has(project.id),
  )
  const mergedProjects = [...normalizedCurrentProjects, ...newProjects]
  const normalizedCurrentOrder = normalizeCustomProjectOrder(
    currentOrder,
    normalizedCurrentProjects,
  )
  const normalizedImportedOrder = normalizeCustomProjectOrder(
    importedOrder,
    normalizedImportedProjects,
  )
  const appendedImportedIds = normalizedImportedOrder.filter(id =>
    newProjects.some(project => project.id === id),
  )
  const remainingIds = newProjects
    .map(project => project.id)
    .filter(id => !appendedImportedIds.includes(id))

  return {
    customProjects: mergedProjects,
    customProjectOrder: [
      ...normalizedCurrentOrder,
      ...appendedImportedIds,
      ...remainingIds,
    ],
  }
}

const overwriteImportedCustomProjects = (
  importedProjects: CustomProject[],
  importedOrder: string[] | undefined,
): {
  customProjects: CustomProject[]
  customProjectOrder: string[]
} => {
  const customProjects = importedProjects.map(project =>
    normalizeImportedCustomProject(project),
  )
  return {
    customProjects,
    customProjectOrder: normalizeCustomProjectOrder(
      importedOrder,
      customProjects,
    ),
  }
}

const restoreImportedCustomProjectUrlsFromIds = (
  project: ImportedCustomProjectData,
  importedUrlRecordMap: Map<string, ImportedUrlRecordData>,
  currentUrlRecordMap: Map<string, UrlRecord>,
): ImportedCustomProjectUrlData[] => {
  if (!Array.isArray(project.urlIds) || project.urlIds.length === 0) {
    return []
  }

  const restoredUrls: ImportedCustomProjectUrlData[] = []
  for (const urlId of project.urlIds) {
    const urlRecord =
      importedUrlRecordMap.get(urlId) || currentUrlRecordMap.get(urlId)
    if (!urlRecord) {
      continue
    }
    restoredUrls.push({
      url: urlRecord.url,
      title: urlRecord.title || '',
      savedAt: urlRecord.savedAt,
      notes: project.urlMetadata?.[urlId]?.notes,
      category: project.urlMetadata?.[urlId]?.category,
    })
  }
  return restoredUrls
}

const normalizeImportedCustomProjectsForImport = (
  projects: ImportedCustomProjectData[] | undefined,
  importedUrlRecordMap: Map<string, ImportedUrlRecordData>,
  currentUrlRecordMap: Map<string, UrlRecord>,
): Array<
  ImportedCustomProjectData & { urls: ImportedCustomProjectUrlData[] }
> => {
  if (!Array.isArray(projects)) {
    return []
  }

  return projects.map(project => {
    if (Array.isArray(project.urls)) {
      return {
        ...project,
        urls: project.urls.filter(
          (item): item is ImportedCustomProjectUrlData => Boolean(item?.url),
        ),
      }
    }

    return {
      ...project,
      urls: restoreImportedCustomProjectUrlsFromIds(
        project,
        importedUrlRecordMap,
        currentUrlRecordMap,
      ),
    }
  })
}

const convertImportedCustomProjectUrlsToStorage = async (
  urls: ImportedCustomProjectUrlData[],
  urlRecordMapByUrl?: Map<string, UrlRecord>,
): Promise<{
  urlIds: string[]
  urlMetadata?: CustomProject['urlMetadata']
}> => {
  const urlIds: string[] = []
  const urlMetadata: NonNullable<CustomProject['urlMetadata']> = {}

  for (const urlData of urls) {
    try {
      const normalizedUrl = normalizeUrlKey(urlData.url)
      const preloadedUrlRecord = urlRecordMapByUrl?.get(normalizedUrl)
      const urlRecord =
        preloadedUrlRecord ||
        (await createOrUpdateUrlRecord(urlData.url, urlData.title || ''))
      urlIds.push(urlRecord.id)
      if (urlData.notes || urlData.category) {
        urlMetadata[urlRecord.id] = {
          ...(urlData.notes ? { notes: urlData.notes } : {}),
          ...(urlData.category ? { category: urlData.category } : {}),
        }
      }
    } catch (error) {
      console.error(`カスタムプロジェクトURL変換エラー: ${urlData.url}`, error)
    }
  }

  return {
    urlIds,
    urlMetadata: Object.keys(urlMetadata).length > 0 ? urlMetadata : undefined,
  }
}

const resolveImportedCustomProject = async (
  project: ImportedCustomProjectData & {
    urls: ImportedCustomProjectUrlData[]
  },
  urlRecordMapByUrl?: Map<string, UrlRecord>,
): Promise<CustomProject> => {
  const categoryOrder = normalizeStringArray(project.categoryOrder)

  if (project.urls.length === 0 && Array.isArray(project.urlIds)) {
    return {
      ...normalizeImportedCustomProject(project),
      ...(categoryOrder.length > 0 ? { categoryOrder } : {}),
    }
  }

  const convertedUrlData = await convertImportedCustomProjectUrlsToStorage(
    project.urls,
    urlRecordMapByUrl,
  )

  return {
    id: project.id,
    name: project.name,
    projectKeywords: normalizeProjectKeywords(project.projectKeywords),
    urlIds: convertedUrlData.urlIds,
    ...(convertedUrlData.urlMetadata
      ? { urlMetadata: convertedUrlData.urlMetadata }
      : {}),
    categories: normalizeStringArray(project.categories),
    ...(categoryOrder.length > 0 ? { categoryOrder } : {}),
    createdAt: project.createdAt || Date.now(),
    updatedAt: project.updatedAt || project.createdAt || Date.now(),
  }
}

const resolveImportedCustomProjects = async (
  projects: Array<
    ImportedCustomProjectData & { urls: ImportedCustomProjectUrlData[] }
  >,
  urlRecordMapByUrl?: Map<string, UrlRecord>,
): Promise<CustomProject[]> => {
  return Promise.all(
    projects.map(project =>
      resolveImportedCustomProject(project, urlRecordMapByUrl),
    ),
  )
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
        customProjectOrder: [],
        customProjects: [],
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
    const storedCustomProjects: CustomProject[] = Array.isArray(
      storageData.customProjects,
    )
      ? storageData.customProjects.map(project =>
          normalizeImportedCustomProject(project),
        )
      : []
    const customProjectOrder = Array.isArray(storageData.customProjectOrder)
      ? storageData.customProjectOrder.filter(
          (id): id is string => typeof id === 'string',
        )
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
    const customProjects = storedCustomProjects.map(project =>
      toExportCustomProject(project, urlRecordMap, placeholderUrlRecordMap),
    )
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
      customProjects,
      customProjectOrder: normalizeCustomProjectOrder(
        customProjectOrder,
        customProjects,
      ),
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
  urlRecordMapByUrl?: Map<string, UrlRecord>,
): Promise<ConvertedUrlData> => {
  const convertedUrlData = await convertImportedUrlsToNewFormat(
    importedTab.urls,
    urlRecordMapByUrl,
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
  urlRecordMapByUrl?: Map<string, UrlRecord>,
): Promise<TabGroup> => {
  const resolvedUrlData = await resolveImportedTabUrlData(
    importedTab,
    urlRecordMapByUrl,
  )
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
  urlRecordMapByUrl?: Map<string, UrlRecord>,
): Promise<TabGroup> => {
  const resolvedUrlData = await resolveImportedTabUrlData(
    importedTab,
    urlRecordMapByUrl,
  )
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
  urlRecordMapByUrl?: Map<string, UrlRecord>,
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
        urlRecordMapByUrl,
      )
      tabMapByDomain.set(importedTab.domain, mergedTab)
      continue
    }
    console.log(`マージ処理: 新規ドメイン ${importedTab.domain}`)
    const newTab = await buildMergedNewDomainTab(importedTab, urlRecordMapByUrl)
    tabMapByDomain.set(importedTab.domain, newTab)
  }
  return Array.from(tabMapByDomain.values())
}
const buildOverwriteTabs = async (
  normalizedImportedTabs: NormalizedImportedTab[],
  urlRecordMapByUrl?: Map<string, UrlRecord>,
): Promise<TabGroup[]> => {
  return Promise.all(
    normalizedImportedTabs.map(async importedTab => {
      console.log(`上書きモード: ${importedTab.domain} を新形式に変換中...`)
      return buildMergedNewDomainTab(importedTab, urlRecordMapByUrl)
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
const buildBulkUrlRecordMap = async (
  normalizedImportedTabs: NormalizedImportedTab[],
  normalizedImportedCustomProjects: Array<
    ImportedCustomProjectData & { urls: ImportedCustomProjectUrlData[] }
  >,
): Promise<Map<string, UrlRecord> | undefined> => {
  const importedUrlItems = [
    ...normalizedImportedTabs.flatMap(tab =>
      tab.urls.map(urlData => ({
        url: normalizeUrlKey(urlData.url),
        title: urlData.title || '',
        favIconUrl: urlData.favIconUrl,
      })),
    ),
    ...normalizedImportedCustomProjects.flatMap(project =>
      project.urls.map(urlData => ({
        url: normalizeUrlKey(urlData.url),
        title: urlData.title || '',
      })),
    ),
  ]
  const shouldBatchCustomProjectUrls = normalizedImportedCustomProjects.some(
    project => project.urls.length > 0,
  )
  if (
    !shouldBatchCustomProjectUrls &&
    importedUrlItems.length < BULK_URL_CONVERSION_THRESHOLD
  ) {
    return undefined
  }
  console.log(`インポートURLを一括変換します: ${importedUrlItems.length}件`)
  return createOrUpdateUrlRecordsBatch(importedUrlItems)
}
const syncImportedTabsToCustomMode = async (
  normalizedImportedTabs: NormalizedImportedTab[],
): Promise<void> => {
  const savedTabItems = normalizedImportedTabs.flatMap(tab =>
    tab.urls
      .filter(urlData => Boolean(urlData.url))
      .map(urlData => ({
        url: urlData.url,
        title: urlData.title || '',
      })),
  )
  if (savedTabItems.length > 0) {
    try {
      await addUrlsToUncategorizedProject(savedTabItems)
    } catch (error) {
      console.error('カスタムモード同期エラー:', error)
    }
  }
}
const shouldImportCustomProjects = (importedData: BackupData): boolean => {
  return Array.isArray(importedData.customProjects)
}
interface ImportExecutionParams {
  importedData: BackupData
  normalizedImportedTabs: NormalizedImportedTab[]
  unresolvedTabs: UnresolvedImportTab[]
  resolvedImportedCustomProjects: CustomProject[]
  bulkUrlRecordMap?: Map<string, UrlRecord>
}
const importWithMerge = async ({
  importedData,
  normalizedImportedTabs,
  unresolvedTabs,
  resolvedImportedCustomProjects,
  bulkUrlRecordMap,
}: ImportExecutionParams): Promise<ImportResult> => {
  const [currentSettings, storageData] = await Promise.all([
    getUserSettings(),
    chrome.storage.local.get([
      'customProjectOrder',
      'customProjects',
      'parentCategories',
      'savedTabs',
    ]),
  ])
  const currentCategories: ParentCategory[] = Array.isArray(
    storageData.parentCategories,
  )
    ? storageData.parentCategories
    : []
  const currentTabs: TabGroup[] = Array.isArray(storageData.savedTabs)
    ? storageData.savedTabs
    : []
  const currentCustomProjects: CustomProject[] = Array.isArray(
    storageData.customProjects,
  )
    ? storageData.customProjects.map(project =>
        normalizeImportedCustomProject(project),
      )
    : []
  const currentCustomProjectOrder: string[] = Array.isArray(
    storageData.customProjectOrder,
  )
    ? storageData.customProjectOrder.filter(
        (id): id is string => typeof id === 'string',
      )
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
    bulkUrlRecordMap,
  )
  const mergedCustomProjectData = shouldImportCustomProjects(importedData)
    ? mergeImportedCustomProjects(
        currentCustomProjects,
        currentCustomProjectOrder,
        resolvedImportedCustomProjects,
        importedData.customProjectOrder,
      )
    : undefined
  await Promise.all([
    saveUserSettings(mergedSettings),
    saveParentCategories(mergedCategories),
    chrome.storage.local.set({
      ...(mergedCustomProjectData
        ? {
            customProjectOrder: mergedCustomProjectData.customProjectOrder,
            customProjects: mergedCustomProjectData.customProjects,
          }
        : {}),
      savedTabs: mergedTabs,
    }),
  ])
  if (!shouldImportCustomProjects(importedData)) {
    await syncImportedTabsToCustomMode(normalizedImportedTabs)
  }
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
const importWithOverwrite = async ({
  importedData,
  normalizedImportedTabs,
  unresolvedTabs,
  resolvedImportedCustomProjects,
  bulkUrlRecordMap,
}: ImportExecutionParams): Promise<ImportResult> => {
  const cleanParentCategories = importedData.parentCategories.map(
    normalizeImportedCategory,
  )
  const cleanTabGroups = await buildOverwriteTabs(
    normalizedImportedTabs,
    bulkUrlRecordMap,
  )
  const overwriteCustomProjectData = shouldImportCustomProjects(importedData)
    ? overwriteImportedCustomProjects(
        resolvedImportedCustomProjects,
        importedData.customProjectOrder,
      )
    : undefined
  await Promise.all([
    saveUserSettings({
      ...defaultSettings,
      ...importedData.userSettings,
    }),
    saveParentCategories(cleanParentCategories),
    chrome.storage.local.set({
      ...(overwriteCustomProjectData
        ? {
            customProjectOrder: overwriteCustomProjectData.customProjectOrder,
            customProjects: overwriteCustomProjectData.customProjects,
          }
        : {}),
      savedTabs: cleanTabGroups,
    }),
  ])
  if (!shouldImportCustomProjects(importedData)) {
    await syncImportedTabsToCustomMode(normalizedImportedTabs)
  }
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
    const normalizedImportedCustomProjects = shouldImportCustomProjects(
      importedData,
    )
      ? normalizeImportedCustomProjectsForImport(
          importedData.customProjects,
          importedUrlRecordMap,
          currentUrlRecordMap,
        )
      : []
    const bulkUrlRecordMap = await buildBulkUrlRecordMap(
      normalizedImportedTabs,
      normalizedImportedCustomProjects,
    )
    const resolvedImportedCustomProjects = shouldImportCustomProjects(
      importedData,
    )
      ? await resolveImportedCustomProjects(
          normalizedImportedCustomProjects,
          bulkUrlRecordMap,
        )
      : []
    if (unresolvedTabs.length > 0) {
      console.warn(
        'URLデータ未解決ドメイン（代替URLを生成して継続）:',
        unresolvedTabs.map(tab => tab.domain).join(', '),
      )
    }
    if (mergeData) {
      return importWithMerge({
        importedData,
        normalizedImportedTabs,
        unresolvedTabs,
        resolvedImportedCustomProjects,
        bulkUrlRecordMap,
      })
    }
    return importWithOverwrite({
      importedData,
      normalizedImportedTabs,
      unresolvedTabs,
      resolvedImportedCustomProjects,
      bulkUrlRecordMap,
    })
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
