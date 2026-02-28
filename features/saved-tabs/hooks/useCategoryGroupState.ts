import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ParentCategory, TabGroup } from '@/types/storage'
import { useSortOrder } from './useSortOrder'

/** useCategoryGroupState フックの引数 */
interface UseCategoryGroupStateParams {
  /** 親カテゴリデータ */
  category: ParentCategory
  /** ドメイン一覧 */
  domains: TabGroup[]
  /** ドメイン順序更新ハンドラ */
  handleUpdateDomainsOrder?: (
    categoryId: string,
    updatedDomains: TabGroup[],
  ) => void
  /** ドメイン削除ハンドラ */
  handleDeleteGroup: (id: string) => void
  /** 親カテゴリ並び替えモード状態 */
  isCategoryReorderMode: boolean
}
const ensureCategoryPresence = (
  categoryGroups: ParentCategory[],
  categoryId: string,
  newName: string,
): ParentCategory[] => {
  const existingCategory = categoryGroups.find(cat => cat.id === categoryId)
  if (existingCategory) {
    return categoryGroups
  }
  return [
    ...categoryGroups,
    {
      id: categoryId,
      name: newName,
      domains: [],
      domainNames: [],
    },
  ]
}
const renameCategoryInGroups = (
  categoryGroups: ParentCategory[],
  categoryId: string,
  newName: string,
): ParentCategory[] => {
  return categoryGroups.map(cat => {
    if (cat.id !== categoryId) {
      return cat
    }
    return {
      ...cat,
      name: newName,
      domainNames: [...(cat.domainNames || [])],
    }
  })
}
const confirmCategorySaved = async (
  categoryId: string,
  newName: string,
  updatedGroups: ParentCategory[],
): Promise<void> => {
  const maxRetries = 3
  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    const checkResult = await chrome.storage.local.get('parentCategories')
    const savedCategory = checkResult.parentCategories?.find(
      (cat: ParentCategory) => cat.id === categoryId,
    )
    if (savedCategory?.name === newName) {
      console.log('CategoryGroup - 保存の確認に成功:', savedCategory)
      break
    }
    console.log(
      `CategoryGroup - 保存の確認に失敗 (試行 ${retryCount + 1}/${maxRetries})`,
    )
    await chrome.storage.local.set({
      parentCategories: updatedGroups,
    })
  }
  const finalCheck = await chrome.storage.local.get('parentCategories')
  const finalCategory = finalCheck.parentCategories?.find(
    (cat: ParentCategory) => cat.id === categoryId,
  )
  if (finalCategory?.name !== newName) {
    throw new Error('カテゴリ名の更新が反映されていません')
  }
  console.log('CategoryGroup - カテゴリ更新が完了しました:', finalCategory)
}
/**
 * CategoryGroup の状態ロジックを管理するカスタムフック
 * @param params フックの引数
 * @returns 折りたたみ・ソート・並び替え・モーダル・DnD関連の状態と操作
 */
export const useCategoryGroupState = ({
  category,
  domains,
  handleUpdateDomainsOrder,
  handleDeleteGroup,
  isCategoryReorderMode,
}: UseCategoryGroupStateParams) => {
  // --- 基本状態 ---
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [userCollapsedState, setUserCollapsedState] = useState(false)
  const [_isDraggingOver, setIsDraggingOver] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDraggingDomains, setIsDraggingDomains] = useState(false)
  const [isDraggingGlobal, setIsDraggingGlobal] = useState<boolean>(false)

  // --- 並び替え状態 ---
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [_originalDomainOrder, setOriginalDomainOrder] = useState<TabGroup[]>(
    [],
  )
  const [tempDomainOrder, setTempDomainOrder] = useState<typeof domains>([])

  // --- ドメイン状態とソート ---
  const [localDomains, setLocalDomains] = useState<typeof domains>(domains)
  const {
    sortOrder,
    setSortOrder,
    sortedItems: sortedDomains,
  } = useSortOrder(localDomains, d => d.domain)

  // --- カテゴリ名更新ハンドラ ---
  const handleCategoryUpdate = useCallback(
    async (categoryId: string, newName: string) => {
      try {
        console.log('CategoryGroup - handleCategoryUpdate開始:', {
          categoryId,
          newName,
          currentCategory: category,
        })
        const result = await chrome.storage.local.get(['parentCategories'])
        const baseGroups: ParentCategory[] = result.parentCategories || []
        const categoryGroups = ensureCategoryPresence(
          baseGroups,
          categoryId,
          newName,
        )
        const updatedGroups = renameCategoryInGroups(
          categoryGroups,
          categoryId,
          newName,
        )
        await chrome.storage.local.set({
          parentCategories: updatedGroups,
        })
        await confirmCategorySaved(categoryId, newName, updatedGroups)
      } catch (error) {
        console.error('CategoryGroup - カテゴリ名の更新に失敗:', error)
        toast.error('カテゴリ名の更新に失敗しました')
      }
    },
    [category],
  )

  // --- グローバルドラッグ監視 ---
  const handleGlobalDragStart = useCallback(() => {
    setIsDraggingGlobal(true)
  }, [])
  const handleGlobalDragFinish = useCallback(() => {
    setIsDraggingGlobal(false)
    if (!(isReorderMode || isCategoryReorderMode)) {
      setIsCollapsed(false)
    }
  }, [isReorderMode, isCategoryReorderMode])
  const dndMonitorHandlers = useMemo(
    () => ({
      onDragStart: handleGlobalDragStart,
      onDragEnd: handleGlobalDragFinish,
      onDragCancel: handleGlobalDragFinish,
    }),
    [handleGlobalDragStart, handleGlobalDragFinish],
  )

  // --- ドラッグ中の折りたたみ制御 ---
  useEffect(() => {
    if (isDraggingGlobal && !isCategoryReorderMode) {
      setIsCollapsed(true)
    }
  }, [isDraggingGlobal, isCategoryReorderMode])

  // --- 親カテゴリ並び替えモード中の折りたたみ ---
  const prevReorderModeRef = useRef<boolean>(false)
  useEffect(() => {
    if (isCategoryReorderMode && !prevReorderModeRef.current) {
      setUserCollapsedState(isCollapsed)
      setIsCollapsed(true)
      prevReorderModeRef.current = true
    } else if (!isCategoryReorderMode && prevReorderModeRef.current) {
      setIsCollapsed(userCollapsedState)
      prevReorderModeRef.current = false
    }
  }, [isCategoryReorderMode, isCollapsed, userCollapsedState])

  // --- ドメイン変更の検知 ---
  useEffect(() => {
    setLocalDomains(domains)
  }, [domains])

  // --- ネイティブDnDハンドラ ---
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDraggingOver(true)
  }, [])
  const handleDragLeave = useCallback(() => {
    setIsDraggingOver(false)
  }, [])
  const handleDrop = useCallback(
    (
      event: React.DragEvent,
      handleMoveDomainToCategory?: (
        domainId: string,
        fromCategoryId: string | null,
        toCategoryId: string,
      ) => void,
    ) => {
      event.preventDefault()
      setIsDraggingOver(false)
      const domainId = event.dataTransfer.getData('domain-id')
      const fromCategoryId = event.dataTransfer.getData('from-category-id')
      if (
        domainId &&
        handleMoveDomainToCategory &&
        fromCategoryId !== category.id
      ) {
        handleMoveDomainToCategory(
          domainId,
          fromCategoryId || null,
          category.id,
        )
      }
    },
    [category.id],
  )

  // --- ドメインDnDハンドラ ---
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const currentOrder = isReorderMode ? tempDomainOrder : localDomains
        const oldIndex = currentOrder.findIndex(
          domain => domain.id === active.id,
        )
        const newIndex = currentOrder.findIndex(domain => domain.id === over.id)
        if (oldIndex !== -1 && newIndex !== -1) {
          const updatedDomains = arrayMove(currentOrder, oldIndex, newIndex)
          if (isReorderMode) {
            setTempDomainOrder(updatedDomains)
          } else {
            setIsReorderMode(true)
            setOriginalDomainOrder(
              localDomains.map(domain => {
                const { urls, ...rest } = domain
                return {
                  ...rest,
                  urls: urls ?? [],
                }
              }),
            )
            setTempDomainOrder(
              updatedDomains.map(domain => {
                const { urls, ...rest } = domain
                return {
                  ...rest,
                  urls: urls ?? [],
                }
              }),
            )
          }
        }
      }
      setIsDraggingDomains(false)
    },
    [isReorderMode, tempDomainOrder, localDomains],
  )
  const handleDragStart = useCallback(() => {
    setIsDraggingDomains(true)
  }, [])

  // --- 並び替え確定 ---
  const handleConfirmReorder = useCallback(async () => {
    if (!isReorderMode) {
      return
    }
    try {
      if (handleUpdateDomainsOrder) {
        await handleUpdateDomainsOrder(category.id, tempDomainOrder)
      }
      setLocalDomains(tempDomainOrder)
      setIsReorderMode(false)
      setOriginalDomainOrder([])
      setTempDomainOrder([])
      toast.success('ドメインの順序を変更しました')
    } catch (error) {
      console.error('ドメイン順序の更新に失敗しました:', error)
      toast.error('ドメイン順序の更新に失敗しました')
    }
  }, [isReorderMode, handleUpdateDomainsOrder, category.id, tempDomainOrder])

  // --- 並び替えキャンセル ---
  const handleCancelReorder = useCallback(() => {
    if (!isReorderMode) {
      return
    }
    setTempDomainOrder([])
    setIsReorderMode(false)
    setOriginalDomainOrder([])
    toast.info('並び替えをキャンセルしました')
  }, [isReorderMode])

  // --- 個別ドメイン削除のラッパー ---
  const handleDeleteSingleDomain = useCallback(
    async (domainId: string) => {
      await handleDeleteGroup(domainId)
      if (isReorderMode) {
        const filteredTempOrder = tempDomainOrder.filter(
          domain => domain.id !== domainId,
        )
        setTempDomainOrder(filteredTempOrder)
        if (filteredTempOrder.length === 0) {
          setIsReorderMode(false)
          setOriginalDomainOrder([])
        }
      }
    },
    [handleDeleteGroup, isReorderMode, tempDomainOrder],
  )
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
      sortedDomains,
    },
    /** モーダル関連 */
    modal: {
      isModalOpen,
      setIsModalOpen,
    },
    /** ドメイン並び替え関連 */
    reorder: {
      isReorderMode,
      tempDomainOrder,
      isDraggingDomains,
      handleDragStart,
      handleDragEnd,
      handleConfirmReorder,
      handleCancelReorder,
      handleDeleteSingleDomain,
    },
    /** ネイティブDnDイベント */
    nativeDnD: {
      handleDragOver,
      handleDragLeave,
      handleDrop,
    },
    /** ローカルドメイン */
    localDomains,
    /** カテゴリ更新 */
    handleCategoryUpdate,
    /** DnDモニターハンドラ */
    dndMonitorHandlers,
  }
}
