/**
 * @file useTabData.ts
 * @description タブグループのデータ管理（ロード・URL解決・ストレージ同期）を担う
 * カスタムフック。マイグレーションの実行、初回ロード、URL取得の非同期処理を内包する。
 */

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { getParentCategories } from '@/lib/storage/categories'
import {
  migrateParentCategoriesToDomainNames,
  migrateToUrlsStorage,
} from '@/lib/storage/migration'
import { getUserSettings } from '@/lib/storage/settings'
import { getTabGroupUrls } from '@/lib/storage/tabs'
import type { ParentCategory, TabGroup, UserSettings } from '@/types/storage'

/** useTabData フックの戻り値型 */
interface UseTabDataReturn {
  /** 保存済みタブグループ一覧（URLデータなし・rawデータ） */
  tabGroups: TabGroup[]
  /** tabGroups を直接更新するセッター */
  setTabGroups: Dispatch<SetStateAction<TabGroup[]>>
  /** 初回ロード完了まで true */
  isLoading: boolean
  /** URLデータを解決済みのタブグループ一覧 */
  tabGroupsWithUrls: TabGroup[]
  /**
   * タブグループ配列に対して URL ストレージからデータを取得し、
   * tabGroupsWithUrls を更新する。
   * @param groups - URL を解決するタブグループ配列
   */
  loadTabGroupsWithUrls: (groups: TabGroup[]) => Promise<TabGroup[]>
  /**
   * ストレージから最新の savedTabs を取得して tabGroups と tabGroupsWithUrls を再同期する。
   * @param nextGroups - 省略した場合はストレージから取得する
   */
  refreshTabGroupsWithUrls: (nextGroups?: TabGroup[]) => Promise<TabGroup[]>
}
const runInitialMigrations = async (): Promise<void> => {
  console.log('ページ読み込み時の親カテゴリ移行処理を開始...')
  try {
    await migrateParentCategoriesToDomainNames()
  } catch (error) {
    console.error('親カテゴリ移行エラー:', error)
  }
  try {
    console.log('URL管理マイグレーションを開始...')
    await migrateToUrlsStorage()
    console.log('URL管理マイグレーションが完了しました')
  } catch (error) {
    console.error('URL管理マイグレーションエラー:', error)
  }
}
const logSavedTabsSummary = (savedTabs: TabGroup[]): void => {
  console.log('読み込まれたタブ:', savedTabs)
  console.log('タブグループ数:', savedTabs.length)
  for (const group of savedTabs) {
    console.log(`グループ ${group.domain}:`, {
      id: group.id,
      urlIds: group.urlIds?.length || 0,
      urls: group.urls?.length || 0,
      urlSubCategories: group.urlSubCategories
        ? Object.keys(group.urlSubCategories).length
        : 0,
    })
  }
  if (savedTabs.length === 0) {
    console.log('タブグループが空です。テストデータの有無を確認...')
  }
}
const ensureValidParentCategories = async (
  parentCategories: ParentCategory[],
): Promise<ParentCategory[]> => {
  const hasInvalidCategory = parentCategories.some(
    cat => !(cat.domainNames && Array.isArray(cat.domainNames)),
  )
  if (!(hasInvalidCategory || parentCategories.length === 0)) {
    return parentCategories
  }
  console.log('無効なカテゴリを検出、再マイグレーションを実行')
  await migrateParentCategoriesToDomainNames()
  return await getParentCategories()
}
const repairSavedTabParentCategoryIds = (
  savedTabs: TabGroup[],
  parentCategories: ParentCategory[],
): {
  updatedTabGroups: TabGroup[]
  needsUpdate: boolean
} => {
  let needsUpdate = false
  const updatedTabGroups = savedTabs.map((group: TabGroup) => {
    if (group.parentCategoryId) {
      return group
    }
    for (const category of parentCategories) {
      if (category.domains?.includes(group.id)) {
        console.log(
          `TabGroup ${group.domain} のparentCategoryIdを ${category.id} に修復しました (IDベース)`,
        )
        needsUpdate = true
        return {
          ...group,
          parentCategoryId: category.id,
        }
      }
      if (category.domainNames?.includes(group.domain)) {
        console.log(
          `TabGroup ${group.domain} のparentCategoryIdを ${category.id} に修復しました (ドメイン名ベース)`,
        )
        needsUpdate = true
        return {
          ...group,
          parentCategoryId: category.id,
        }
      }
    }
    return group
  })
  return {
    updatedTabGroups,
    needsUpdate,
  }
}
/**
 * タブグループデータの管理フック。
 * マイグレーション実行・初回ロード・URL解決・ストレージ変更連携を担う。
 *
 * @param onCategoriesLoaded - 初回ロード時にカテゴリが確定したときに呼び出されるコールバック
 * @param onSettingsLoaded   - 初回ロード時にユーザー設定が確定したときに呼び出されるコールバック
 * @returns UseTabDataReturn
 */
const useTabData = (
  onCategoriesLoaded: (categories: ParentCategory[]) => void,
  onSettingsLoaded: (settings: UserSettings) => void,
): UseTabDataReturn => {
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tabGroupsWithUrls, setTabGroupsWithUrls] = useState<TabGroup[]>([])

  // コールバック参照を ref で保持（useEffect 依存配列の安定性のため）
  const onCategoriesLoadedRef = useRef(onCategoriesLoaded)
  const onSettingsLoadedRef = useRef(onSettingsLoaded)
  useEffect(() => {
    onCategoriesLoadedRef.current = onCategoriesLoaded
  }, [onCategoriesLoaded])
  useEffect(() => {
    onSettingsLoadedRef.current = onSettingsLoaded
  }, [onSettingsLoaded])

  /**
   * タブグループ配列に対して各グループの URL をストレージから取得する。
   * @param groups - 対象のタブグループ配列
   * @returns URL が解決されたタブグループ配列
   */
  const loadTabGroupsWithUrls = useCallback(
    async (groups: TabGroup[]): Promise<TabGroup[]> => {
      if (groups.length === 0) {
        return []
      }
      console.log('タブグループのURL取得を開始...')
      const groupsWithUrls = await Promise.all(
        groups.map(async group => {
          try {
            if (group.urlIds && group.urlIds.length > 0) {
              // 新形式: getTabGroupUrlsを使用してURLデータを取得
              const urls = await getTabGroupUrls(group)
              console.log(
                `グループ ${group.domain}: ${urls.length}個のURLを取得`,
              )
              return {
                ...group,
                urls,
              }
            }
            if (group.urls && group.urls.length > 0) {
              // 旧形式: そのまま使用
              console.log(`グループ ${group.domain}: 旧形式のまま使用`)
              return group
            }
            // URLがない場合
            console.log(`グループ ${group.domain}: URLなし`)
            return {
              ...group,
              urls: [],
            }
          } catch (error) {
            console.error(`グループ ${group.domain} のURL取得エラー:`, error)
            return {
              ...group,
              urls: [],
            }
          }
        }),
      )
      return groupsWithUrls
    },
    [],
  )

  /**
   * ストレージから最新の savedTabs を取得して tabGroups と tabGroupsWithUrls を再同期する。
   * @param nextGroups - 省略した場合はストレージから取得する
   * @returns 正規化されたタブグループ配列
   */
  const refreshTabGroupsWithUrls = useCallback(
    async (nextGroups?: TabGroup[]): Promise<TabGroup[]> => {
      const groups =
        nextGroups ??
        ((await chrome.storage.local.get('savedTabs')).savedTabs as
          | TabGroup[]
          | undefined) ??
        []
      const normalizedGroups = Array.isArray(groups) ? groups : []
      setTabGroups(normalizedGroups)
      const groupsWithUrls = await loadTabGroupsWithUrls(normalizedGroups)
      setTabGroupsWithUrls(groupsWithUrls)
      return normalizedGroups
    },
    [loadTabGroupsWithUrls],
  )

  // ページ読み込み時にマイグレーションを実行して初回データをロードする
  useEffect(() => {
    const loadSavedTabs = async () => {
      try {
        await runInitialMigrations()

        // データ読み込み
        const storageResult = await chrome.storage.local.get('savedTabs')
        const savedTabs: TabGroup[] = Array.isArray(storageResult.savedTabs)
          ? storageResult.savedTabs
          : []
        logSavedTabsSummary(savedTabs)
        setTabGroups(savedTabs)
        const [urlStorageResult, allStorage, userSettings, parentCategories] =
          await Promise.all([
            chrome.storage.local.get('urls'),
            chrome.storage.local.get(),
            getUserSettings(),
            getParentCategories(),
          ])

        // URLストレージの内容を確認
        const urls = Array.isArray(urlStorageResult.urls)
          ? urlStorageResult.urls
          : []
        console.log('URLストレージ内容:', urls)
        console.log('URLレコード数:', urls.length)

        // 全ストレージ内容を確認
        console.log('全ストレージ内容:', allStorage)
        console.log('ストレージキー一覧:', Object.keys(allStorage))

        // ユーザー設定を親コンポーネントに通知
        onSettingsLoadedRef.current(userSettings)

        // カテゴリを読み込み
        console.log('読み込まれた親カテゴリ:', parentCategories)
        const finalCategories =
          await ensureValidParentCategories(parentCategories)
        onCategoriesLoadedRef.current(finalCategories)
        const { updatedTabGroups, needsUpdate } =
          repairSavedTabParentCategoryIds(savedTabs, finalCategories)

        // 修復が必要な場合はストレージを更新
        if (needsUpdate) {
          await chrome.storage.local.set({
            savedTabs: updatedTabGroups,
          })
          setTabGroups(updatedTabGroups)
          console.log('TabGroupのparentCategoryId修復処理が完了しました')
        }
      } catch (error) {
        console.error('保存されたタブの読み込みエラー:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSavedTabs()
  }, [])

  // タブグループが更新されたらURLデータを取得する
  useEffect(() => {
    let cancelled = false
    const loadUrlsForTabGroups = async () => {
      const groupsWithUrls = await loadTabGroupsWithUrls(tabGroups)
      if (!cancelled) {
        console.log('URL取得完了、状態を更新...')
        setTabGroupsWithUrls(groupsWithUrls)
      }
    }
    loadUrlsForTabGroups()
    return () => {
      cancelled = true
    }
  }, [tabGroups, loadTabGroupsWithUrls])
  return {
    tabGroups,
    setTabGroups,
    isLoading,
    tabGroupsWithUrls,
    loadTabGroupsWithUrls,
    refreshTabGroupsWithUrls,
  }
}

export type { UseTabDataReturn }
export { useTabData }
