import { arrayMove } from '@dnd-kit/sortable'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  createParentCategory,
  getParentCategories,
} from '@/lib/storage/categories'
import { assignDomainToCategory } from '@/lib/storage/migration'
import { removeUrlFromTabGroup } from '@/lib/storage/tabs'
import type { ParentCategory, TabGroup } from '@/types/storage'

/** useDomainCardState フックの引数 */
interface UseDomainCardStateParams {
  /** タブグループデータ */
  group: TabGroup
  /** 複数URL削除ハンドラ */
  handleDeleteUrls?: (groupId: string, urls: string[]) => Promise<void>
  /** カテゴリ削除ハンドラ */
  handleDeleteCategory?: (groupId: string, categoryName: string) => void
  /** 並び替えモード状態 */
  isReorderMode: boolean
}
interface CategorizedUrlItem {
  id?: string
  url: string
  title: string
  subCategory?: string
  savedAt?: number
}
type CategorizedUrls = Record<string, CategorizedUrlItem[]>

/** 配列の同値比較ユーティリティ */
const arraysEqual = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}
const sortUrlsByOrder = (
  urls: TabGroup['urls'],
  sortOrder: 'default' | 'asc' | 'desc',
): TabGroup['urls'] => {
  const sourceUrls = urls || []
  if (sortOrder === 'default') {
    return sourceUrls
  }
  const sortedUrls = [...sourceUrls]
  sortedUrls.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))
  if (sortOrder === 'desc') {
    sortedUrls.reverse()
  }
  return sortedUrls
}
const buildCategorizedUrls = (
  urls: TabGroup['urls'],
  subCategories: TabGroup['subCategories'],
): CategorizedUrls => {
  const uncategorizedCategoryId = '__uncategorized'
  const categorizedUrls: CategorizedUrls = {}
  categorizedUrls[uncategorizedCategoryId] = []
  for (const category of subCategories || []) {
    categorizedUrls[category] = []
  }
  for (const url of urls || []) {
    if (url.subCategory && subCategories?.includes(url.subCategory)) {
      categorizedUrls[url.subCategory].push(url)
    } else {
      categorizedUrls[uncategorizedCategoryId].push(url)
    }
  }
  return categorizedUrls
}
const buildCategoryOrderFromSaved = (
  savedOrder: string[],
  regularCategories: string[],
  hasUncategorized: boolean,
): string[] => {
  const filteredOrder = savedOrder.filter(id => {
    if (id === '__uncategorized') {
      return hasUncategorized
    }
    return regularCategories.includes(id)
  })
  for (const category of regularCategories) {
    if (!filteredOrder.includes(category)) {
      filteredOrder.push(category)
    }
  }
  if (hasUncategorized && !filteredOrder.includes('__uncategorized')) {
    filteredOrder.push('__uncategorized')
  }
  return filteredOrder
}
/**
 * SortableDomainCard の状態ロジックを管理するカスタムフック
 * @param params フックの引数
 * @returns 折りたたみ・ソート・カテゴリ並び替え・キーワードモーダル・親カテゴリ関連の状態と操作
 */
export const useDomainCardState = ({
  group,
  handleDeleteUrls,
  handleDeleteCategory,
  isReorderMode,
}: UseDomainCardStateParams) => {
  // --- 基本状態 ---
  const [showKeywordModal, setShowKeywordModal] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [userCollapsedState, setUserCollapsedState] = useState(false)
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>(
    'default',
  )
  const [allCategoryIds, setAllCategoryIds] = useState<string[]>([])
  const [categoryUpdateTrigger, setCategoryUpdateTrigger] = useState(0)
  const [parentCategories, setParentCategories] = useState<ParentCategory[]>([])

  // --- カテゴリ並び替え状態 ---
  const [isCategoryReorderMode, setIsCategoryReorderMode] = useState(false)
  const [_originalCategoryOrder, setOriginalCategoryOrder] = useState<string[]>(
    [],
  )
  const [tempCategoryOrder, setTempCategoryOrder] = useState<string[]>([])

  // --- グローバルドラッグ状態 ---
  const [isDraggingGlobal, setIsDraggingGlobal] = useState<boolean>(false)

  // --- カテゴリ別URL整理（useMemo最適化）---
  const categorizedUrls = useMemo(() => {
    const sortedUrls = sortUrlsByOrder(group.urls, sortOrder)
    return buildCategorizedUrls(sortedUrls, group.subCategories)
  }, [group.urls, group.subCategories, sortOrder])

  // --- 空でないカテゴリIDsを取得 ---
  const getActiveCategoryIds = useCallback(() => {
    console.log('getActiveCategoryIds 関数実行...')
    const usedCategories = new Set<string>()
    for (const url of group.urls || []) {
      if (url.subCategory) {
        usedCategories.add(url.subCategory)
      }
    }
    console.log('使用されているカテゴリ:', Array.from(usedCategories))
    const regularCategories = (group.subCategories || []).filter(
      categoryName =>
        categorizedUrls[categoryName] &&
        categorizedUrls[categoryName].length > 0,
    )
    console.log('表示すべき通常カテゴリ:', regularCategories)
    const hasUncategorized = (categorizedUrls.__uncategorized?.length || 0) > 0
    if (
      group.subCategoryOrderWithUncategorized &&
      group.subCategoryOrderWithUncategorized.length > 0
    ) {
      const filteredOrder = buildCategoryOrderFromSaved(
        group.subCategoryOrderWithUncategorized,
        regularCategories,
        hasUncategorized,
      )
      console.log('保存された順序から構築（空カテゴリ除外）:', filteredOrder)
      return filteredOrder
    }
    const initialOrder = [...regularCategories]
    if (hasUncategorized) {
      initialOrder.push('__uncategorized')
    }
    console.log('新規作成されたカテゴリ順序:', initialOrder)
    return initialOrder
  }, [
    group.subCategories,
    group.urls,
    group.subCategoryOrderWithUncategorized,
    categorizedUrls,
  ])

  // --- 計算済みカテゴリIDs ---
  const computedCategoryIds = useMemo(
    () => getActiveCategoryIds(),
    [getActiveCategoryIds],
  )

  // --- 保存済みカテゴリ順序の初期化 ---
  useEffect(() => {
    if (
      group.subCategoryOrderWithUncategorized &&
      allCategoryIds.length === 0
    ) {
      const savedOrder = [...group.subCategoryOrderWithUncategorized]
      if (savedOrder.length > 0) {
        console.log('保存済みの順序を読み込み:', savedOrder)
        setAllCategoryIds(savedOrder)
      }
    }
  }, [group.subCategoryOrderWithUncategorized, allCategoryIds.length])

  // --- カテゴリ順序の更新を保存する関数 ---
  const handleUpdateCategoryOrder = useCallback(
    async (updatedOrder: string[], updatedAllOrder?: string[]) => {
      try {
        if (updatedAllOrder) {
          setAllCategoryIds(updatedAllOrder)
        }
        const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
        const updatedTabs = savedTabs.map((tab: TabGroup) => {
          if (tab.id === group.id) {
            const updatedTab = {
              ...tab,
              subCategoryOrder: updatedOrder,
              subCategoryOrderWithUncategorized:
                updatedAllOrder || allCategoryIds,
            }
            console.log(
              '保存するカテゴリ順序:',
              updatedTab.subCategoryOrderWithUncategorized,
            )
            return updatedTab
          }
          return tab
        })
        await chrome.storage.local.set({
          savedTabs: updatedTabs,
        })
        console.log('カテゴリ順序を更新しました:', updatedOrder)
        console.log('未分類含む順序も更新:', updatedAllOrder || allCategoryIds)
      } catch (error) {
        console.error('カテゴリ順序の更新に失敗しました:', error)
      }
    },
    [group.id, allCategoryIds],
  )

  // --- 新規カテゴリ順序の自動保存 ---
  useEffect(() => {
    if (
      allCategoryIds.length > 0 &&
      !group.subCategoryOrderWithUncategorized &&
      allCategoryIds.includes('__uncategorized')
    ) {
      const regularOrder = allCategoryIds.filter(id => id !== '__uncategorized')
      handleUpdateCategoryOrder(regularOrder, allCategoryIds)
    }
  }, [allCategoryIds, group.subCategoryOrderWithUncategorized])

  // --- カテゴリ表示の初期化 ---
  useEffect(() => {
    if (allCategoryIds.length === 0 && computedCategoryIds.length > 0) {
      console.log('初期カテゴリID設定:', computedCategoryIds)
      setAllCategoryIds(computedCategoryIds)
    }
  }, [allCategoryIds.length, computedCategoryIds])

  // --- カテゴリ設定変更の監視 ---
  useEffect(() => {
    if (
      categoryUpdateTrigger > 0 &&
      !arraysEqual(computedCategoryIds, allCategoryIds)
    ) {
      console.log('カテゴリ設定変更を検知 - 表示を更新:', computedCategoryIds)
      setAllCategoryIds(computedCategoryIds)
    }
  }, [categoryUpdateTrigger, computedCategoryIds, allCategoryIds])

  // --- タブ変更の監視 ---
  const prevUrlsRef = useRef<TabGroup['urls']>([])
  useEffect(() => {
    const prevUrls = prevUrlsRef.current
    const currentUrls = group.urls
    const hasSubCategoryChanges =
      (prevUrls?.length || 0) > 0 &&
      ((prevUrls?.length || 0) !== (currentUrls?.length || 0) ||
        (prevUrls || []).some(
          (prevUrl, i) =>
            i >= (currentUrls?.length || 0) ||
            prevUrl.subCategory !== currentUrls?.[i]?.subCategory,
        ))
    if (
      hasSubCategoryChanges &&
      !arraysEqual(computedCategoryIds, allCategoryIds)
    ) {
      console.log('タブのサブカテゴリ変更を検出 - 表示を更新')
      setAllCategoryIds(computedCategoryIds)
    }
    prevUrlsRef.current = [...(currentUrls || [])]
  }, [group.urls, computedCategoryIds, allCategoryIds])

  // --- カテゴリDnDハンドラ ---
  const handleCategoryDragEnd = useCallback(
    (event: {
      active: {
        id: string | number
      }
      over: {
        id: string | number
      } | null
    }) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const currentOrder = isCategoryReorderMode
          ? tempCategoryOrder
          : allCategoryIds
        const oldIndex = currentOrder.indexOf(active.id as string)
        const newIndex = currentOrder.indexOf(over.id as string)
        if (oldIndex !== -1 && newIndex !== -1) {
          const updatedAllCategoryIds = arrayMove(
            currentOrder,
            oldIndex,
            newIndex,
          )
          if (isCategoryReorderMode) {
            setTempCategoryOrder(updatedAllCategoryIds)
          } else {
            setIsCategoryReorderMode(true)
            setOriginalCategoryOrder([...allCategoryIds])
            setTempCategoryOrder(updatedAllCategoryIds)
          }
          console.log('一時的なカテゴリ順序:', updatedAllCategoryIds)
        }
      }
    },
    [isCategoryReorderMode, tempCategoryOrder, allCategoryIds],
  )

  // --- 並び替え確定 ---
  const handleConfirmCategoryReorder = useCallback(async () => {
    if (!isCategoryReorderMode) {
      return
    }
    try {
      const updatedCategoryOrder = tempCategoryOrder.filter(
        id => id !== '__uncategorized' && group.subCategories?.includes(id),
      )
      await handleUpdateCategoryOrder(updatedCategoryOrder, tempCategoryOrder)
      setAllCategoryIds(tempCategoryOrder)
      setIsCategoryReorderMode(false)
      setOriginalCategoryOrder([])
      setTempCategoryOrder([])
      toast.success('子カテゴリの順序を変更しました')
    } catch (error) {
      console.error('子カテゴリ順序の更新に失敗しました:', error)
      toast.error('子カテゴリ順序の更新に失敗しました')
    }
  }, [
    isCategoryReorderMode,
    tempCategoryOrder,
    group.subCategories,
    handleUpdateCategoryOrder,
  ])

  // --- 並び替えキャンセル ---
  const handleCancelCategoryReorder = useCallback(() => {
    if (!isCategoryReorderMode) {
      return
    }
    setTempCategoryOrder([])
    setIsCategoryReorderMode(false)
    setOriginalCategoryOrder([])
    toast.info('子カテゴリの並び替えをキャンセルしました')
  }, [isCategoryReorderMode])

  // --- キーワードモーダル閉じる ---
  const handleCloseKeywordModal = useCallback(() => {
    setShowKeywordModal(false)
    setCategoryUpdateTrigger(prev => prev + 1)
    Promise.resolve().then(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
      setCategoryUpdateTrigger(prev => prev + 1)
    })
  }, [])

  // --- カテゴリ削除後の処理 ---
  const handleCategoryDelete = useCallback(
    (groupId: string, categoryName: string) => {
      if (handleDeleteCategory) {
        handleDeleteCategory(groupId, categoryName)
        setCategoryUpdateTrigger(prev => prev + 1)
      }
    },
    [handleDeleteCategory],
  )

  // --- カテゴリ内の全タブ削除 ---
  const handleDeleteAllTabsInCategory = useCallback(
    async (
      categoryName: string,
      urlsToDelete: Array<{
        id?: string
        url: string
      }>,
    ) => {
      try {
        const urlsToRemove = urlsToDelete.map(item => item.url)
        if (urlsToRemove.length === 0) {
          return
        }
        console.log(
          `「${categoryName}」から${urlsToRemove.length}件のタブを削除します`,
        )
        if (handleDeleteUrls) {
          await handleDeleteUrls(group.id, urlsToRemove)
        } else {
          for (const url of urlsToRemove) {
            await removeUrlFromTabGroup(group.id, url)
          }
        }
        console.log(
          `「${categoryName}」カテゴリから${urlsToRemove.length}件のタブを削除完了`,
        )
      } catch (error) {
        console.error('カテゴリ内タブ削除エラー:', error)
      }
    },
    [group.id, handleDeleteUrls],
  )

  // --- 親カテゴリ読み込み ---
  useEffect(() => {
    const loadParentCategories = async () => {
      try {
        const categories = await getParentCategories()
        setParentCategories(categories)
      } catch (error) {
        console.error('親カテゴリの読み込みに失敗しました:', error)
      }
    }
    loadParentCategories()
  }, [])

  // --- 親カテゴリ作成ハンドラ ---
  const handleCreateParentCategory = useCallback(async (name: string) => {
    try {
      const newCategory = await createParentCategory(name)
      setParentCategories(prev => [...prev, newCategory])
      return newCategory
    } catch (error) {
      console.error('親カテゴリ作成エラー:', error)
      throw error
    }
  }, [])

  // --- ドメインを親カテゴリに割り当て ---
  const handleAssignToParentCategory = useCallback(
    async (groupId: string, categoryId: string) => {
      try {
        await assignDomainToCategory(groupId, categoryId)
      } catch (error) {
        console.error('ドメイン割り当てエラー:', error)
        throw error
      }
    },
    [],
  )

  // --- 親カテゴリ更新 ---
  const handleUpdateParentCategories = useCallback(
    (categories: ParentCategory[]) => {
      setParentCategories(categories)
    },
    [],
  )

  // --- グローバルドラッグ監視コールバック ---
  const dndMonitorHandlers = useMemo(
    () => ({
      onDragStart: () => {
        setIsDraggingGlobal(true)
      },
      onDragEnd: () => {
        setIsDraggingGlobal(false)
        if (!isReorderMode) {
          setIsCollapsed(false)
        }
      },
      onDragCancel: () => {
        setIsDraggingGlobal(false)
        if (!isReorderMode) {
          setIsCollapsed(false)
        }
      },
    }),
    [isReorderMode],
  )

  // --- ドラッグ・並び替えモード時の折りたたみ制御 ---
  useEffect(() => {
    if (isDraggingGlobal || isReorderMode) {
      setIsCollapsed(true)
    } else if (!(isDraggingGlobal || isReorderMode)) {
      setIsCollapsed(userCollapsedState)
    }
  }, [isDraggingGlobal, isReorderMode, userCollapsedState])
  return {
    /** 折りたたみ関連 */
    collapse: {
      isCollapsed,
      setIsCollapsed,
      userCollapsedState,
      setUserCollapsedState,
    },
    /** ソート関連 */
    sort: {
      sortOrder,
      setSortOrder,
    },
    /** カテゴリ並び替え関連 */
    categoryReorder: {
      isCategoryReorderMode,
      tempCategoryOrder,
      allCategoryIds,
      handleCategoryDragEnd,
      handleConfirmCategoryReorder,
      handleCancelCategoryReorder,
    },
    /** 計算済みデータ */
    computed: {
      categorizedUrls,
    },
    /** キーワードモーダル関連 */
    keywordModal: {
      showKeywordModal,
      setShowKeywordModal,
      handleCloseKeywordModal,
    },
    /** 親カテゴリ関連 */
    parentCategories: {
      categories: parentCategories,
      handleCreateParentCategory,
      handleAssignToParentCategory,
      handleUpdateParentCategories,
    },
    /** カテゴリ操作 */
    categoryActions: {
      handleCategoryDelete,
      handleDeleteAllTabsInCategory,
    },
    /** DnDモニターハンドラ */
    dndMonitorHandlers,
  }
}
