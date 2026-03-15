import '@/assets/global.css'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
// lucide-reactからのアイコンインポート
import { Plus } from 'lucide-react'
import {
  type ProfilerOnRenderCallback,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
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
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { getPageHref } from '@/features/navigation/lib/pageNavigation'
import { CategoryReorderFooter } from '@/features/saved-tabs/components/Footer'
import { Header } from '@/features/saved-tabs/components/Header' // ヘッダーコンポーネントをインポート
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from '@/features/saved-tabs/components/shared/SavedTabsResponsive'
import { CustomModeContainer } from '@/features/saved-tabs/custom/CustomModeContainer'
import { DomainModeContainer } from '@/features/saved-tabs/domain/DomainModeContainer'
import { moveCustomProjectUrlAndSyncState } from '@/features/saved-tabs/lib/custom-project-move'
import { filterCustomProjectsByQuery } from '@/features/saved-tabs/lib/custom-project-search'
import { handleTabGroupRemoval } from '@/features/saved-tabs/lib/tab-operations'
import { shouldShowUncategorizedHeader as computeShouldShowUncategorizedHeader } from '@/features/saved-tabs/lib/uncategorized-display'
import { useSavedTabsCore } from '@/features/saved-tabs/shared/hooks/useSavedTabsCore'
import { syncStorageChanges } from '@/features/saved-tabs/shared/services/modeSyncService'
import { saveParentCategories } from '@/lib/storage/categories'
import {
  getCustomProjects,
  moveUrlBetweenCustomProjects,
  removeUrlFromAllCustomProjects,
  removeUrlsFromAllCustomProjects,
} from '@/lib/storage/projects'
import { defaultSettings } from '@/lib/storage/settings'
import {
  addSubCategoryToGroup,
  getTabGroupUrls,
  removeUrlFromTabGroup,
  removeUrlsFromTabGroup,
} from '@/lib/storage/tabs'
import type {
  ParentCategory,
  TabGroup,
  UserSettings,
  ViewMode,
} from '@/types/storage'

// プロダクションビルドではデバッグログを抑制する
if (!import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log = () => {}
  // eslint-disable-next-line no-console
  console.debug = () => {}
}

interface SavedTabsProfilerStats {
  commits: number
  phase: string
  actualDuration: number
}
type SavedTabsProfilerGlobal = typeof globalThis & {
  savedTabsProfiler?: SavedTabsProfilerStats
  enableSavedTabsProfiler?: boolean
}
const isDevProfileEnabled =
  import.meta.env.DEV &&
  Boolean((globalThis as SavedTabsProfilerGlobal).enableSavedTabsProfiler)
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
  ;(globalThis as SavedTabsProfilerGlobal).savedTabsProfiler = stats
  console.log(
    `[Profiler] SavedTabs commit #${savedTabsCommitCount} phase=${phase} actual=${actualDuration.toFixed(2)}ms`,
  )
}
const matchesParentCategoryQuery = (
  group: TabGroup,
  categories: ParentCategory[],
  query: string,
): boolean => {
  if (group.parentCategoryId) {
    const parentCategory = categories.find(
      cat => cat.id === group.parentCategoryId,
    )
    if (parentCategory) {
      const matched = parentCategory.name.toLowerCase().includes(query)
      console.log(
        `親カテゴリ検索デバッグ: ドメイン ${group.domain}, 親カテゴリ「${parentCategory.name}」, クエリ「${query}」, マッチ: ${matched}`,
      )
      if (matched) {
        return true
      }
    } else {
      console.log(
        `親カテゴリ検索デバッグ: ドメイン ${group.domain}, parentCategoryId ${group.parentCategoryId} に対応するカテゴリが見つかりません`,
      )
    }
  }
  for (const category of categories) {
    if (
      category.domains?.includes(group.id) ||
      category.domainNames?.includes(group.domain)
    ) {
      const matched = category.name.toLowerCase().includes(query)
      if (matched) {
        console.log(
          `親カテゴリ検索デバッグ（リアルタイム）: ドメイン ${group.domain}, 親カテゴリ「${category.name}」, クエリ「${query}」, マッチ: ${matched}`,
        )
        return true
      }
    }
  }
  if (!group.parentCategoryId) {
    console.log(
      `親カテゴリ検索デバッグ: ドメイン ${group.domain}, parentCategoryIdが未設定かつカテゴリマッチなし`,
    )
  }
  return false
}
const filterGroupByQuery = (
  group: TabGroup,
  normalizedQuery: string,
  categories: ParentCategory[],
): TabGroup => {
  const currentUrls = group.urls || []
  if (currentUrls.length === 0) {
    return group
  }
  const parentCategoryMatched = matchesParentCategoryQuery(
    group,
    categories,
    normalizedQuery,
  )
  const filteredUrls = currentUrls.filter(item => {
    const matchesBasicFields =
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.url.toLowerCase().includes(normalizedQuery) ||
      group.domain.toLowerCase().includes(normalizedQuery)
    const matchesSubCategory = item.subCategory
      ?.toLowerCase()
      .includes(normalizedQuery)
    return matchesBasicFields || matchesSubCategory || parentCategoryMatched
  })
  if (filteredUrls.length === currentUrls.length) {
    return group
  }
  return {
    ...group,
    urls: filteredUrls,
  }
}
const hasDisplayableUrls = (group: TabGroup): boolean => {
  const hasNewUrls = Boolean(group.urlIds && group.urlIds.length > 0)
  const hasOldUrls = Boolean(group.urls && group.urls.length > 0)
  console.log(
    `フィルタチェック ${group.domain}: urlIds=${group.urlIds?.length || 0}, urls=${group.urls?.length || 0}, 表示=${hasNewUrls || hasOldUrls}`,
  )
  return hasNewUrls || hasOldUrls
}
const pushGroupToCategory = (
  categorizedGroups: Record<string, TabGroup[]>,
  categoryId: string,
  group: TabGroup,
): void => {
  if (!categorizedGroups[categoryId]) {
    categorizedGroups[categoryId] = []
  }
  const categorizedGroup =
    group.parentCategoryId === categoryId
      ? group
      : {
          ...group,
          parentCategoryId: categoryId,
        }
  categorizedGroups[categoryId].push(categorizedGroup)
}
const tryCategorizeById = (
  group: TabGroup,
  categories: ParentCategory[],
  categorizedGroups: Record<string, TabGroup[]>,
): boolean => {
  for (const category of categories) {
    if (category.domains?.includes(group.id)) {
      pushGroupToCategory(categorizedGroups, category.id, group)
      if (group.parentCategoryId !== category.id) {
        console.log(
          `ドメイン ${group.domain} のparentCategoryIdをIDベースで ${category.id} に更新しました`,
        )
      }
      console.log(
        `ドメイン ${group.domain} はIDベースで ${category.name} に分類されました`,
      )
      return true
    }
  }
  return false
}
const tryCategorizeByDomainName = (
  group: TabGroup,
  categories: ParentCategory[],
  categorizedGroups: Record<string, TabGroup[]>,
): boolean => {
  for (const category of categories) {
    if (
      category.domainNames &&
      Array.isArray(category.domainNames) &&
      category.domainNames.includes(group.domain)
    ) {
      pushGroupToCategory(categorizedGroups, category.id, group)
      console.log(
        `ドメイン ${group.domain} はドメイン名ベースで ${category.name} に分類されました`,
      )
      console.log(
        `ドメイン ${group.domain} のparentCategoryIdを ${category.id} に設定しました`,
      )
      return true
    }
  }
  return false
}
const sortCategorizedGroups = (
  categorizedGroups: Record<string, TabGroup[]>,
  categories: ParentCategory[],
): void => {
  for (const categoryId of Object.keys(categorizedGroups)) {
    if (!categorizedGroups[categoryId]) {
      categorizedGroups[categoryId] = []
    }
    const category = categories.find(c => c.id === categoryId)
    const domains = category?.domains
    if (!(domains && domains.length > 0)) {
      continue
    }
    const domainArray = [...domains]
    categorizedGroups[categoryId].sort((a, b) => {
      const indexA = domainArray.indexOf(a.id)
      const indexB = domainArray.indexOf(b.id)
      if (indexA === -1) {
        return 1
      }
      if (indexB === -1) {
        return -1
      }
      return indexA - indexB
    })
  }
}
const removeMatchingUrlsFromGroup = async (
  group: TabGroup,
  urlSet: Set<string>,
): Promise<void> => {
  if (!group.urlIds || group.urlIds.length === 0) {
    return
  }
  const groupUrls = await getTabGroupUrls(group)
  const targets = groupUrls
    .filter(item => urlSet.has(item.url))
    .map(item => item.url)

  if (targets.length > 0) {
    await removeUrlsFromTabGroup(group.id, targets)
  }
}
interface CategorySyncState {
  updatedSavedTabs: TabGroup[]
  updatedCategories: ParentCategory[]
  savedTabsChanged: boolean
  categoriesChanged: boolean
}
const updateSavedTabParentCategory = (
  tabs: TabGroup[],
  groupId: string,
  categoryId: string,
): TabGroup[] => {
  return tabs.map(tab =>
    tab.id === groupId
      ? {
          ...tab,
          parentCategoryId: categoryId,
        }
      : tab,
  )
}
const syncGroupCategoryAssignment = (
  group: TabGroup,
  categories: ParentCategory[],
  state: CategorySyncState,
): CategorySyncState => {
  const idBasedCategory = categories.find(c => c.domains?.includes(group.id))
  if (idBasedCategory && group.parentCategoryId !== idBasedCategory.id) {
    state.updatedSavedTabs = updateSavedTabParentCategory(
      state.updatedSavedTabs,
      group.id,
      idBasedCategory.id,
    )
    state.savedTabsChanged = true
    console.log(
      `[カテゴリ同期] ドメイン ${group.domain} のparentCategoryIdをIDベースで ${idBasedCategory.id} に更新しました`,
    )
  }
  const foundByDomainName = categories.find(
    category =>
      !category.domains?.includes(group.id) &&
      category.domainNames?.includes(group.domain),
  )
  if (!foundByDomainName) {
    return state
  }
  state.updatedCategories = state.updatedCategories.map(category =>
    category.id === foundByDomainName.id
      ? {
          ...category,
          domains: [...category.domains, group.id],
        }
      : category,
  )
  state.categoriesChanged = true
  state.updatedSavedTabs = updateSavedTabParentCategory(
    state.updatedSavedTabs,
    group.id,
    foundByDomainName.id,
  )
  state.savedTabsChanged = true
  console.log(
    `[カテゴリ同期] ドメイン ${group.domain} のIDを親カテゴリ ${foundByDomainName.id} に同期しました`,
  )
  return state
}
const organizeTabGroupsWithCategories = ({
  enableCategories,
  tabGroupsWithUrls,
  categories,
  searchQuery,
}: {
  enableCategories: boolean
  tabGroupsWithUrls: TabGroup[]
  categories: ParentCategory[]
  searchQuery: string
}): {
  categorized: Record<string, TabGroup[]>
  uncategorized: TabGroup[]
} => {
  if (!enableCategories) {
    return {
      categorized: {},
      uncategorized: tabGroupsWithUrls,
    }
  }
  console.log('親カテゴリ一覧:', categories)
  console.log('organizeTabGroups開始:')
  console.log('- tabGroupsWithUrls:', tabGroupsWithUrls)
  console.log('- tabGroupsWithUrls.length:', tabGroupsWithUrls.length)
  const categorizedGroups: Record<string, TabGroup[]> = {}
  const uncategorizedGroups: TabGroup[] = []
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const hasSearchQuery = normalizedQuery.length > 0
  const groupsToOrganize = tabGroupsWithUrls
    .map(group =>
      hasSearchQuery
        ? filterGroupByQuery(group, normalizedQuery, categories)
        : group,
    )
    .filter(hasDisplayableUrls)
  console.log('groupsToOrganize:', groupsToOrganize)
  console.log('groupsToOrganize.length:', groupsToOrganize.length)
  for (const group of groupsToOrganize) {
    const categorizedById = tryCategorizeById(
      group,
      categories,
      categorizedGroups,
    )
    if (categorizedById) {
      continue
    }
    const categorizedByDomainName = tryCategorizeByDomainName(
      group,
      categories,
      categorizedGroups,
    )
    if (!categorizedByDomainName) {
      uncategorizedGroups.push(group)
      console.log(`ドメイン ${group.domain} は未分類です`)
    }
  }
  sortCategorizedGroups(categorizedGroups, categories)
  console.log('organizeTabGroups結果:')
  console.log('- categorizedGroups:', categorizedGroups)
  console.log('- uncategorizedGroups:', uncategorizedGroups)
  console.log('- uncategorizedGroups.length:', uncategorizedGroups.length)
  return {
    categorized: categorizedGroups,
    uncategorized: uncategorizedGroups,
  }
}

const resolveSavedTabsViewModeHref = (viewMode: ViewMode): string =>
  getPageHref(viewMode === 'custom' ? 'saved-tabs-custom' : 'saved-tabs-domain')

const shouldWaitForInitialViewMode = ({
  hasResolvedInitialViewMode,
  initialViewMode,
  viewMode,
}: {
  hasResolvedInitialViewMode: boolean
  initialViewMode?: ViewMode
  viewMode: ViewMode
}): boolean => {
  if (!initialViewMode || hasResolvedInitialViewMode) {
    return false
  }

  return viewMode !== initialViewMode
}

const syncSavedTabsViewModeLocation = ({
  onViewModeNavigate,
  viewMode,
}: {
  onViewModeNavigate?: (mode: ViewMode) => void
  viewMode: ViewMode
}): void => {
  if (onViewModeNavigate) {
    onViewModeNavigate(viewMode)
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  const nextHref = resolveSavedTabsViewModeHref(viewMode)
  const currentUrl = new URL(window.location.href)
  const nextUrl = new URL(nextHref, window.location.href)

  if (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search === nextUrl.search
  ) {
    return
  }

  window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`)
}

const SavedTabsApp = ({
  initialViewMode,
  isAiSidebarOpen = false,
  onViewModeNavigate,
}: {
  initialViewMode?: ViewMode
  isAiSidebarOpen?: boolean
  onViewModeNavigate?: (mode: ViewMode) => void
}) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [newSubCategory, setNewSubCategory] = useState('')
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const hasResolvedInitialViewModeRef = useRef(!initialViewMode)

  useEffect(() => {
    hasResolvedInitialViewModeRef.current = !initialViewMode
  }, [initialViewMode])

  // 未分類ドメインの並び替えモード状態管理
  const [isUncategorizedReorderMode, setIsUncategorizedReorderMode] =
    useState(false)
  const [_originalUncategorizedOrder, setOriginalUncategorizedOrder] = useState<
    TabGroup[]
  >([])
  const [tempUncategorizedOrder, setTempUncategorizedOrder] = useState<
    TabGroup[]
  >([])

  const { categoryState, tabDataState, projectState } = useSavedTabsCore(
    settings,
    setSettings,
    initialViewMode,
  )
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
  } = categoryState
  const { tabGroups, isLoading, tabGroupsWithUrls, refreshTabGroupsWithUrls } =
    tabDataState
  const {
    customProjects,
    setCustomProjects,
    viewMode,
    viewModeRef,
    syncDomainDataToCustomProjects,
    handleViewModeChange,
    handleCreateProject,
    handleDeleteProject,
    handleRenameProject,
    handleUpdateProjectKeywords,
    handleAddUrlToProject,
    handleDeleteUrlFromProject,
    handleDeleteUrlsFromProject,
    handleAddCategory,
    handleDeleteProjectCategory,
    handleSetUrlCategory,
    handleUpdateCategoryOrder,
    handleReorderUrls,
    handleReorderProjects,
    handleRenameCategory,
  } = projectState
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
      const uniqueUrlSet = new Set(urlsToRemove)
      const storageResult = await chrome.storage.local.get('savedTabs')
      const savedTabs: TabGroup[] = Array.isArray(storageResult.savedTabs)
        ? storageResult.savedTabs
        : []
      for (const group of savedTabs) {
        await removeMatchingUrlsFromGroup(group, uniqueUrlSet)
      }
      await refreshTabGroupsWithUrls()
    },
    [refreshTabGroupsWithUrls],
  )

  // 既存のタブ開く処理を拡張して両方のモードで同期する
  const handleOpenTab = useCallback(
    async (url: string) => {
      try {
        // 設定に基づきバックグラウンド(active: false)またはフォアグラウンド(active: true)で開く
        await chrome.tabs.create({
          url,
          active: !settings.openUrlInBackground,
        })

        // 設定に基づいて、開いたタブを削除するかどうかを決定（新形式対応）
        if (settings.removeTabAfterOpen) {
          await removeOpenedUrlsFromStorage([url])
          console.log(`URL ${url} を開いた後、保存データから削除しました`)
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
    async (
      urls: {
        url: string
        title: string
      }[],
    ) => {
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
            `${urls.length}個のURLを開いた後、保存データから削除しました`,
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

  /**
   * 指定のタブグループ内のURLをすべてカスタムプロジェクトからも削除します。
   */
  const removeUrlsFromCustomProjectsForGroup = async (
    groupToDelete: TabGroup,
  ) => {
    try {
      const urlsToDelete = await getTabGroupUrls(groupToDelete)
      if (urlsToDelete && urlsToDelete.length > 0) {
        for (const item of urlsToDelete) {
          try {
            await removeUrlFromAllCustomProjects(item.url)
          } catch (err) {
            console.error(
              `URL ${item.url} のカスタムプロジェクト同期削除エラー:`,
              err,
            )
          }
        }
      }
    } catch (err) {
      console.error('URL一覧の取得または削除エラー:', err)
    }
  }

  /**
   * 複数のドメイングループに属するURLをすべてカスタムプロジェクトから一括削除します。
   */
  const removeUrlsFromCustomProjectsForGroups = async (
    groupsToDelete: TabGroup[],
  ) => {
    try {
      const allUrlsToDelete: string[] = []

      for (const group of groupsToDelete) {
        const urlsToDelete = await getTabGroupUrls(group)
        if (urlsToDelete && urlsToDelete.length > 0) {
          allUrlsToDelete.push(...urlsToDelete.map(item => item.url))
        }
      }

      if (allUrlsToDelete.length > 0) {
        try {
          await removeUrlsFromAllCustomProjects(allUrlsToDelete)
        } catch (err) {
          console.error('URL一括同期削除エラー:', err)
        }
      }
    } catch (err) {
      console.error('複数グループのURL取得エラー:', err)
    }
  }

  /**
   * 親カテゴリから指定されたドメインIDを削除して保存します。
   */
  const removeDomainFromParentCategories = async (
    id: string,
    categories: ParentCategory[],
    setCategories: (cats: ParentCategory[]) => void,
  ) => {
    const updatedCategories = categories.map(category => ({
      ...category,
      domains: category.domains.filter(domainId => domainId !== id),
    }))
    await saveParentCategories(updatedCategories)
    setCategories(updatedCategories)
  }

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
        if (!groupToDelete) {
          return
        }
        console.log(`グループを削除: ${groupToDelete.domain}`)

        // 専用の削除前処理関数を呼び出し（インポートした関数を使用）
        await handleTabGroupRemoval(id)

        // グループに属するすべてのURLをカスタムプロジェクトからも削除
        await removeUrlsFromCustomProjectsForGroup(groupToDelete)

        // 以降は従来通りの処理
        const updatedGroups = savedTabs.filter(group => group.id !== id)
        await chrome.storage.local.set({
          savedTabs: updatedGroups,
        })
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
        await removeDomainFromParentCategories(id, categories, setCategories)

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

  const handleDeleteGroups = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        return
      }
      try {
        const storageResult = await chrome.storage.local.get('savedTabs')
        const savedTabs: TabGroup[] = Array.isArray(storageResult.savedTabs)
          ? storageResult.savedTabs
          : []

        const groupsToDelete = savedTabs.filter(group => ids.includes(group.id))
        if (groupsToDelete.length === 0) {
          return
        }

        console.log(`${groupsToDelete.length}件のグループを一括削除します`)

        for (const id of ids) {
          await handleTabGroupRemoval(id)
        }

        await removeUrlsFromCustomProjectsForGroups(groupsToDelete)

        const idSet = new Set(ids)
        const updatedGroups = savedTabs.filter(group => !idSet.has(group.id))

        await chrome.storage.local.set({
          savedTabs: updatedGroups,
        })
        await refreshTabGroupsWithUrls(updatedGroups)

        if (isUncategorizedReorderMode) {
          setTempUncategorizedOrder(prev =>
            prev.filter(group => !idSet.has(group.id)),
          )
        }

        const updatedCategories = categories.map(category => ({
          ...category,
          domains: category.domains.filter(domainId => !idSet.has(domainId)),
        }))
        await saveParentCategories(updatedCategories)
        setCategories(updatedCategories)

        console.log('一括グループ削除処理が完了しました')
      } catch (error) {
        console.error('一括グループ削除エラー:', error)
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
  const handleDeleteUrls = useCallback(
    async (groupId: string, urls: string[]) => {
      if (urls.length === 0) {
        return
      }
      try {
        await removeUrlsFromTabGroup(groupId, urls)
        await refreshTabGroupsWithUrls()
        console.log(
          `${urls.length}件のURLをグループ ${groupId} から削除しました`,
        )
      } catch (error) {
        console.error('URL一括削除エラー:', error)
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
    if (!isUncategorizedReorderMode) {
      return
    }

    // 元の順序に戻す
    setTempUncategorizedOrder([])

    // 並び替えモードを終了
    setIsUncategorizedReorderMode(false)
    setOriginalUncategorizedOrder([])
    toast.info('未分類ドメインの並び替えをキャンセルしました')
  }, [isUncategorizedReorderMode])

  // タブグループをカテゴリごとに整理する関数を強化
  const organizeTabGroups = useCallback(
    (): {
      categorized: Record<string, TabGroup[]>
      uncategorized: TabGroup[]
    } =>
      organizeTabGroupsWithCategories({
        enableCategories: settings.enableCategories,
        tabGroupsWithUrls,
        categories,
        searchQuery,
      }),
    [tabGroupsWithUrls, categories, settings.enableCategories, searchQuery],
  )

  // tabGroupsWithUrls と categories が変わったとき、カテゴリ割り当ての不一致を
  // ストレージに反映するための副作用（organizeTabGroups から分離した副作用）
  useEffect(() => {
    if (!settings.enableCategories) {
      return
    }
    if (tabGroupsWithUrls.length === 0 || categories.length === 0) {
      return
    }
    const syncCategoryAssignments = async () => {
      try {
        const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
        const currentSavedTabs = savedTabs as TabGroup[]
        const currentCategories = [...categories]
        const syncState: CategorySyncState = {
          updatedSavedTabs: [...currentSavedTabs],
          updatedCategories: currentCategories.map(c => ({
            ...c,
          })),
          savedTabsChanged: false,
          categoriesChanged: false,
        }
        for (const group of tabGroupsWithUrls) {
          syncGroupCategoryAssignment(group, currentCategories, syncState)
        }
        if (syncState.categoriesChanged) {
          await saveParentCategories(syncState.updatedCategories)
        }
        if (syncState.savedTabsChanged) {
          await chrome.storage.local.set({
            savedTabs: syncState.updatedSavedTabs,
          })
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
          if (isUncategorizedReorderMode) {
            // 既に並び替えモード中：一時的な順序を更新
            setTempUncategorizedOrder(updatedOrder)
          } else {
            // 初回の並び替え時：並び替えモードを開始
            setIsUncategorizedReorderMode(true)
            setOriginalUncategorizedOrder([...uncategorized])
            setTempUncategorizedOrder(updatedOrder)
          }
        }
      }
    },
    [isUncategorizedReorderMode, tempUncategorizedOrder, uncategorized],
  )

  // 未分類ドメインの並び替えを確定する
  const handleConfirmUncategorizedReorder = useCallback(async () => {
    if (!isUncategorizedReorderMode) {
      return
    }
    try {
      const categorizedDomains = Object.values(categorized).flat()

      // 新しい順序：カテゴリ分類されたドメイン + 並び替えた未分類ドメイン
      const newTabGroups = [...categorizedDomains, ...tempUncategorizedOrder]

      // ストレージに保存
      await chrome.storage.local.set({
        savedTabs: newTabGroups,
      })
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

  const customProjectsForHeader = customProjects
  const [filteredCustomProjects, setFilteredCustomProjects] =
    useState(customProjects)

  const handleDeleteUrlFromCustomMode = useCallback(
    async (projectId: string, url: string) => {
      await handleDeleteUrlFromProject(projectId, url)
    },
    [handleDeleteUrlFromProject],
  )

  useEffect(() => {
    let isCancelled = false

    const syncFilteredCustomProjects = async () => {
      const nextProjects = await filterCustomProjectsByQuery({
        customProjects,
        searchQuery,
      })

      if (!isCancelled) {
        setFilteredCustomProjects(nextProjects)
      }
    }

    void syncFilteredCustomProjects()

    return () => {
      isCancelled = true
    }
  }, [customProjects, searchQuery])

  // ストレージ変更検出時のリスナーを改善（ドメインモードとカスタムモード間の同期）
  useEffect(() => {
    const handleStorageChanged = async (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => {
      console.log('ストレージ変更を検出:', changes)
      await syncStorageChanges({
        changes,
        viewModeRef,
        refreshTabGroupsWithUrls,
        syncDomainDataToCustomProjects,
        setSettings,
        setCategories,
        setCustomProjects,
      })
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

  useEffect(() => {
    if (
      shouldWaitForInitialViewMode({
        hasResolvedInitialViewMode: hasResolvedInitialViewModeRef.current,
        initialViewMode,
        viewMode,
      })
    ) {
      return
    }

    if (initialViewMode && !hasResolvedInitialViewModeRef.current) {
      hasResolvedInitialViewModeRef.current = true
    }

    syncSavedTabsViewModeLocation({ onViewModeNavigate, viewMode })
  }, [initialViewMode, onViewModeNavigate, viewMode])

  // カスタムプロジェクト間でURLを移動するハンドラ
  const handleMoveUrlBetweenProjects = useCallback(
    async (sourceProjectId: string, targetProjectId: string, url: string) => {
      try {
        console.log(
          `URL移動: ${sourceProjectId} → ${targetProjectId}, URL: ${url}`,
        )
        await moveCustomProjectUrlAndSyncState({
          sourceProjectId,
          targetProjectId,
          url,
          moveUrlBetweenCustomProjects,
          getCustomProjects,
          setCustomProjects,
        })
        toast.success('タブを移動しました')
        return null
      } catch (error) {
        console.error('URL移動エラー:', error)
        toast.error('タブの移動に失敗しました')
        return null
      }
    },
    [getCustomProjects, moveUrlBetweenCustomProjects, setCustomProjects],
  )

  // カテゴリ間でURLを移動するハンドラ
  const handleMoveUrlsBetweenCategories = useCallback(async () => {}, [])
  const visibleUncategorizedGroups = useMemo(
    () =>
      uncategorized.filter(
        group => (group.urls || group.urlIds || []).length > 0,
      ),
    [uncategorized],
  )
  const hasVisibleCategoryGroups =
    settings.enableCategories && Object.keys(categorized).length > 0
  const shouldShowUncategorizedSectionHeader =
    settings.enableCategories &&
    computeShouldShowUncategorizedHeader({
      searchQuery,
      uncategorizedCount: uncategorized.length,
      visibleUncategorizedCount: visibleUncategorizedGroups.length,
      isUncategorizedReorderMode,
    })
  const shouldShowUncategorizedList = visibleUncategorizedGroups.length > 0
  const headerFilteredTabGroups = useMemo(() => {
    if (viewMode === 'domain') {
      return hasContentTabGroups
    }
    return filteredCustomProjects.map(
      project =>
        ({
          id: project.id,
          domain: project.name,
          urls: project.urls || [],
          urlIds: project.urlIds || [],
        }) as TabGroup,
    )
  }, [viewMode, hasContentTabGroups, filteredCustomProjects])
  const customProjectsForDisplay = filteredCustomProjects
  const shouldShowCategoryReorderFooter =
    isCategoryReorderMode && viewMode === 'domain'
  const categoryOrderForDisplay = isCategoryReorderMode
    ? tempCategoryOrder
    : categoryOrder
  const uncategorizedForDisplay = (
    isUncategorizedReorderMode ? tempUncategorizedOrder : uncategorized
  ).filter(group => (group.urls || group.urlIds || []).length > 0)

  const renderMainContent = () => {
    if (viewMode === 'domain') {
      return (
        <DomainModeContainer
          isLoading={isLoading}
          settings={settings}
          categories={categories}
          categorized={categorized}
          categoryOrderForDisplay={categoryOrderForDisplay}
          tabGroups={tabGroups}
          isCategoryReorderMode={isCategoryReorderMode}
          searchQuery={searchQuery}
          sensors={sensors}
          handleCategoryDragEnd={handleCategoryDragEnd}
          handleOpenAllTabs={handleOpenAllTabs}
          handleDeleteGroup={handleDeleteGroup}
          handleDeleteGroups={handleDeleteGroups}
          handleDeleteUrl={handleDeleteUrl}
          handleDeleteUrls={handleDeleteUrls}
          handleOpenTab={handleOpenTab}
          handleUpdateUrls={handleUpdateUrls}
          handleUpdateDomainsOrder={handleUpdateDomainsOrder}
          handleMoveDomainToCategory={handleMoveDomainToCategory}
          handleDeleteCategory={(groupId, categoryName) =>
            handleDeleteCategory(
              groupId,
              categoryName,
              refreshTabGroupsWithUrls,
            )
          }
          shouldShowUncategorizedSectionHeader={
            shouldShowUncategorizedSectionHeader
          }
          hasVisibleCategoryGroups={hasVisibleCategoryGroups}
          isUncategorizedReorderMode={isUncategorizedReorderMode}
          handleCancelUncategorizedReorder={handleCancelUncategorizedReorder}
          handleConfirmUncategorizedReorder={handleConfirmUncategorizedReorder}
          shouldShowUncategorizedList={shouldShowUncategorizedList}
          uncategorizedForDisplay={uncategorizedForDisplay}
          handleUncategorizedDragEnd={handleUncategorizedDragEnd}
          hasContentTabGroupsCount={hasContentTabGroups.length}
        />
      )
    }
    return (
      <CustomModeContainer
        isLoading={isLoading}
        projects={customProjectsForDisplay}
        settings={settings}
        handleOpenUrl={handleOpenTab}
        handleDeleteUrl={handleDeleteUrlFromCustomMode}
        handleDeleteUrlsFromProject={handleDeleteUrlsFromProject}
        handleAddUrl={handleAddUrlToProject}
        handleCreateProject={handleCreateProject}
        handleDeleteProject={handleDeleteProject}
        handleRenameProject={handleRenameProject}
        handleUpdateProjectKeywords={handleUpdateProjectKeywords}
        handleAddCategory={handleAddCategory}
        handleDeleteCategory={handleDeleteProjectCategory}
        handleSetUrlCategory={handleSetUrlCategory}
        handleUpdateCategoryOrder={handleUpdateCategoryOrder}
        handleReorderUrls={handleReorderUrls}
        handleOpenAllUrls={handleOpenAllTabs}
        handleMoveUrlBetweenProjects={handleMoveUrlBetweenProjects}
        handleMoveUrlsBetweenCategories={handleMoveUrlsBetweenCategories}
        handleReorderProjects={handleReorderProjects}
        handleRenameCategory={handleRenameCategory}
      />
    )
  }
  const renderSubCategoryModal = () => {
    if (!showSubCategoryModal) {
      return null
    }
    return (
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
              <TooltipTrigger asChild={true}>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setShowSubCategoryModal(false)}
                  className='cursor-pointer rounded px-2 py-1 text-secondary-foreground'
                >
                  キャンセル
                </Button>
              </TooltipTrigger>
              <SavedTabsResponsiveTooltipContent side='top'>
                キャンセル
              </SavedTabsResponsiveTooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild={true}>
                <Button
                  variant='default'
                  size='sm'
                  onClick={handleAddSubCategory}
                  className='flex cursor-pointer items-center gap-1 rounded text-primary-foreground'
                >
                  <Plus size={14} />
                  <SavedTabsResponsiveLabel>追加</SavedTabsResponsiveLabel>
                </Button>
              </TooltipTrigger>
              <SavedTabsResponsiveTooltipContent side='top'>
                追加
              </SavedTabsResponsiveTooltipContent>
            </Tooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <>
      <Toaster />
      <div
        className={
          isAiSidebarOpen
            ? 'min-h-screen w-full py-2'
            : 'container mx-auto min-h-screen py-2'
        }
      >
        <Header
          tabGroups={tabGroups}
          filteredTabGroups={headerFilteredTabGroups}
          customProjects={customProjectsForHeader}
          filteredCustomProjects={filteredCustomProjects}
          onCreateProject={handleCreateProject}
          currentMode={viewMode}
          onModeChange={handleViewModeChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        {renderMainContent()}
        {renderSubCategoryModal()}
        {shouldShowCategoryReorderFooter && (
          <CategoryReorderFooter
            onConfirmCategoryReorder={handleConfirmCategoryReorder}
            onCancelCategoryReorder={handleCancelCategoryReorder}
          />
        )}
      </div>
    </>
  )
}

export { SavedTabsApp, handleSavedTabsRender, isDevProfileEnabled }
