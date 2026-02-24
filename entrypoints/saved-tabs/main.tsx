import '@/assets/global.css'
// プロダクションビルドではデバッグログを抑制する
if (!import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log = () => {}
  // eslint-disable-next-line no-console
  console.debug = () => {}
}

import type { DragEndEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import Fuse from 'fuse.js'
// lucide-reactからのアイコンインポート
import { Check, Plus, X } from 'lucide-react'
import {
  Profiler,
  type ProfilerOnRenderCallback,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
// UIコンポーネントのインポート
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CategoryGroup } from '@/features/saved-tabs/components/CategoryGroup'
import { CustomProjectSection } from '@/features/saved-tabs/components/CustomProjectSection'
import { CategoryReorderFooter } from '@/features/saved-tabs/components/Footer'
import { Header } from '@/features/saved-tabs/components/Header' // ヘッダーコンポーネントをインポート
import { SortableDomainCard } from '@/features/saved-tabs/components/SortableDomainCard'
import { useCategoryManagement } from '@/features/saved-tabs/hooks/useCategoryManagement'
import { useProjectManagement } from '@/features/saved-tabs/hooks/useProjectManagement'
import { useTabData } from '@/features/saved-tabs/hooks/useTabData'
import { handleTabGroupRemoval } from '@/features/saved-tabs/lib/tab-operations'
import { saveParentCategories } from '@/lib/storage/categories'
import {
  addUrlToCustomProject,
  getCustomProjects,
  getProjectUrls,
  removeCategoryFromProject,
  removeUrlFromCustomProject,
  setUrlCategory,
} from '@/lib/storage/projects'
import { defaultSettings } from '@/lib/storage/settings'
import {
  addSubCategoryToGroup,
  getTabGroupUrls,
  removeUrlFromTabGroup,
} from '@/lib/storage/tabs'
import { invalidateUrlCache } from '@/lib/storage/urls'
import type {
  CustomProject,
  ParentCategory,
  TabGroup,
  UserSettings,
} from '@/types/storage'

type SavedTabsProfilerStats = {
  commits: number
  phase: string
  actualDuration: number
}
type SavedTabsProfilerGlobal = typeof globalThis & {
  __savedTabsProfiler?: SavedTabsProfilerStats
  __ENABLE_SAVED_TABS_PROFILER?: boolean
}

const isDevProfileEnabled =
  import.meta.env.DEV &&
  Boolean((globalThis as SavedTabsProfilerGlobal).__ENABLE_SAVED_TABS_PROFILER)
let savedTabsCommitCount = 0

const handleSavedTabsRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
) => {
  if (!isDevProfileEnabled || id !== 'SavedTabs') {
    return
  }

  savedTabsCommitCount += 1
  const stats: SavedTabsProfilerStats = {
    commits: savedTabsCommitCount,
    phase,
    actualDuration,
  }
  ;(globalThis as SavedTabsProfilerGlobal).__savedTabsProfiler = stats

  console.log(
    `[Profiler] SavedTabs commit #${savedTabsCommitCount} phase=${phase} actual=${actualDuration.toFixed(
      2,
    )}ms`,
  )
}

const SavedTabs = () => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [newSubCategory, setNewSubCategory] = useState('')
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 未分類ドメインの並び替えモード状態管理
  const [isUncategorizedReorderMode, setIsUncategorizedReorderMode] =
    useState(false)
  const [_originalUncategorizedOrder, setOriginalUncategorizedOrder] = useState<
    TabGroup[]
  >([])
  const [tempUncategorizedOrder, setTempUncategorizedOrder] = useState<
    TabGroup[]
  >([])

  // --- カスタムフック呼び出し ---

  // 1. useCategoryManagement を先に呼び出す（setCategories を useTabData に渡すため）
  const {
    categories,
    setCategories,
    categoryOrder,
    isCategoryReorderMode,
    tempCategoryOrder,
    handleDeleteCategory,
    handleCategoryDragEnd,
    handleConfirmCategoryReorder,
    handleCancelCategoryReorder,
    handleUpdateDomainsOrder,
    handleMoveDomainToCategory,
  } = useCategoryManagement([], settings)

  // 2. useTabData を呼び出す（onCategoriesLoaded に setCategories を渡す）
  const { tabGroups, isLoading, tabGroupsWithUrls, refreshTabGroupsWithUrls } =
    useTabData(setCategories, setSettings)

  // 3. useProjectManagement を呼び出す
  const {
    customProjects,
    setCustomProjects,
    viewMode,
    customProjectsRef,
    viewModeRef,
    syncDomainDataToCustomProjects,
    handleViewModeChange,
    handleCreateProject,
    handleDeleteProject,
    handleRenameProject,
    handleAddUrlToProject,
    handleDeleteUrlFromProject,
    handleAddCategory,
    handleDeleteProjectCategory,
    handleSetUrlCategory,
    handleUpdateCategoryOrder,
    handleReorderUrls,
    handleReorderProjects,
    handleRenameCategory,
  } = useProjectManagement(tabGroups, settings)

  useEffect(() => {
    if (showSubCategoryModal && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showSubCategoryModal])

  const removeOpenedUrlsFromStorage = useCallback(
    async (urlsToRemove: string[]) => {
      if (urlsToRemove.length === 0) {
        return
      }

      const uniqueUrls = [...new Set(urlsToRemove)]
      const storageResult = await chrome.storage.local.get('savedTabs')
      const savedTabs: TabGroup[] = Array.isArray(storageResult.savedTabs)
        ? storageResult.savedTabs
        : []

      for (const group of savedTabs) {
        if (!group.urlIds || group.urlIds.length === 0) {
          continue
        }

        const groupUrls = await getTabGroupUrls(group)
        const groupUrlSet = new Set(groupUrls.map(item => item.url))

        for (const targetUrl of uniqueUrls) {
          if (groupUrlSet.has(targetUrl)) {
            await removeUrlFromTabGroup(group.id, targetUrl)
          }
        }
      }

      const projects = await getCustomProjects()
      for (const project of projects) {
        const projectUrls = await getProjectUrls(project)
        const projectUrlSet = new Set(projectUrls.map(item => item.url))

        for (const targetUrl of uniqueUrls) {
          if (projectUrlSet.has(targetUrl)) {
            await removeUrlFromCustomProject(project.id, targetUrl)
          }
        }
      }

      await refreshTabGroupsWithUrls()
      const updatedProjects = await getCustomProjects()
      setCustomProjects(updatedProjects)
    },
    [refreshTabGroupsWithUrls, setCustomProjects],
  )

  // 既存のタブ開く処理を拡張して両方のモードで同期する
  const handleOpenTab = useCallback(
    async (url: string) => {
      try {
        // 設定に基づきバックグラウンド(active: false)またはフォアグラウンド(active: true)で開く
        await chrome.tabs.create({ url, active: !settings.openUrlInBackground })

        // 設定に基づいて、開いたタブを削除するかどうかを決定（新形式対応）
        if (settings.removeTabAfterOpen) {
          await removeOpenedUrlsFromStorage([url])
          console.log(
            `URL ${url} を開いた後、すべてのグループとプロジェクトから削除しました`,
          )
        }
      } catch (error) {
        console.error('タブを開く処理エラー:', error)
      }
    },
    [
      settings.openUrlInBackground,
      settings.removeTabAfterOpen,
      removeOpenedUrlsFromStorage,
    ],
  )

  const handleOpenAllTabs = useCallback(
    async (urls: { url: string; title: string }[]) => {
      try {
        // ①新しいウィンドウでまとめて開くモード
        if (settings.openAllInNewWindow) {
          await chrome.windows.create({
            url: urls.map(u => u.url),
            focused: true, // 新ウィンドウを常に前面に表示
          })
        }
        // ②通常モード: タブを一括で開く（Promise.allで並列処理）
        else {
          await Promise.all(
            urls.map(({ url }) =>
              chrome.tabs.create({
                url,
                active: !settings.openUrlInBackground,
              }),
            ),
          )
        }

        // ③開いた後に削除設定が有効ならグループ/プロジェクトを更新（新形式対応）
        if (settings.removeTabAfterOpen) {
          await removeOpenedUrlsFromStorage(urls.map(({ url }) => url))
          console.log(
            `${urls.length}個のURLを開いた後、すべてのグループとプロジェクトから削除しました`,
          )
        }
      } catch (error) {
        console.error('タブ一括オープンエラー:', error)
      }
    },
    [
      settings.openAllInNewWindow,
      settings.openUrlInBackground,
      settings.removeTabAfterOpen,
      removeOpenedUrlsFromStorage,
    ],
  )

  // handleDeleteGroup関数を修正
  const handleDeleteGroup = useCallback(
    async (id: string) => {
      try {
        // 削除前にカテゴリ設定と親カテゴリ情報を保存
        const storageResult = await chrome.storage.local.get('savedTabs')
        const savedTabs: TabGroup[] = Array.isArray(storageResult.savedTabs)
          ? storageResult.savedTabs
          : []
        const groupToDelete = savedTabs.find(group => group.id === id)
        if (!groupToDelete) return
        console.log(`グループを削除: ${groupToDelete.domain}`)

        // 専用の削除前処理関数を呼び出し（インポートした関数を使用）
        await handleTabGroupRemoval(id)

        // 以降は従来通りの処理
        const updatedGroups = savedTabs.filter(group => group.id !== id)
        await chrome.storage.local.set({ savedTabs: updatedGroups })
        await refreshTabGroupsWithUrls(updatedGroups)

        // 並び替えモード中の削除処理：一時的な順序からも削除
        if (isUncategorizedReorderMode) {
          setTempUncategorizedOrder(prev =>
            prev.filter(group => group.id !== id),
          )
          console.log(
            `並び替えモード中にドメイン ${groupToDelete.domain} を一時順序からも削除しました`,
          )
        }

        // 親カテゴリからはドメインIDのみを削除（ドメイン名は保持）
        const updatedCategories = categories.map(category => ({
          ...category,
          domains: category.domains.filter(domainId => domainId !== id),
        }))

        await saveParentCategories(updatedCategories)
        setCategories(updatedCategories)
        console.log('グループ削除処理が完了しました')
      } catch (error) {
        console.error('グループ削除エラー:', error)
      }
    },
    [
      isUncategorizedReorderMode,
      categories,
      refreshTabGroupsWithUrls,
      setCategories,
    ],
  )

  const handleDeleteUrl = useCallback(
    async (groupId: string, url: string) => {
      try {
        // 新形式のURL削除関数を呼び出し
        await removeUrlFromTabGroup(groupId, url)
        await refreshTabGroupsWithUrls()
        console.log(`URL ${url} をグループ ${groupId} から削除しました`)
      } catch (error) {
        console.error('URL削除エラー:', error)
      }
    },
    [refreshTabGroupsWithUrls],
  )

  const handleUpdateUrls = useCallback(
    async (groupId: string, _updatedUrls: TabGroup['urls']) => {
      try {
        // 新形式では直接URL更新は不要（共通URLストレージで管理）
        await refreshTabGroupsWithUrls()
        console.log(`グループ ${groupId} のURL更新後のデータを更新しました`)
      } catch (error) {
        console.error('URL更新後のデータ更新エラー:', error)
      }
    },
    [refreshTabGroupsWithUrls],
  )

  // 子カテゴリを追加
  const handleAddSubCategory = useCallback(async () => {
    const trimmedName = newSubCategory.trim()
    if (!trimmedName) {
      return
    }

    try {
      await addSubCategoryToGroup('', trimmedName)
      setShowSubCategoryModal(false)
      setNewSubCategory('')
    } catch (error) {
      console.error('子カテゴリ追加エラー:', error)
    }
  }, [newSubCategory])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // const handleDragEnd = (event: DragEndEvent) => {
  //   const { active, over } = event

  //   if (over && active.id !== over.id) {
  //     setTabGroups((groups: TabGroup[]) => {
  //       const oldIndex = groups.findIndex(group => group.id === active.id)
  //       const newIndex = groups.findIndex(group => group.id === over.id)

  //       const newGroups = arrayMove(groups, oldIndex, newIndex)

  //       // ストレージに保存
  //       chrome.storage.local.set({ savedTabs: newGroups })

  //       return newGroups
  //     })
  //   }
  // }

  // 未分類ドメインの並び替えをキャンセルする
  const handleCancelUncategorizedReorder = useCallback(() => {
    if (!isUncategorizedReorderMode) return

    // 元の順序に戻す
    setTempUncategorizedOrder([])

    // 並び替えモードを終了
    setIsUncategorizedReorderMode(false)
    setOriginalUncategorizedOrder([])

    toast.info('未分類ドメインの並び替えをキャンセルしました')
  }, [isUncategorizedReorderMode])

  // タブグループをカテゴリごとに整理する関数を強化
  const organizeTabGroups = useCallback((): {
    categorized: Record<string, TabGroup[]>
    uncategorized: TabGroup[]
  } => {
    if (!settings.enableCategories) {
      return { categorized: {}, uncategorized: tabGroupsWithUrls }
    }

    console.log('親カテゴリ一覧:', categories)
    console.log('organizeTabGroups開始:')
    console.log('- tabGroupsWithUrls:', tabGroupsWithUrls)
    console.log('- tabGroupsWithUrls.length:', tabGroupsWithUrls.length)

    // カテゴリに属するドメインとカテゴリに属さないドメインに分ける
    const categorizedGroups: Record<string, TabGroup[]> = {}
    const uncategorizedGroups: TabGroup[] = []

    const normalizedQuery = searchQuery.trim().toLowerCase()
    const hasSearchQuery = normalizedQuery.length > 0

    const groupsToOrganize = tabGroupsWithUrls
      .map(g => {
        if (!hasSearchQuery) {
          return g
        }

        const currentUrls = g.urls || []
        const filteredUrls = currentUrls.filter(item => {
          const query = normalizedQuery
          const matchesBasicFields =
            item.title.toLowerCase().includes(query) ||
            item.url.toLowerCase().includes(query) ||
            g.domain.toLowerCase().includes(query)

          // 子カテゴリでの検索
          const matchesSubCategory = item.subCategory
            ?.toLowerCase()
            .includes(query)

          // 親カテゴリでの検索（このタブグループが属する親カテゴリ名で検索）
          let matchesParentCategory = false

          // まず、parentCategoryIdで検索
          if (g.parentCategoryId) {
            const parentCategory = categories.find(
              cat => cat.id === g.parentCategoryId,
            )
            if (parentCategory) {
              matchesParentCategory = parentCategory.name
                .toLowerCase()
                .includes(query)
              console.log(
                `親カテゴリ検索デバッグ: ドメイン ${g.domain}, 親カテゴリ「${parentCategory.name}」, クエリ「${query}」, マッチ: ${matchesParentCategory}`,
              )
            } else {
              console.log(
                `親カテゴリ検索デバッグ: ドメイン ${g.domain}, parentCategoryId ${g.parentCategoryId} に対応するカテゴリが見つかりません`,
              )
            }
          }

          // parentCategoryIdが未設定またはマッチしない場合、リアルタイムでカテゴリを探す
          if (!matchesParentCategory) {
            for (const category of categories) {
              // IDベースまたはドメイン名ベースでカテゴリを探す
              if (
                category.domains?.includes(g.id) ||
                category.domainNames?.includes(g.domain)
              ) {
                const categoryMatches = category.name
                  .toLowerCase()
                  .includes(query)
                if (categoryMatches) {
                  matchesParentCategory = true
                  console.log(
                    `親カテゴリ検索デバッグ（リアルタイム）: ドメイン ${g.domain}, 親カテゴリ「${category.name}」, クエリ「${query}」, マッチ: ${categoryMatches}`,
                  )
                  break
                }
              }
            }
          }

          if (!g.parentCategoryId && !matchesParentCategory) {
            console.log(
              `親カテゴリ検索デバッグ: ドメイン ${g.domain}, parentCategoryIdが未設定かつカテゴリマッチなし`,
            )
          }

          return (
            matchesBasicFields || matchesSubCategory || matchesParentCategory
          )
        })

        if (filteredUrls.length === currentUrls.length) {
          return g
        }

        return { ...g, urls: filteredUrls }
      })
      .filter(g => {
        // 新形式対応: urlIdsがあるか、旧形式のurlsがあるかをチェック
        const hasNewUrls = g.urlIds && g.urlIds.length > 0
        const hasOldUrls = g.urls && g.urls.length > 0
        console.log(
          `フィルタチェック ${g.domain}: urlIds=${g.urlIds?.length || 0}, urls=${g.urls?.length || 0}, 表示=${hasNewUrls || hasOldUrls}`,
        )
        return hasNewUrls || hasOldUrls
      })

    console.log('groupsToOrganize:', groupsToOrganize)
    console.log('groupsToOrganize.length:', groupsToOrganize.length)

    for (const group of groupsToOrganize) {
      // このグループが属するカテゴリを探す
      let found = false

      // まずIDベースでカテゴリを検索
      for (const category of categories) {
        if (category.domains?.includes(group.id)) {
          // 配列が未初期化の場合は初期化する
          if (!categorizedGroups[category.id]) {
            categorizedGroups[category.id] = []
          }
          const categorizedGroup =
            group.parentCategoryId === category.id
              ? group
              : { ...group, parentCategoryId: category.id }
          categorizedGroups[category.id].push(categorizedGroup)

          // TabGroupのparentCategoryIdが設定されていない場合は設定
          if (group.parentCategoryId !== category.id) {
            console.log(
              `ドメイン ${group.domain} のparentCategoryIdをIDベースで ${category.id} に更新しました`,
            )
          }

          found = true
          console.log(
            `ドメイン ${group.domain} はIDベースで ${category.name} に分類されました`,
          )
          break
        }
      }

      // IDで見つからなかった場合は、ドメイン名で検索
      if (!found) {
        for (const category of categories) {
          if (
            category.domainNames &&
            Array.isArray(category.domainNames) &&
            category.domainNames.includes(group.domain)
          ) {
            // 配列が未初期化の場合は初期化する
            if (!categorizedGroups[category.id]) {
              categorizedGroups[category.id] = []
            }
            const categorizedGroup =
              group.parentCategoryId === category.id
                ? group
                : { ...group, parentCategoryId: category.id }
            categorizedGroups[category.id].push(categorizedGroup)

            console.log(
              `ドメイン ${group.domain} はドメイン名ベースで ${category.name} に分類されました`,
            )

            // TabGroupのparentCategoryIdを更新
            console.log(
              `ドメイン ${group.domain} のparentCategoryIdを ${category.id} に設定しました`,
            )

            found = true
            break
          }
        }
      }

      if (!found) {
        uncategorizedGroups.push(group)
        console.log(`ドメイン ${group.domain} は未分類です`)
      }
    }

    // カテゴリ内のドメイン順序を維持するための処理を追加
    for (const categoryId of Object.keys(categorizedGroups)) {
      // カテゴリIDに対応する配列が未初期化の場合は初期化する
      if (!categorizedGroups[categoryId]) {
        categorizedGroups[categoryId] = []
      }
      const category = categories.find(c => c.id === categoryId)
      const domains = category?.domains
      if (domains && domains.length > 0) {
        // ドメインIDの順序に従ってドメインをソート
        const domainArray = [...domains] // 配列として扱うことを保証
        categorizedGroups[categoryId].sort((a, b) => {
          const indexA = domainArray.indexOf(a.id)
          const indexB = domainArray.indexOf(b.id)
          // 見つからない場合は最後に配置
          if (indexA === -1) return 1
          if (indexB === -1) return -1
          return indexA - indexB
        })
      }
    }

    console.log('organizeTabGroups結果:')
    console.log('- categorizedGroups:', categorizedGroups)
    console.log('- uncategorizedGroups:', uncategorizedGroups)
    console.log('- uncategorizedGroups.length:', uncategorizedGroups.length)

    return {
      categorized: categorizedGroups,
      uncategorized: uncategorizedGroups,
    }
  }, [tabGroupsWithUrls, categories, settings.enableCategories, searchQuery])

  // tabGroupsWithUrls と categories が変わったとき、カテゴリ割り当ての不一致を
  // ストレージに反映するための副作用（organizeTabGroups から分離した副作用）
  useEffect(() => {
    if (!settings.enableCategories) return
    if (tabGroupsWithUrls.length === 0 || categories.length === 0) return

    const syncCategoryAssignments = async () => {
      try {
        const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
        const currentSavedTabs = savedTabs as TabGroup[]

        let savedTabsChanged = false
        let updatedSavedTabs = [...currentSavedTabs]

        // カテゴリ配列のスナップショットをキャプチャ（非同期処理中にstateが変わっても安全）
        const currentCategories = [...categories]
        let categoriesChanged = false
        let updatedCategories = currentCategories.map(c => ({ ...c }))

        for (const group of tabGroupsWithUrls) {
          // IDベースでカテゴリを検索してparentCategoryIdの不一致を修正
          for (const category of currentCategories) {
            if (
              category.domains?.includes(group.id) &&
              group.parentCategoryId !== category.id
            ) {
              updatedSavedTabs = updatedSavedTabs.map(tab =>
                tab.id === group.id
                  ? { ...tab, parentCategoryId: category.id }
                  : tab,
              )
              savedTabsChanged = true
              console.log(
                `[カテゴリ同期] ドメイン ${group.domain} のparentCategoryIdをIDベースで ${category.id} に更新しました`,
              )
              break
            }
          }

          // ドメイン名ベースでカテゴリを発見したとき、カテゴリのdomainsリストとparentCategoryIdを同期
          const foundByDomainName = currentCategories.find(
            c =>
              !c.domains?.includes(group.id) &&
              c.domainNames?.includes(group.domain),
          )
          if (foundByDomainName) {
            updatedCategories = updatedCategories.map(c =>
              c.id === foundByDomainName.id
                ? { ...c, domains: [...c.domains, group.id] }
                : c,
            )
            categoriesChanged = true

            updatedSavedTabs = updatedSavedTabs.map(tab =>
              tab.id === group.id
                ? { ...tab, parentCategoryId: foundByDomainName.id }
                : tab,
            )
            savedTabsChanged = true
            console.log(
              `[カテゴリ同期] ドメイン ${group.domain} のIDを親カテゴリ ${foundByDomainName.id} に同期しました`,
            )
          }
        }

        if (categoriesChanged) {
          await saveParentCategories(updatedCategories)
        }
        if (savedTabsChanged) {
          await chrome.storage.local.set({ savedTabs: updatedSavedTabs })
          console.log('[カテゴリ同期] savedTabs をストレージに書き込みました')
        }
      } catch (err) {
        console.error('[カテゴリ同期] ストレージ同期エラー:', err)
      }
    }

    syncCategoryAssignments()
  }, [tabGroupsWithUrls, categories, settings.enableCategories])

  // 検索・フィルタ適用後のグループを整理（メモ化）
  const { categorized, uncategorized } = useMemo(
    () => organizeTabGroups(),
    [organizeTabGroups],
  )
  // コンテンツがあるグループリスト（カテゴリと未分類を結合、URLがあるもののみ）
  const hasContentTabGroups = useMemo(
    () =>
      [...Object.values(categorized).flat(), ...uncategorized].filter(
        group => (group.urls || group.urlIds || []).length > 0,
      ),
    [categorized, uncategorized],
  )

  // 未分類ドメインのドラッグエンド処理（並び替えモード対応）
  const handleUncategorizedDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const currentOrder = isUncategorizedReorderMode
          ? tempUncategorizedOrder
          : uncategorized

        const oldIndex = currentOrder.findIndex(group => group.id === active.id)
        const newIndex = currentOrder.findIndex(group => group.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          const updatedOrder = arrayMove(currentOrder, oldIndex, newIndex)

          if (!isUncategorizedReorderMode) {
            // 初回の並び替え時：並び替えモードを開始
            setIsUncategorizedReorderMode(true)
            setOriginalUncategorizedOrder([...uncategorized])
            setTempUncategorizedOrder(updatedOrder)
          } else {
            // 既に並び替えモード中：一時的な順序を更新
            setTempUncategorizedOrder(updatedOrder)
          }
        }
      }
    },
    [isUncategorizedReorderMode, tempUncategorizedOrder, uncategorized],
  )

  // 未分類ドメインの並び替えを確定する
  const handleConfirmUncategorizedReorder = useCallback(async () => {
    if (!isUncategorizedReorderMode) return

    try {
      const categorizedDomains = Object.values(categorized).flat()

      // 新しい順序：カテゴリ分類されたドメイン + 並び替えた未分類ドメイン
      const newTabGroups = [...categorizedDomains, ...tempUncategorizedOrder]

      // ストレージに保存
      await chrome.storage.local.set({ savedTabs: newTabGroups })
      await refreshTabGroupsWithUrls(newTabGroups)

      // 並び替えモードを終了
      setIsUncategorizedReorderMode(false)
      setOriginalUncategorizedOrder([])
      setTempUncategorizedOrder([])

      toast.success('未分類ドメインの順序を変更しました')
    } catch (error) {
      console.error('未分類ドメイン順序の更新に失敗しました:', error)
      toast.error('未分類ドメイン順序の更新に失敗しました')
    }
  }, [
    isUncategorizedReorderMode,
    categorized,
    tempUncategorizedOrder,
    refreshTabGroupsWithUrls,
  ])

  console.log('表示判定デバッグ:')
  console.log('- categorized:', categorized)
  console.log('- uncategorized:', uncategorized)
  console.log('- hasContentTabGroups:', hasContentTabGroups)
  console.log('- hasContentTabGroups.length:', hasContentTabGroups.length)

  // カスタムモード検索用にプロジェクトとURLをフィルタリング
  const filteredCustomProjects = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return customProjects

    const query = q.toLowerCase()

    // プロジェクト名での曖昧検索
    const projectFuse = new Fuse(customProjects, {
      keys: ['name'],
      threshold: 0.4,
    })
    const matchedProjects = projectFuse.search(q).map(res => res.item)

    // カテゴリ名での検索
    const categoryMatchedProjects = customProjects
      .filter(proj => !matchedProjects.includes(proj))
      .filter(proj =>
        proj.categories.some(category =>
          category.toLowerCase().includes(query),
        ),
      )

    // URLレベルでの曖昧検索（カテゴリ名も含む）
    const urlFuseOptions = { keys: ['title', 'url'], threshold: 0.4 }
    const urlMatchedProjects = customProjects
      .filter(
        proj =>
          !matchedProjects.includes(proj) &&
          !categoryMatchedProjects.includes(proj),
      )
      .map(proj => {
        const projectUrls = proj.urls || []
        const fuseUrls = new Fuse(projectUrls, urlFuseOptions)
        const fuseMatches = fuseUrls.search(q).map(r => r.item)

        // URL個別のカテゴリ名での検索も追加
        const categoryMatches = projectUrls.filter(url =>
          url.category?.toLowerCase().includes(query),
        )

        const allMatches = [...fuseMatches, ...categoryMatches]
        // 重複を削除
        const uniqueMatches = allMatches.filter(
          (url, index, self) =>
            self.findIndex(u => u.url === url.url) === index,
        )

        return uniqueMatches.length ? { ...proj, urls: uniqueMatches } : null
      })
      .filter(
        (proj: CustomProject | null): proj is CustomProject => proj !== null,
      ) // Filter out null entries with type guard

    return [
      ...matchedProjects,
      ...categoryMatchedProjects,
      ...urlMatchedProjects,
    ]
  }, [customProjects, searchQuery])

  // ストレージ変更検出時のリスナーを改善（ドメインモードとカスタムモード間の同期）
  useEffect(() => {
    const handleStorageChanged = async (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => {
      console.log('ストレージ変更を検出:', changes)

      const hasSavedTabsChange = Boolean(changes.savedTabs)
      const hasUrlsChange = Boolean(changes.urls)

      // 新形式URLストレージが更新されたら、ページ側のURLキャッシュを破棄する
      if (hasUrlsChange) {
        invalidateUrlCache()
      }

      // savedTabsの変更を検出した場合
      if (hasSavedTabsChange) {
        const nextSavedTabs = Array.isArray(changes.savedTabs.newValue)
          ? (changes.savedTabs.newValue as TabGroup[])
          : []
        await refreshTabGroupsWithUrls(nextSavedTabs)

        // ドメインモードで変更があった場合、カスタムプロジェクトも同期更新
        await syncDomainDataToCustomProjects()
      } else if (hasUrlsChange) {
        // URL実体のみ更新されたケースでも、saved-tabs表示を再同期する
        await refreshTabGroupsWithUrls()
      }

      if (changes.userSettings) {
        const nextSettings = changes.userSettings.newValue as
          | Partial<UserSettings>
          | undefined
        setSettings(prev => ({ ...prev, ...(nextSettings ?? {}) }))
      }

      if (changes.parentCategories) {
        const nextCategories = Array.isArray(changes.parentCategories.newValue)
          ? (changes.parentCategories.newValue as ParentCategory[])
          : []
        setCategories(nextCategories)
      }

      // カスタムプロジェクトの変更を検出した場合
      if (changes.customProjects && viewModeRef.current === 'custom') {
        const nextCustomProjects = Array.isArray(
          changes.customProjects.newValue,
        )
          ? (changes.customProjects.newValue as CustomProject[])
          : []
        setCustomProjects(nextCustomProjects)
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChanged)
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChanged)
    }
  }, [
    refreshTabGroupsWithUrls,
    syncDomainDataToCustomProjects,
    setCategories,
    setCustomProjects,
    viewModeRef,
  ]) // 必要な依存関係を追加

  // カスタムプロジェクト間でURLを移動するハンドラ
  const handleMoveUrlBetweenProjects = useCallback(
    async (sourceProjectId: string, targetProjectId: string, url: string) => {
      try {
        console.log(
          `URL移動: ${sourceProjectId} → ${targetProjectId}, URL: ${url}`,
        )
        const sourceProject = customProjectsRef.current.find(
          p => p.id === sourceProjectId,
        )
        const targetProject = customProjectsRef.current.find(
          p => p.id === targetProjectId,
        )
        if (!sourceProject || !targetProject) {
          console.error('プロジェクトが見つかりません')
          return null
        }
        const urlItem = sourceProject.urls?.find(item => item.url === url)
        if (!urlItem) {
          console.error('移動するURLが見つかりません')
          return null
        }

        const existsInTarget =
          targetProject.urls?.some(item => item.url === url) || false
        if (existsInTarget) {
          console.log('移動先に既にURLが存在するため、移動をスキップします')
          toast.info('移動先のプロジェクトに既にこのURLが存在します')
          return null
        }

        const originalCategory = urlItem.category
        await removeUrlFromCustomProject(sourceProjectId, url)
        await addUrlToCustomProject(
          targetProjectId,
          url,
          urlItem.title,
          urlItem.notes,
          originalCategory,
        )

        setCustomProjects(prev =>
          prev.map(project => {
            if (project.id === sourceProjectId) {
              return {
                ...project,
                urls: project.urls?.filter(item => item.url !== url) || [],
                updatedAt: Date.now(),
              }
            }
            if (project.id === targetProjectId) {
              return {
                ...project,
                urls: [
                  ...(project.urls || []),
                  {
                    ...urlItem,
                    category: originalCategory,
                    savedAt: Date.now(),
                  },
                ],
                updatedAt: Date.now(),
              }
            }
            return project
          }),
        )
        toast.success('URLを移動しました')
        return originalCategory
      } catch (error) {
        console.error('URL移動エラー:', error)
        toast.error('URLの移動に失敗しました')
        return null
      }
    },
    [customProjectsRef, setCustomProjects],
  )

  // カテゴリ間でURLを移動するハンドラ
  const handleMoveUrlsBetweenCategories = useCallback(
    async (
      projectId: string,
      sourceCategoryName: string,
      targetCategoryName: string,
    ) => {
      try {
        console.log(
          `カテゴリ間URL移動: ${sourceCategoryName} → ${targetCategoryName}, プロジェクト: ${projectId}`,
        )
        const project = customProjectsRef.current.find(p => p.id === projectId)
        if (!project) {
          console.error('プロジェクトが見つかりません')
          return
        }

        const urlsToMove =
          project.urls?.filter(item => item.category === sourceCategoryName) ||
          []
        console.log(
          `カテゴリ "${sourceCategoryName}" のURL数: ${urlsToMove.length}`,
        )
        console.log(
          `カテゴリ "${targetCategoryName}" のURL数: ${project.urls?.filter(item => item.category === targetCategoryName).length || 0}`,
        )

        if (urlsToMove.length === 0) {
          await removeCategoryFromProject(projectId, sourceCategoryName)
          toast.success(
            `カテゴリ「${sourceCategoryName}」を「${targetCategoryName}」に統合しました`,
          )
          setCustomProjects(prev =>
            prev.map(p => {
              if (p.id !== projectId) return p
              return {
                ...p,
                categories: p.categories.filter(c => c !== sourceCategoryName),
                categoryOrder: p.categoryOrder
                  ? p.categoryOrder.filter(c => c !== sourceCategoryName)
                  : undefined,
                updatedAt: Date.now(),
              }
            }),
          )
          return
        }

        let successCount = 0
        for (const urlItem of urlsToMove) {
          try {
            await setUrlCategory(projectId, urlItem.url, targetCategoryName)
            successCount++
          } catch (error) {
            console.error(`URL ${urlItem.url} の移動に失敗:`, error)
          }
        }

        setCustomProjects(prev =>
          prev.map(p => {
            if (p.id !== projectId) return p
            return {
              ...p,
              urls:
                p.urls?.map(item => {
                  if (item.category === sourceCategoryName) {
                    return { ...item, category: targetCategoryName }
                  }
                  return item
                }) || [],
              updatedAt: Date.now(),
            }
          }),
        )

        if (successCount > 0) {
          await removeCategoryFromProject(projectId, sourceCategoryName)
          toast.success(
            `カテゴリ「${sourceCategoryName}」から「${targetCategoryName}」へ ${successCount} 件のURLを移動しました`,
          )
        }
      } catch (error) {
        console.error('カテゴリ間URL移動エラー:', error)
        toast.error('URLの移動に失敗しました')
      }
    },
    [customProjectsRef, setCustomProjects],
  )

  return (
    <>
      <Toaster />
      <div className='container mx-auto min-h-screen px-4 py-2'>
        <Header
          tabGroups={tabGroups}
          filteredTabGroups={
            viewMode === 'domain'
              ? hasContentTabGroups
              : // カスタムモードの場合、filteredCustomProjectsからTabGroup形式に変換
                filteredCustomProjects
                  .filter(
                    (proj): proj is NonNullable<typeof proj> => proj !== null,
                  )
                  .map(
                    proj =>
                      ({
                        id: proj.id,
                        domain: proj.name, // プロジェクト名をドメインとして使用
                        urls: proj.urls || [],
                      }) as TabGroup,
                  )
          }
          customProjects={customProjects}
          onAddCategory={handleAddCategory}
          currentMode={viewMode}
          onModeChange={handleViewModeChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        {isLoading ? (
          <div className='flex min-h-[200px] items-center justify-center'>
            <div className='text-foreground text-xl'>読み込み中...</div>
          </div>
        ) : viewMode === 'domain' ? (
          // ドメインモード表示（既存の表示）
          <>
            {/* 既存のドメインモード表示コード */}
            {settings.enableCategories &&
              Object.keys(categorized).length > 0 && (
                <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleCategoryDragEnd}
                  >
                    <SortableContext
                      items={
                        isCategoryReorderMode
                          ? tempCategoryOrder
                          : categoryOrder
                      }
                      strategy={verticalListSortingStrategy}
                    >
                      <div className='flex flex-col gap-1'>
                        {/* カテゴリ順序に基づいて表示（並び替えモード中は一時的な順序を使用） */}
                        {(isCategoryReorderMode
                          ? tempCategoryOrder
                          : categoryOrder
                        ).map(categoryId => {
                          if (!categoryId) return null
                          const category = categories.find(
                            c => c.id === categoryId,
                          )
                          if (!category) return null
                          const domainGroups = categorized[categoryId] || []
                          if (domainGroups.length === 0) return null

                          return (
                            <CategoryGroup
                              key={categoryId}
                              category={category}
                              domains={domainGroups}
                              handleOpenAllTabs={handleOpenAllTabs}
                              handleDeleteGroup={handleDeleteGroup}
                              handleDeleteUrl={handleDeleteUrl}
                              handleOpenTab={handleOpenTab}
                              handleUpdateUrls={handleUpdateUrls}
                              handleUpdateDomainsOrder={
                                handleUpdateDomainsOrder
                              }
                              handleMoveDomainToCategory={(
                                domainId,
                                fromCategoryId,
                                toCategoryId,
                              ) =>
                                handleMoveDomainToCategory(
                                  domainId,
                                  fromCategoryId,
                                  toCategoryId,
                                  tabGroups,
                                )
                              }
                              handleDeleteCategory={(groupId, categoryName) =>
                                handleDeleteCategory(
                                  groupId,
                                  categoryName,
                                  refreshTabGroupsWithUrls,
                                )
                              }
                              settings={settings}
                              isCategoryReorderMode={isCategoryReorderMode}
                              searchQuery={searchQuery}
                            />
                          )
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {(() => {
                    // 検索でヒットしないカテゴリは非表示
                    const hasSearchQuery = searchQuery.trim().length > 0
                    const visibleUncategorizedGroups = uncategorized.filter(
                      group => (group.urls || group.urlIds || []).length > 0,
                    )

                    // 検索なしの場合：未分類ドメインが存在すれば表示
                    // 検索ありの場合：検索でヒットしたドメインがあれば表示
                    const shouldShowTitle = hasSearchQuery
                      ? visibleUncategorizedGroups.length > 0
                      : uncategorized.length > 0

                    return shouldShowTitle
                  })() && (
                    <div className='sticky top-0 z-50 mt-6 flex items-center justify-between bg-card'>
                      <h2 className='font-bold text-foreground text-xl'>
                        未分類のドメイン
                      </h2>

                      {/* 未分類ドメイン並び替えモード中の確定・キャンセルボタン */}
                      {isUncategorizedReorderMode && (
                        <div className='pointer-events-auto ml-2 flex flex-shrink-0 gap-2'>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={handleCancelUncategorizedReorder}
                                className='flex cursor-pointer items-center gap-1'
                                aria-label='並び替えをキャンセル'
                              >
                                <X size={14} />
                                <span className='hidden lg:inline'>
                                  キャンセル
                                </span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent
                              side='top'
                              className='block lg:hidden'
                            >
                              並び替えをキャンセル
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant='default'
                                size='sm'
                                onClick={handleConfirmUncategorizedReorder}
                                className='flex cursor-pointer items-center gap-1'
                                aria-label='並び替えを確定'
                              >
                                <Check size={14} />
                                <span className='hidden lg:inline'>確定</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent
                              side='top'
                              className='block lg:hidden'
                            >
                              並び替えを確定
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

            {/* 未分類タブを表示する部分 */}
            {uncategorized.filter(
              group => (group.urls || group.urlIds || []).length > 0,
            ).length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleUncategorizedDragEnd}
              >
                <SortableContext
                  items={(isUncategorizedReorderMode
                    ? tempUncategorizedOrder
                    : uncategorized
                  )
                    .filter(
                      group => (group.urls || group.urlIds || []).length > 0,
                    )
                    .map(group => group.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className='mt-2 flex flex-col gap-1'>
                    {(isUncategorizedReorderMode
                      ? tempUncategorizedOrder
                      : uncategorized
                    )
                      .filter(
                        group => (group.urls || group.urlIds || []).length > 0,
                      )
                      .map(group => (
                        <SortableDomainCard
                          key={group.id}
                          group={group}
                          handleOpenAllTabs={handleOpenAllTabs}
                          handleDeleteGroup={handleDeleteGroup}
                          handleDeleteUrl={handleDeleteUrl}
                          handleOpenTab={handleOpenTab}
                          handleUpdateUrls={handleUpdateUrls}
                          handleDeleteCategory={(groupId, categoryName) =>
                            handleDeleteCategory(
                              groupId,
                              categoryName,
                              refreshTabGroupsWithUrls,
                            )
                          }
                          settings={settings}
                          isReorderMode={isUncategorizedReorderMode}
                          searchQuery={searchQuery}
                        />
                      ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* すべてのカテゴリとドメインが空の場合のメッセージ */}
            {hasContentTabGroups.length === 0 && (
              <div className='flex min-h-[200px] flex-col items-center justify-center gap-4'>
                <div className='text-2xl text-foreground'>
                  保存されたタブはありません
                </div>
                <div className='text-muted-foreground'>
                  タブを右クリックして保存するか、拡張機能のアイコンをクリックしてください
                </div>
              </div>
            )}
          </>
        ) : (
          // カスタムモード表示
          <CustomProjectSection
            projects={filteredCustomProjects.filter(
              (proj): proj is NonNullable<typeof proj> => proj !== null,
            )}
            handleOpenUrl={handleOpenTab}
            handleDeleteUrl={handleDeleteUrlFromProject}
            handleAddUrl={handleAddUrlToProject}
            handleCreateProject={handleCreateProject}
            handleDeleteProject={handleDeleteProject}
            handleRenameProject={handleRenameProject}
            handleAddCategory={handleAddCategory}
            handleDeleteCategory={handleDeleteProjectCategory}
            handleSetUrlCategory={handleSetUrlCategory}
            handleUpdateCategoryOrder={handleUpdateCategoryOrder}
            handleReorderUrls={handleReorderUrls}
            handleOpenAllUrls={handleOpenAllTabs}
            handleMoveUrlBetweenProjects={handleMoveUrlBetweenProjects}
            handleMoveUrlsBetweenCategories={handleMoveUrlsBetweenCategories}
            handleReorderProjects={handleReorderProjects} // 追加: プロジェクト順序更新ハンドラー
            handleRenameCategory={handleRenameCategory} // 追加: カテゴリ名変更ハンドラー
            settings={settings}
          />
        )}

        {/* ...existing code... */}
        {/* 子カテゴリ追加モーダル */}
        {showSubCategoryModal && (
          <Dialog
            open={showSubCategoryModal}
            onOpenChange={setShowSubCategoryModal}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新しい子カテゴリを追加</DialogTitle>
              </DialogHeader>
              <Input
                value={newSubCategory}
                onChange={e => setNewSubCategory(e.target.value)}
                placeholder='例: 仕事、プライベート、学習'
                className='mb-4 w-full rounded border p-2 text-foreground'
                ref={inputRef}
              />
              <DialogFooter>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setShowSubCategoryModal(false)}
                      className='cursor-pointer rounded px-2 py-1 text-secondary-foreground'
                    >
                      キャンセル
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top' className='block lg:hidden'>
                    キャンセル
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='default'
                      size='sm'
                      onClick={handleAddSubCategory}
                      className='flex cursor-pointer items-center gap-1 rounded text-primary-foreground'
                    >
                      <Plus size={14} />
                      <span className='hidden lg:inline'>追加</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top' className='block lg:hidden'>
                    追加
                  </TooltipContent>
                </Tooltip>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* 親カテゴリ並び替え専用フッター */}
        {isCategoryReorderMode && viewMode === 'domain' && (
          <CategoryReorderFooter
            onConfirmCategoryReorder={handleConfirmCategoryReorder}
            onCancelCategoryReorder={handleCancelCategoryReorder}
          />
        )}
      </div>
    </>
  )
}

// Reactコンポーネントをレンダリング
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app')
  if (!appContainer) throw new Error('Failed to find the app container')

  const root = createRoot(appContainer)
  root.render(
    <ThemeProvider defaultTheme='system' storageKey='tab-manager-theme'>
      <TooltipProvider>
        {isDevProfileEnabled ? (
          <Profiler id='SavedTabs' onRender={handleSavedTabsRender}>
            <SavedTabs />
          </Profiler>
        ) : (
          <SavedTabs />
        )}
      </TooltipProvider>
    </ThemeProvider>,
  )
})
