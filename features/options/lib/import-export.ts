import {
  defaultSettings,
  getUserSettings,
  saveParentCategories,
  saveUserSettings,
} from '@/lib/storage'
import { migrateToUrlsStorage } from '@/lib/storage/migration'
import { createOrUpdateUrlRecord } from '@/lib/storage/urls'
import type {
  ParentCategory,
  SubCategoryKeyword,
  TabGroup,
  UserSettings,
} from '@/types/storage'
import { z } from 'zod'

// バックアップデータの型定義
export interface BackupData {
  version: string
  timestamp: string
  userSettings: UserSettings
  parentCategories: ParentCategory[]
  savedTabs: TabGroup[]
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

// インポート時のカテゴリキーワード形式に対応するインターフェース
interface ImportedKeywordData {
  categoryName: string // 必須プロパティに変更
  keywords?: string[] // オプショナルのままにする
  [key: string]: unknown // その他の可能性のあるプロパティ
}

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
      urls: z.array(
        z.object({
          url: z.string(),
          title: z.string().optional(),
          favIconUrl: z.string().optional(),
          timestamp: z.number().optional(),
          tabId: z.number().optional(),
          // インポート用に他のプロパティも許可
          subCategory: z.string().optional(),
          savedAt: z.number().optional(),
        }),
      ),
      parentCategoryId: z.string().optional(),
      subCategories: z.array(z.unknown()).optional(),
      categoryKeywords: z.array(z.unknown()).optional(),
      savedAt: z.number().optional(),
    }),
  ),
})

/**
 * インポートされたURLデータを新形式に変換する
 * @param urls インポートされたURL配列
 * @returns 新形式のTabGroup（urlIdsとurlSubCategoriesを含む）
 */
async function convertImportedUrlsToNewFormat(
  urls: ImportedUrlData[],
): Promise<{ urlIds: string[]; urlSubCategories?: Record<string, string> }> {
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
 * 現在の設定とタブデータをエクスポートする
 * @returns エクスポートされたデータを含むJSONオブジェクト
 */
export const exportSettings = async (): Promise<BackupData> => {
  try {
    // 現在のユーザー設定を取得
    const userSettings = await getUserSettings()

    // ローカルストレージからカテゴリとタブデータを取得
    const { parentCategories = [], savedTabs = [] } =
      await chrome.storage.local.get(['parentCategories', 'savedTabs'])

    // バックアップデータを作成
    const backupData: BackupData = {
      version: chrome.runtime.getManifest().version || '1.0.0',
      timestamp: new Date().toISOString(),
      userSettings,
      parentCategories,
      savedTabs,
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

    if (mergeData) {
      // === マージモード: 既存データと新データをマージ ===

      // 1. 現在のユーザー設定を取得してマージ
      const currentSettings = await getUserSettings()
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
      const { parentCategories: currentCategories = [] } =
        await chrome.storage.local.get('parentCategories')
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
      const { savedTabs: currentTabs = [] } =
        await chrome.storage.local.get('savedTabs')

      // ドメイン名をキーとするマップを作成
      const tabMapByDomain = new Map<string, TabGroup>()

      // 既存のタブをドメイン名をキーとしてMapに追加
      for (const tab of currentTabs) {
        tabMapByDomain.set(tab.domain, tab)
      }

      // インポートされたタブをマージ
      for (const importedTab of importedData.savedTabs) {
        const existingTab = tabMapByDomain.get(importedTab.domain)

        if (existingTab) {
          // 同じドメインが既に存在する場合、URLをマージ（重複を避ける）
          console.log(`マージ処理: 既存ドメイン ${importedTab.domain}`)

          // インポートされたURLを新形式に変換
          const convertedUrlData = await convertImportedUrlsToNewFormat(
            importedTab.urls,
          )

          // カテゴリキーワードの変換 - 適切な型に変換
          const convertCategoryKeywords = (
            keywords: unknown[] | undefined,
          ): SubCategoryKeyword[] => {
            if (!keywords) return []
            return keywords
              .filter(
                (k): k is ImportedKeywordData =>
                  typeof k === 'object' &&
                  k !== null &&
                  'categoryName' in k &&
                  typeof k.categoryName === 'string',
              )
              .map(k => {
                // k の型を明示的に拡張して keywords プロパティへのアクセスを安全にする
                const keywordData = k as {
                  categoryName: string
                  keywords?: unknown
                }
                return {
                  categoryName: k.categoryName,
                  // keywords プロパティが配列かどうか安全にチェック
                  keywords: Array.isArray(keywordData.keywords)
                    ? keywordData.keywords
                    : [],
                }
              })
          }

          // 新形式でのURLマージ処理
          const mergedUrlIds = [...(existingTab.urlIds || [])]
          const mergedUrlSubCategories = {
            ...(existingTab.urlSubCategories || {}),
          }

          // インポートされたURLIDsを重複チェックしてマージ
          for (const urlId of convertedUrlData.urlIds) {
            if (!mergedUrlIds.includes(urlId)) {
              mergedUrlIds.push(urlId)
            }
          }

          // サブカテゴリ情報をマージ
          if (convertedUrlData.urlSubCategories) {
            Object.assign(
              mergedUrlSubCategories,
              convertedUrlData.urlSubCategories,
            )
          }

          // categoryKeywordsをマージ
          const existingKeywords = existingTab.categoryKeywords || []
          const importedKeywords = convertCategoryKeywords(
            importedTab.categoryKeywords,
          )

          // カテゴリ名でキーワードをマージ
          const keywordMap = new Map<string, SubCategoryKeyword>()
          for (const k of existingKeywords) {
            keywordMap.set(k.categoryName, k)
          }

          for (const k of importedKeywords) {
            if (keywordMap.has(k.categoryName)) {
              // 既存のキーワードとマージ
              const existingItem = keywordMap.get(k.categoryName)
              if (existingItem) {
                // k の型を明示的にキャスト
                const keywordData = k as {
                  categoryName: string
                  keywords?: string[]
                }
                keywordMap.set(k.categoryName, {
                  categoryName: k.categoryName,
                  keywords: [
                    ...new Set([
                      ...existingItem.keywords,
                      ...(Array.isArray(keywordData.keywords)
                        ? keywordData.keywords
                        : []),
                    ]),
                  ],
                })
              }
            } else {
              keywordMap.set(k.categoryName, k)
            }
          }

          // サブカテゴリの型安全変換
          const mergeSubCategories = (
            existing: unknown[] | undefined,
            imported: unknown[] | undefined,
          ): string[] => {
            const result: string[] = []
            const nameSet = new Set<string>()

            // 既存のサブカテゴリを追加
            if (existing && Array.isArray(existing)) {
              for (const item of existing) {
                // オブジェクトでnameプロパティがある場合
                if (
                  typeof item === 'object' &&
                  item !== null &&
                  'name' in item &&
                  typeof item.name === 'string'
                ) {
                  if (!nameSet.has(item.name)) {
                    nameSet.add(item.name)
                    result.push(item.name)
                  }
                }
                // 文字列の場合
                else if (typeof item === 'string') {
                  if (!nameSet.has(item)) {
                    nameSet.add(item)
                    result.push(item)
                  }
                }
              }
            }

            // インポートされたサブカテゴリを追加
            if (imported && Array.isArray(imported)) {
              for (const item of imported) {
                // オブジェクトでnameプロパティがある場合
                if (
                  typeof item === 'object' &&
                  item !== null &&
                  'name' in item &&
                  typeof item.name === 'string'
                ) {
                  if (!nameSet.has(item.name)) {
                    nameSet.add(item.name)
                    result.push(item.name)
                  }
                }
                // 文字列の場合
                else if (typeof item === 'string') {
                  if (!nameSet.has(item)) {
                    nameSet.add(item)
                    result.push(item)
                  }
                }
              }
            }

            return result
          }

          // 既存のタブを新形式で更新
          tabMapByDomain.set(importedTab.domain, {
            // 既存のIDを保持して一貫性を確保
            id: existingTab.id,
            domain: existingTab.domain,
            // 新形式のURL管理
            urlIds: mergedUrlIds,
            urlSubCategories:
              Object.keys(mergedUrlSubCategories).length > 0
                ? mergedUrlSubCategories
                : undefined,
            // 旧形式のurlsプロパティは削除（新形式のみ使用）
            // インポートされたタブに親カテゴリIDがあれば優先、なければ既存を使用
            parentCategoryId:
              importedTab.parentCategoryId || existingTab.parentCategoryId,
            categoryKeywords: Array.from(keywordMap.values()),
            subCategories: mergeSubCategories(
              existingTab.subCategories,
              importedTab.subCategories,
            ),
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

          // カテゴリキーワードの変換
          const convertCategoryKeywords = (
            keywords: unknown[] | undefined,
          ): SubCategoryKeyword[] => {
            if (!keywords) return []
            return keywords
              .filter(
                (k): k is ImportedKeywordData =>
                  typeof k === 'object' &&
                  k !== null &&
                  'categoryName' in k &&
                  typeof k.categoryName === 'string',
              )
              .map(k => {
                // k の型を明示的に拡張して keywords プロパティへのアクセスを安全にする
                const keywordData = k as {
                  categoryName: string
                  keywords?: unknown
                }
                return {
                  categoryName: k.categoryName,
                  // keywords プロパティが配列かどうか安全にチェック
                  keywords: Array.isArray(keywordData.keywords)
                    ? keywordData.keywords
                    : [],
                }
              })
          }

          // サブカテゴリの型安全変換
          const convertSubCategories = (
            items: unknown[] | undefined,
          ): string[] => {
            if (!items || !Array.isArray(items)) return []

            const result: string[] = []
            const nameSet = new Set<string>()

            for (const item of items) {
              // オブジェクトでnameプロパティがある場合
              if (
                typeof item === 'object' &&
                item !== null &&
                'name' in item &&
                typeof item.name === 'string'
              ) {
                if (!nameSet.has(item.name)) {
                  nameSet.add(item.name)
                  result.push(item.name)
                }
              }
              // 文字列の場合
              else if (typeof item === 'string') {
                if (!nameSet.has(item)) {
                  nameSet.add(item)
                  result.push(item)
                }
              }
            }

            return result
          }

          // 新しいタブグループを新形式で作成
          tabMapByDomain.set(importedTab.domain, {
            id: importedTab.id,
            domain: importedTab.domain,
            // 新形式のURL管理
            urlIds: convertedUrlData.urlIds,
            urlSubCategories: convertedUrlData.urlSubCategories,
            // 旧形式のurlsプロパティは使用しない
            parentCategoryId: importedTab.parentCategoryId,
            categoryKeywords: convertCategoryKeywords(
              importedTab.categoryKeywords,
            ),
            subCategories: convertSubCategories(importedTab.subCategories),
            savedAt: importedTab.savedAt,
          })
        }
      }

      // マージされたタブの配列を作成
      const mergedTabs = Array.from(tabMapByDomain.values())

      // データを保存
      await saveUserSettings(mergedSettings)
      await saveParentCategories(mergedCategories)
      await chrome.storage.local.set({ savedTabs: mergedTabs })

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
      const addedDomains = importedData.savedTabs.filter(
        tab => !currentDomains.has(tab.domain),
      ).length

      return {
        success: true,
        message: `データをマージしました (${addedCategories}個のカテゴリと${addedDomains}個のドメインを追加)`,
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
      importedData.savedTabs.map(async tab => {
        console.log(`上書きモード: ${tab.domain} を新形式に変換中...`)

        // URLsを新形式に変換
        const convertedUrlData = await convertImportedUrlsToNewFormat(tab.urls)

        // categoryKeywordsを型安全に変換
        const convertedKeywords: SubCategoryKeyword[] = []
        if (tab.categoryKeywords && Array.isArray(tab.categoryKeywords)) {
          for (const k of tab.categoryKeywords) {
            if (
              typeof k === 'object' &&
              k !== null &&
              'categoryName' in k &&
              typeof k.categoryName === 'string'
            ) {
              // k の型を明示的に拡張
              const keywordData = k as {
                categoryName: string
                keywords?: unknown
              }
              convertedKeywords.push({
                categoryName: k.categoryName,
                // keywords プロパティが配列かどうか安全にチェック
                keywords: Array.isArray(keywordData.keywords)
                  ? keywordData.keywords
                  : [],
              })
            }
          }
        }

        // サブカテゴリを型安全に変換
        const convertedSubCategories: string[] = []
        if (tab.subCategories && Array.isArray(tab.subCategories)) {
          for (const item of tab.subCategories) {
            // オブジェクトでnameプロパティがある場合
            if (
              typeof item === 'object' &&
              item !== null &&
              'name' in item &&
              typeof item.name === 'string'
            ) {
              convertedSubCategories.push(item.name)
            }
            // 文字列の場合
            else if (typeof item === 'string') {
              convertedSubCategories.push(item)
            }
          }
        }

        return {
          id: tab.id,
          domain: tab.domain,
          // 新形式のURL管理
          urlIds: convertedUrlData.urlIds,
          urlSubCategories: convertedUrlData.urlSubCategories,
          // 旧形式のurlsプロパティは使用しない
          parentCategoryId: tab.parentCategoryId,
          subCategories: convertedSubCategories,
          categoryKeywords: convertedKeywords,
          savedAt: tab.savedAt,
        }
      }),
    )

    // ユーザー設定を保存（不足キーはデフォルトで補完）
    await saveUserSettings({ ...defaultSettings, ...importedData.userSettings })

    // カテゴリを保存
    await saveParentCategories(cleanParentCategories)

    // 保存されたタブを保存
    await chrome.storage.local.set({ savedTabs: cleanTabGroups })

    // インポート後にマイグレーションを実行（旧形式データがインポートされた場合に対応）
    await migrateToUrlsStorage()

    return {
      success: true,
      message: `設定とタブデータを置き換えました（バージョン: ${importedData.version}、作成日時: ${new Date(importedData.timestamp).toLocaleString()}）`,
    }
  } catch (error) {
    console.error('インポートエラー:', error)
    return {
      success: false,
      message: 'データのインポート中にエラーが発生しました',
    }
  }
}
