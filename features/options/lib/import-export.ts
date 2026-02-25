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
export interface BackupData {
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
async function convertImportedUrlsToNewFormat(
  urls: ImportedUrlData[],
): Promise<ConvertedUrlData> {
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
function normalizeCategoryKeywords(
  keywords: unknown[] | undefined,
): SubCategoryKeyword[] {
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
function normalizeSubCategories(items: unknown[] | undefined): string[] {
  if (!Array.isArray(items)) {
    return []
  }

  const names: string[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const name =
      typeof item === 'string'
        ? item
        : typeof item === 'object' &&
            item !== null &&
            'name' in item &&
            typeof item.name === 'string'
          ? item.name
          : null

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
function mergeCategoryKeywords(
  existing: SubCategoryKeyword[] | undefined,
  imported: unknown[] | undefined,
): SubCategoryKeyword[] {
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
function mergeSubCategories(
  existing: unknown[] | undefined,
  imported: unknown[] | undefined,
): string[] {
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
function mergeUrlData(
  existingTab: TabGroup,
  importedUrlData: ConvertedUrlData,
): ConvertedUrlData {
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
function convertTabGroupToExportUrls(
  tab: TabGroup,
  urlRecordMap: Map<string, UrlRecord>,
  placeholderUrlRecordMap: Map<string, UrlRecord>,
): NonNullable<TabGroup['urls']> {
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
    if (!urlRecord && !placeholderUrlRecordMap.has(urlId)) {
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
function restoreImportedUrlsFromIds(
  tab: ImportedTabData,
  importedUrlRecordMap: Map<string, ImportedUrlRecordData>,
  currentUrlRecordMap: Map<string, UrlRecord>,
): ImportedUrlData[] {
  if (!Array.isArray(tab.urlIds) || tab.urlIds.length === 0) {
    return []
  }

  const restoredUrls: ImportedUrlData[] = []

  for (const urlId of tab.urlIds) {
    const urlRecord =
      importedUrlRecordMap.get(urlId) || currentUrlRecordMap.get(urlId)
    if (!urlRecord) continue

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

/**
 * 変換結果が空のときは、インポート元のurlIdsをそのまま保持して復元性を高める
 */
function resolveUrlDataForStorage(
  tab: ImportedTabData & { urls: ImportedUrlData[] },
  convertedUrlData: {
    urlIds: string[]
    urlSubCategories?: Record<string, string>
  },
): { urlIds: string[]; urlSubCategories?: Record<string, string> } {
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
async function ensurePlaceholderUrlRecords(
  unresolvedTabs: Array<{
    domain: string
    urlIds: string[]
    savedAt?: number
  }>,
): Promise<number> {
  if (unresolvedTabs.length === 0) {
    return 0
  }

  const urlsData = await chrome.storage.local.get({ urls: [] })
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
export const exportSettings = async (): Promise<BackupData> => {
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
export const downloadAsJson = (data: BackupData, filename: string): void => {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
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
export const importSettings = async (
  jsonData: string,
  mergeData = true, // デフォルトでマージを有効に
): Promise<{ success: boolean; message: string }> => {
  try {
    // まずマイグレーションを実行（既存データがある場合）
    await migrateToUrlsStorage()

    // JSON形式をパース
    const parsedData = JSON.parse(jsonData)

    // スキーマバリデーション
    const validationResult = backupDataSchema.safeParse(parsedData)

    if (!validationResult.success) {
      console.error('バリデーションエラー:', validationResult.error)
      return {
        success: false,
        message: 'インポートされたデータの形式が正しくありません',
      }
    }

    // バリデーション成功時はデータを適用
    const importedData = validationResult.data
    const importedUrlRecordMap = new Map(
      (importedData.urls || []).map(urlRecord => [urlRecord.id, urlRecord]),
    )
    const currentUrlsData = await chrome.storage.local.get({ urls: [] })
    const currentUrlRecords: UrlRecord[] = Array.isArray(currentUrlsData.urls)
      ? currentUrlsData.urls
      : []
    const currentUrlRecordMap = new Map(
      currentUrlRecords.map(urlRecord => [urlRecord.id, urlRecord]),
    )

    const unresolvedTabs: Array<{
      domain: string
      urlIds: string[]
      savedAt?: number
    }> = []
    const normalizedImportedTabs: Array<
      ImportedTabData & { urls: ImportedUrlData[] }
    > = importedData.savedTabs.map(tab => {
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

    if (unresolvedTabs.length > 0) {
      console.warn(
        'URLデータ未解決ドメイン（代替URLを生成して継続）:',
        unresolvedTabs.map(tab => tab.domain).join(', '),
      )
    }

    if (mergeData) {
      // === マージモード: 既存データと新データをマージ ===

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

      // 1. 現在のユーザー設定を取得してマージ
      const mergedSettings: UserSettings = {
        ...currentSettings,
        ...importedData.userSettings,
        // 配列はマージして重複を排除
        excludePatterns: [
          ...new Set([
            ...currentSettings.excludePatterns,
            ...importedData.userSettings.excludePatterns,
          ]),
        ],
      }

      // 2. 親カテゴリをマージ - keywordsプロパティを削除
      const categoryMap = new Map<string, ParentCategory>()

      // 既存のカテゴリをMapに追加
      for (const category of currentCategories) {
        categoryMap.set(category.id, category)
      }

      // インポートされたカテゴリを追加/更新
      for (const importedCategory of importedData.parentCategories) {
        const existing = categoryMap.get(importedCategory.id)
        if (existing) {
          // 既存のカテゴリを更新 - ドメインはマージ
          // keywordsプロパティは無視して型に合わせる
          categoryMap.set(importedCategory.id, {
            ...existing,
            name: importedCategory.name,
            domains: [
              ...new Set([...existing.domains, ...importedCategory.domains]),
            ],
            domainNames: [
              ...new Set([
                ...existing.domainNames,
                ...importedCategory.domainNames,
              ]),
            ],
            // keywords は ParentCategory 型に含まれないので除外
          })
        } else {
          // 新しいカテゴリを追加
          const { keywords, ...categoryWithoutKeywords } = importedCategory
          categoryMap.set(importedCategory.id, categoryWithoutKeywords)
        }
      }

      // マージされたカテゴリの配列を作成
      const mergedCategories = Array.from(categoryMap.values())

      // 3. タブデータをマージ - ID ではなく、ドメイン名をキーとして使用するように変更

      // ドメイン名をキーとするマップを作成
      const tabMapByDomain = new Map<string, TabGroup>()

      // 既存のタブをドメイン名をキーとしてMapに追加
      for (const tab of currentTabs) {
        tabMapByDomain.set(tab.domain, tab)
      }

      // インポートされたタブをマージ
      for (const importedTab of normalizedImportedTabs) {
        const existingTab = tabMapByDomain.get(importedTab.domain)

        if (existingTab) {
          // 同じドメインが既に存在する場合、URLをマージ（重複を避ける）
          console.log(`マージ処理: 既存ドメイン ${importedTab.domain}`)

          // インポートされたURLを新形式に変換
          const convertedUrlData = await convertImportedUrlsToNewFormat(
            importedTab.urls,
          )
          const resolvedUrlData = resolveUrlDataForStorage(
            importedTab,
            convertedUrlData,
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

          // 既存のタブを新形式で更新
          tabMapByDomain.set(importedTab.domain, {
            // 既存のIDを保持して一貫性を確保
            id: existingTab.id,
            domain: existingTab.domain,
            // 新形式のURL管理
            urlIds: mergedUrlData.urlIds,
            urlSubCategories: mergedUrlData.urlSubCategories,
            // 旧形式のurlsプロパティは削除（新形式のみ使用）
            // インポートされたタブに親カテゴリIDがあれば優先、なければ既存を使用
            parentCategoryId:
              importedTab.parentCategoryId || existingTab.parentCategoryId,
            categoryKeywords: mergedKeywords,
            subCategories: mergedSubCategories,
            // タイムスタンプは古い方（より小さい方）を優先
            savedAt:
              existingTab.savedAt && importedTab.savedAt
                ? Math.min(existingTab.savedAt, importedTab.savedAt)
                : existingTab.savedAt || importedTab.savedAt,
          })
        } else {
          // 新しいドメインの場合は、新形式でタブグループを追加
          console.log(`マージ処理: 新規ドメイン ${importedTab.domain}`)

          // インポートされたURLを新形式に変換
          const convertedUrlData = await convertImportedUrlsToNewFormat(
            importedTab.urls,
          )
          const resolvedUrlData = resolveUrlDataForStorage(
            importedTab,
            convertedUrlData,
          )
          const normalizedKeywords = normalizeCategoryKeywords(
            importedTab.categoryKeywords,
          )
          const normalizedSubCategories = normalizeSubCategories(
            importedTab.subCategories,
          )

          // 新しいタブグループを新形式で作成
          tabMapByDomain.set(importedTab.domain, {
            id: importedTab.id,
            domain: importedTab.domain,
            // 新形式のURL管理
            urlIds: resolvedUrlData.urlIds,
            urlSubCategories: resolvedUrlData.urlSubCategories,
            // 旧形式のurlsプロパティは使用しない
            parentCategoryId: importedTab.parentCategoryId,
            categoryKeywords: normalizedKeywords,
            subCategories: normalizedSubCategories,
            savedAt: importedTab.savedAt,
          })
        }
      }

      // マージされたタブの配列を作成
      const mergedTabs = Array.from(tabMapByDomain.values())

      // データを保存
      await Promise.all([
        saveUserSettings(mergedSettings),
        saveParentCategories(mergedCategories),
        chrome.storage.local.set({ savedTabs: mergedTabs }),
      ])

      const placeholderCount = await ensurePlaceholderUrlRecords(unresolvedTabs)
      const unresolvedWarning =
        unresolvedTabs.length > 0
          ? `（注意: ${unresolvedTabs.length}個のドメインでURL実体が欠損していたため、${placeholderCount}件の代替URLを生成しました）`
          : ''

      // 新形式に変換済みのためマイグレーション不要
      console.log('マージ完了: 新形式URLデータで保存済み')

      // 追加された項目の数をカウント
      const addedCategories = importedData.parentCategories.filter(
        cat => !currentCategories.some((c: ParentCategory) => c.id === cat.id),
      ).length

      // 追加された新しいドメイン数をカウント
      const currentDomains = new Set(
        currentTabs.map((tab: TabGroup) => tab.domain),
      )
      const addedDomains = normalizedImportedTabs.filter(
        tab => !currentDomains.has(tab.domain),
      ).length

      return {
        success: true,
        message: `データをマージしました (${addedCategories}個のカテゴリと${addedDomains}個のドメインを追加)${unresolvedWarning}`,
      }
    }

    // === 上書きモード: 完全に置き換え ===
    // else句を削除（elseの代わりに直接コードを続ける）

    // データの型変換を行ってから保存する

    // 1. 親カテゴリからkeywordsプロパティを削除
    const cleanParentCategories: ParentCategory[] =
      importedData.parentCategories.map(category => {
        // スプレッド構文と分割代入で不要なプロパティを除外
        const { keywords, ...rest } = category
        return rest
      })

    // 2. タブグループのURLsを新形式に変換
    const cleanTabGroups: TabGroup[] = await Promise.all(
      normalizedImportedTabs.map(async tab => {
        console.log(`上書きモード: ${tab.domain} を新形式に変換中...`)

        // URLsを新形式に変換
        const convertedUrlData = await convertImportedUrlsToNewFormat(tab.urls)
        const resolvedUrlData = resolveUrlDataForStorage(tab, convertedUrlData)
        const convertedKeywords = normalizeCategoryKeywords(
          tab.categoryKeywords,
        )
        const convertedSubCategories = normalizeSubCategories(tab.subCategories)

        return {
          id: tab.id,
          domain: tab.domain,
          // 新形式のURL管理
          urlIds: resolvedUrlData.urlIds,
          urlSubCategories: resolvedUrlData.urlSubCategories,
          // 旧形式のurlsプロパティは使用しない
          parentCategoryId: tab.parentCategoryId,
          subCategories: convertedSubCategories,
          categoryKeywords: convertedKeywords,
          savedAt: tab.savedAt,
        }
      }),
    )

    await Promise.all([
      saveUserSettings({ ...defaultSettings, ...importedData.userSettings }),
      saveParentCategories(cleanParentCategories),
      chrome.storage.local.set({ savedTabs: cleanTabGroups }),
    ])

    const placeholderCount = await ensurePlaceholderUrlRecords(unresolvedTabs)
    const unresolvedWarning =
      unresolvedTabs.length > 0
        ? `（注意: ${unresolvedTabs.length}個のドメインでURL実体が欠損していたため、${placeholderCount}件の代替URLを生成しました）`
        : ''

    // インポート後にマイグレーションを実行（旧形式データがインポートされた場合に対応）
    await migrateToUrlsStorage()

    return {
      success: true,
      message: `設定とタブデータを置き換えました（バージョン: ${importedData.version}、作成日時: ${new Date(importedData.timestamp).toLocaleString()}）${unresolvedWarning}`,
    }
  } catch (error) {
    console.error('インポートエラー:', error)
    return {
      success: false,
      message: 'データのインポート中にエラーが発生しました',
    }
  }
}
