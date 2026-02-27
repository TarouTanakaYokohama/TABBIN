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
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
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
import { shouldShowUncategorizedHeader as computeShouldShowUncategorizedHeader } from '@/features/saved-tabs/lib/uncategorized-display'
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

interface SavedTabsProfilerStats {
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
  !!(globalThis as SavedTabsProfilerGlobal).__ENABLE_SAVED_TABS_PROFILER
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

function matchesParentCategoryQuery(
  group: TabGroup,
  categories: ParentCategory[],
  query: string,
): boolean {
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

function filterGroupByQuery(
  group: TabGroup,
  normalizedQuery: string,
  categories: ParentCategory[],
): TabGroup {
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
  return { ...group, urls: filteredUrls }
}

function hasDisplayableUrls(group: TabGroup): boolean {
  const hasNewUrls = Boolean(group.urlIds && group.urlIds.length > 0)
  const hasOldUrls = Boolean(group.urls && group.urls.length > 0)
  console.log(
    `フィルタチェック ${group.domain}: urlIds=${group.urlIds?.length || 0}, urls=${group.urls?.length || 0}, 表示=${hasNewUrls || hasOldUrls}`,
  )
  return hasNewUrls || hasOldUrls
}

function pushGroupToCategory(
  categorizedGroups: Record<string, TabGroup[]>,
  categoryId: string,
  group: TabGroup,
): void {
  if (!categorizedGroups[categoryId]) {
    categorizedGroups[categoryId] = []
  }
  const categorizedGroup =
    group.parentCategoryId === categoryId
      ? group
      : { ...group, parentCategoryId: categoryId }
  categorizedGroups[categoryId].push(categorizedGroup)
}

function tryCategorizeById(
  group: TabGroup,
  categories: ParentCategory[],
  categorizedGroups: Record<string, TabGroup[]>,
): boolean {
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

function tryCategorizeByDomainName(
  group: TabGroup,
  categories: ParentCategory[],
  categorizedGroups: Record<string, TabGroup[]>,
): boolean {
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

function sortCategorizedGroups(
  categorizedGroups: Record<string, TabGroup[]>,
  categories: ParentCategory[],
): void {
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

async function removeMatchingUrlsFromGroup(
  group: TabGroup,
  urlSet: Set<string>,
): Promise<void> {
  if (!group.urlIds || group.urlIds.length === 0) {
    return
  }

  const groupUrls = await getTabGroupUrls(group)
  const targets = groupUrls
    .filter(item => urlSet.has(item.url))
    .map(item => item.url)

  for (const targetUrl of targets) {
    await removeUrlFromTabGroup(group.id, targetUrl)
  }
}

async function removeMatchingUrlsFromProject(
  project: CustomProject,
  urlSet: Set<string>,
): Promise<void> {
  const projectUrls = await getProjectUrls(project)
  const targets = projectUrls
    .filter(item => urlSet.has(item.url))
    .map(item => item.url)

  for (const targetUrl of targets) {
    await removeUrlFromCustomProject(project.id, targetUrl)
  }
}

interface CategorySyncState {
  updatedSavedTabs: TabGroup[]
  updatedCategories: ParentCategory[]
  savedTabsChanged: boolean
  categoriesChanged: boolean
}

function updateSavedTabParentCategory(
  tabs: TabGroup[],
  groupId: string,
  categoryId: string,
): TabGroup[] {
  return tabs.map(tab =>
    tab.id === groupId ? { ...tab, parentCategoryId: categoryId } : tab,
  )
}

function syncGroupCategoryAssignment(
  group: TabGroup,
  categories: ParentCategory[],
  state: CategorySyncState,
): CategorySyncState {
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
      ? { ...category, domains: [...category.domains, group.id] }
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

function organizeTabGroupsWithCategories({
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
} {
  if (!enableCategories) {
    return { categorized: {}, uncategorized: tabGroupsWithUrls }
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

function filterCustomProjectsByQuery(
  customProjects: CustomProject[],
  searchQuery: string,
): CustomProject[] {
  const q = searchQuery.trim()
  if (!q) {
    return customProjects
  }

  const query = q.toLowerCase()
  const projectFuse = new Fuse(customProjects, {
    keys: ['name'],
    threshold: 0.4,
  })
  const matchedProjects = projectFuse.search(q).map(res => res.item)

  const categoryMatchedProjects = customProjects
    .filter(proj => !matchedProjects.includes(proj))
    .filter(proj =>
      proj.categories.some(category => category.toLowerCase().includes(query)),
    )

  const urlFuseOptions = { keys: ['title', 'url'], threshold: 0.4 }
  const urlMatchedProjects = customProjects
    .filter(
      proj =>
        !(
          matchedProjects.includes(proj) ||
          categoryMatchedProjects.includes(proj)
        ),
    )
    .map(proj => {
      const projectUrls = proj.urls || []
      const fuseUrls = new Fuse(projectUrls, urlFuseOptions)
      const fuseMatches = fuseUrls.search(q).map(r => r.item)
      const categoryMatches = projectUrls.filter(url =>
        url.category?.toLowerCase().includes(query),
      )
      const allMatches = [...fuseMatches, ...categoryMatches]
      const uniqueMatches = allMatches.filter(
        (url, index, self) => self.findIndex(u => u.url === url.url) === index,
      )
      return uniqueMatches.length > 0 ? { ...proj, urls: uniqueMatches } : null
    })
    .filter(
      (proj: CustomProject | null): proj is CustomProject => proj !== null,
    )

  return [
    ...matchedProjects,
    ...categoryMatchedProjects,
    ...urlMatchedProjects,
  ].filter((project): project is CustomProject => project !== null)
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

      const uniqueUrlSet = new Set(urlsToRemove)
      const storageResult = await chrome.storage.local.get('savedTabs')
      const savedTabs: TabGroup[] = Array.isArray(storageResult.savedTabs)
        ? storageResult.savedTabs
        : []

      for (const group of savedTabs) {
        await removeMatchingUrlsFromGroup(group, uniqueUrlSet)
      }

      const projects = await getCustomProjects()
      for (const project of projects) {
        await removeMatchingUrlsFromProject(project, uniqueUrlSet)
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
        if (!groupToDelete) {
          return
        }
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
          updatedCategories: currentCategories.map(c => ({ ...c })),
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
  const filteredCustomProjects = useMemo(
    () => filterCustomProjectsByQuery(customProjects, searchQuery),
    [customProjects, searchQuery],
  )

  // ストレージ変更検出時のリスナーを改善（ドメインモードとカスタムモード間の同期）
  useEffect(() => {
    const syncTabsAndUrlsChange = async (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      const hasSavedTabsChange = Boolean(changes.savedTabs)
      const hasUrlsChange = Boolean(changes.urls)

      if (hasUrlsChange) {
        invalidateUrlCache()
      }

      if (hasSavedTabsChange) {
        const nextSavedTabs = Array.isArray(changes.savedTabs.newValue)
          ? (changes.savedTabs.newValue as TabGroup[])
          : []
        await refreshTabGroupsWithUrls(nextSavedTabs)
        await syncDomainDataToCustomProjects()
        return
      }

      if (hasUrlsChange) {
        await refreshTabGroupsWithUrls()
      }
    }

    const syncUserSettingsChange = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      if (!changes.userSettings) {
        return
      }
      const nextSettings = changes.userSettings.newValue as
        | Partial<UserSettings>
        | undefined
      setSettings(prev => ({ ...prev, ...(nextSettings ?? {}) }))
    }

    const syncParentCategoriesChange = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      if (!changes.parentCategories) {
        return
      }
      const nextCategories = Array.isArray(changes.parentCategories.newValue)
        ? (changes.parentCategories.newValue as ParentCategory[])
        : []
      setCategories(nextCategories)
    }

    const syncCustomProjectsChange = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      if (!(changes.customProjects && viewModeRef.current === 'custom')) {
        return
      }
      const nextCustomProjects = Array.isArray(changes.customProjects.newValue)
        ? (changes.customProjects.newValue as CustomProject[])
        : []
      setCustomProjects(nextCustomProjects)
    }

    const handleStorageChanged = async (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => {
      console.log('ストレージ変更を検出:', changes)
      await syncTabsAndUrlsChange(changes)
      syncUserSettingsChange(changes)
      syncParentCategoriesChange(changes)
      syncCustomProjectsChange(changes)
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
        if (!(sourceProject && targetProject)) {
          console.error('プロジェクトが見つかりません')
          return null
        }
        const urlItem = sourceProject.urls?.find(item => item.url === url)
        if (!urlItem) {
          console.error('移動するURLが見つかりません')
          return null
        }

        const existsInTarget = targetProject.urls?.some(
          item => item.url === url,
        )
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
              if (p.id !== projectId) {
                return p
              }
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
            if (p.id !== projectId) {
              return p
            }
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

  const renderCategorizedDomainGroups = () => {
    if (!(settings.enableCategories && Object.keys(categorized).length > 0)) {
      return null
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleCategoryDragEnd}
      >
        <SortableContext
          items={categoryOrderForDisplay}
          strategy={verticalListSortingStrategy}
        >
          <div className='flex flex-col gap-1'>
            {categoryOrderForDisplay.map(categoryId => {
              if (!categoryId) {
                return null
              }
              const category = categories.find(c => c.id === categoryId)
              if (!category) {
                return null
              }
              const domainGroups = categorized[categoryId] || []
              if (domainGroups.length === 0) {
                return null
              }

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
                  handleUpdateDomainsOrder={handleUpdateDomainsOrder}
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
    )
  }

  const renderUncategorizedHeader = () => {
    if (!shouldShowUncategorizedSectionHeader) {
      return null
    }

    return (
      <div
        className={`sticky top-0 z-50 flex items-center justify-between bg-card ${
          hasVisibleCategoryGroups ? 'mt-6' : 'mt-2'
        }`}
      >
        <h2 className='font-bold text-foreground text-xl'>未分類のドメイン</h2>

        {isUncategorizedReorderMode && (
          <div className='pointer-events-auto ml-2 flex shrink-0 gap-2'>
            <Tooltip>
              <TooltipTrigger asChild={true}>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleCancelUncategorizedReorder}
                  className='flex cursor-pointer items-center gap-1'
                  aria-label='並び替えをキャンセル'
                >
                  <X size={14} />
                  <span className='hidden lg:inline'>キャンセル</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                並び替えをキャンセル
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild={true}>
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
              <TooltipContent side='top' className='block lg:hidden'>
                並び替えを確定
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    )
  }

  const renderUncategorizedDomains = () => {
    if (!shouldShowUncategorizedList) {
      return null
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleUncategorizedDragEnd}
      >
        <SortableContext
          items={uncategorizedForDisplay.map(group => group.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className='mt-2 flex flex-col gap-1'>
            {uncategorizedForDisplay.map(group => (
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
    )
  }

  const renderDomainMode = () => (
    <>
      {renderCategorizedDomainGroups()}
      {renderUncategorizedHeader()}
      {renderUncategorizedDomains()}
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
  )

  const renderMainContent = () => {
    if (isLoading) {
      return (
        <div className='flex min-h-[200px] items-center justify-center'>
          <div className='text-foreground text-xl'>読み込み中...</div>
        </div>
      )
    }

    if (viewMode === 'domain') {
      return renderDomainMode()
    }

    return (
      <CustomProjectSection
        projects={customProjectsForDisplay}
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
        handleReorderProjects={handleReorderProjects}
        handleRenameCategory={handleRenameCategory}
        settings={settings}
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
              <TooltipContent side='top' className='block lg:hidden'>
                キャンセル
              </TooltipContent>
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
    )
  }

  return (
    <>
      <Toaster />
      <div className='container mx-auto min-h-screen px-4 py-2'>
        <Header
          tabGroups={tabGroups}
          filteredTabGroups={headerFilteredTabGroups}
          customProjects={customProjects}
          onAddCategory={handleAddCategory}
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

// Reactコンポーネントをレンダリング
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app')
  if (!appContainer) {
    throw new Error('Failed to find the app container')
  }

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
