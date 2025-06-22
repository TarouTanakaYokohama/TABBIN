import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { handleSaveKeywords } from '@/features/saved-tabs/lib'
import {
  assignDomainToCategory,
  createParentCategory,
  getParentCategories,
} from '@/lib/storage'
import type { SortableDomainCardProps } from '@/types/saved-tabs'
import type { ParentCategory, TabGroup, UserSettings } from '@/types/storage'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDndMonitor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowUpDown,
  ArrowUpNarrowWide,
  ArrowUpWideNarrow,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Settings,
  Trash,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CategoryKeywordModal } from './CategoryKeywordModal'
import { SortableCategorySection } from './SortableCategorySection'
import { CategorySection } from './TimeRemaining'

// SortableDomainCardコンポーネントを修正
export const SortableDomainCard = ({
  group,
  handleOpenAllTabs,
  handleDeleteGroup,
  handleDeleteUrl,
  handleOpenTab,
  handleUpdateUrls,
  handleDeleteCategory,
  categoryId, // 親カテゴリIDを受け取る
  isDraggingOver: _isDraggingOver,
  settings, // 追加: settingsを受け取る
  isReorderMode = false, // 並び替えモード状態
}: SortableDomainCardProps & { settings: UserSettings }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: group.id })
  const [showKeywordModal, setShowKeywordModal] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [userCollapsedState, setUserCollapsedState] = useState(false) // ユーザーが手動設定した状態
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>(
    'default',
  )
  // 未分類も含めたすべてのカテゴリを管理する状態を追加
  const [allCategoryIds, setAllCategoryIds] = useState<string[]>([])
  // カテゴリ更新フラグ - カテゴリ削除後のリフレッシュ用
  const [categoryUpdateTrigger, setCategoryUpdateTrigger] = useState(0)
  const [parentCategories, setParentCategories] = useState<ParentCategory[]>([])
  // 子カテゴリ並び替えモード状態管理
  const [isCategoryReorderMode, setIsCategoryReorderMode] = useState(false)
  const [_originalCategoryOrder, setOriginalCategoryOrder] = useState<string[]>(
    [],
  )
  const [tempCategoryOrder, setTempCategoryOrder] = useState<string[]>([])

  // カード内のタブをサブカテゴリごとに整理
  const organizeUrlsByCategory = () => {
    type UrlType = {
      url: string
      title: string
      subCategory?: string
      savedAt?: number
    }
    // default では手動順保持、それ以外は日時でソート
    let urlsToGroup = group.urls || []
    if (sortOrder !== 'default') {
      urlsToGroup = [...(group.urls || [])]
      urlsToGroup.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))
      if (sortOrder === 'desc') urlsToGroup.reverse()
    }
    // サブカテゴリでタブをグループ化
    const categorizedUrls: Record<string, UrlType[]> = {
      __uncategorized: [], // 未分類カテゴリを最初に初期化
    }

    // 初期化 - サブカテゴリの初期化
    if (group.subCategories) {
      for (const cat of group.subCategories) {
        categorizedUrls[cat] = []
      }
    }

    // URLを適切なカテゴリに振り分け
    for (const url of urlsToGroup || []) {
      if (url.subCategory && group.subCategories?.includes(url.subCategory)) {
        categorizedUrls[url.subCategory].push(url)
      } else {
        categorizedUrls.__uncategorized.push(url)
      }
    }

    return categorizedUrls
  }

  const categorizedUrls = organizeUrlsByCategory()

  // 空でないカテゴリのみを表示に含める（修正版）
  const getActiveCategoryIds = useCallback(() => {
    console.log('getActiveCategoryIds 関数実行...')

    // URLごとのサブカテゴリを調べて、実際に使用されているカテゴリをリストアップ
    const usedCategories = new Set<string>()
    for (const url of group.urls || []) {
      if (url.subCategory) {
        usedCategories.add(url.subCategory)
      }
    }
    console.log('使用されているカテゴリ:', Array.from(usedCategories))

    // 通常のカテゴリで内容のあるもの - 空のカテゴリは表示しない
    const regularCategories = (group.subCategories || []).filter(
      categoryName =>
        categorizedUrls[categoryName] &&
        categorizedUrls[categoryName].length > 0,
    )
    console.log('表示すべき通常カテゴリ:', regularCategories)

    // 未分類カテゴリに内容がある場合のみ表示
    const hasUncategorized =
      categorizedUrls.__uncategorized &&
      categorizedUrls.__uncategorized.length > 0

    // 順序保存ロジックは維持
    if (
      group.subCategoryOrderWithUncategorized &&
      group.subCategoryOrderWithUncategorized.length > 0
    ) {
      // 保存された順序から、現在内容のあるカテゴリだけをフィルタリング
      const filteredOrder = group.subCategoryOrderWithUncategorized.filter(
        id => {
          if (id === '__uncategorized') return hasUncategorized
          return regularCategories.includes(id)
        },
      )

      // 新しいカテゴリがあれば追加
      for (const cat of regularCategories) {
        if (!filteredOrder.includes(cat)) {
          filteredOrder.push(cat)
        }
      }

      // 未分類があれば追加
      if (hasUncategorized && !filteredOrder.includes('__uncategorized')) {
        filteredOrder.push('__uncategorized')
      }

      console.log('保存された順序から構築（空カテゴリ除外）:', filteredOrder)
      return filteredOrder
    }

    // 新規作成: カテゴリ順序を初期化 (空カテゴリ除外)
    const initialOrder = [...regularCategories]
    if (hasUncategorized) {
      initialOrder.push('__uncategorized')
    }

    console.log('新規作成されたカテゴリ順序:', initialOrder)
    return initialOrder
  }, [
    group.subCategories,
    group.urls,
    categorizedUrls,
    group.subCategoryOrderWithUncategorized,
  ])

  // アクティブカテゴリの初期化
  useEffect(() => {
    const initializeCategories = () => {
      const activeIds = getActiveCategoryIds()
      console.log('初期カテゴリID設定:', activeIds)
      setAllCategoryIds(activeIds)
    }

    // 初期化が必要な場合のみ実行
    if (allCategoryIds.length === 0) {
      initializeCategories()
    }
  }, [allCategoryIds.length, getActiveCategoryIds]) // 依存関係を正しく指定

  // コンポーネントの外部に移動
  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  // カテゴリ順序の初期化と更新
  useEffect(() => {
    // subCategoryOrderWithUncategorizedがあればそれを使用
    if (group.subCategoryOrderWithUncategorized) {
      const savedOrder = [...group.subCategoryOrderWithUncategorized]
      if (savedOrder.length > 0) {
        console.log('保存済みの順序を読み込み:', savedOrder)
        setAllCategoryIds(savedOrder)
      }
    }
  }, [group.subCategoryOrderWithUncategorized])

  // アクティブカテゴリの更新とallCategoryIdsの初期化
  useEffect(() => {
    const updateCategoryOrder = (activeIds: string[]) => {
      if (
        !group.subCategoryOrderWithUncategorized &&
        activeIds.includes('__uncategorized')
      ) {
        const regularOrder = activeIds.filter(id => id !== '__uncategorized')
        handleUpdateCategoryOrder(regularOrder, activeIds)
      }
    }

    // すでに読み込んでいる場合はスキップ
    if (allCategoryIds.length > 0) {
      return
    }

    const activeIds = getActiveCategoryIds()

    // allCategoryIdsが空の場合は初期化
    if (activeIds.length > 0) {
      console.log('初期カテゴリ順序の設定:', activeIds)
      setAllCategoryIds(activeIds)
      // 新たに生成した順序を永続化するため保存
      updateCategoryOrder(activeIds)
    }
  }, [group, getActiveCategoryIds, allCategoryIds.length])

  // カテゴリ順序の更新を保存する関数
  const handleUpdateCategoryOrder = async (
    updatedOrder: string[],
    updatedAllOrder?: string[],
  ) => {
    try {
      // ローカル状態を更新

      // 全カテゴリ順序も指定がある場合は更新
      if (updatedAllOrder) {
        setAllCategoryIds(updatedAllOrder)
      }

      // 保存処理
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
      const updatedTabs = savedTabs.map((tab: TabGroup) => {
        if (tab.id === group.id) {
          const updatedTab = {
            ...tab,
            subCategoryOrder: updatedOrder,
            // 未分類を含む順序も保存
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

      await chrome.storage.local.set({ savedTabs: updatedTabs })
      console.log('カテゴリ順序を更新しました:', updatedOrder)
      console.log('未分類含む順序も更新:', updatedAllOrder || allCategoryIds)
    } catch (error) {
      console.error('カテゴリ順序の更新に失敗しました:', error)
    }
  }

  // カテゴリのドラッグ&ドロップハンドラ
  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // カテゴリの順序を一時的に更新（まだストレージには保存しない）
      const currentOrder = isCategoryReorderMode
        ? tempCategoryOrder
        : allCategoryIds
      const oldIndex = currentOrder.indexOf(active.id as string)
      const newIndex = currentOrder.indexOf(over.id as string)

      if (oldIndex !== -1 && newIndex !== -1) {
        // 新しい並び順を作成
        const updatedAllCategoryIds = arrayMove(
          currentOrder,
          oldIndex,
          newIndex,
        )

        if (!isCategoryReorderMode) {
          // 初回の並び替え時：並び替えモードを開始
          setIsCategoryReorderMode(true)
          setOriginalCategoryOrder([...allCategoryIds])
          setTempCategoryOrder(updatedAllCategoryIds)
        } else {
          // 既に並び替えモード中：一時的な順序を更新
          setTempCategoryOrder(updatedAllCategoryIds)
        }

        console.log('一時的なカテゴリ順序:', updatedAllCategoryIds)
      }
    }
  }

  // 子カテゴリの並び替えを確定する
  const handleConfirmCategoryReorder = async () => {
    if (!isCategoryReorderMode) return

    try {
      // 通常のカテゴリのみの順序を抽出（__uncategorizedを除く）
      const updatedCategoryOrder = tempCategoryOrder.filter(
        id => id !== '__uncategorized' && group.subCategories?.includes(id),
      )

      // 保存用の順序を更新（未分類を含む順序も保存）
      await handleUpdateCategoryOrder(updatedCategoryOrder, tempCategoryOrder)

      // ローカル状態を更新
      setAllCategoryIds(tempCategoryOrder)

      // 並び替えモードを終了
      setIsCategoryReorderMode(false)
      setOriginalCategoryOrder([])
      setTempCategoryOrder([])

      toast.success('子カテゴリの順序を変更しました')
    } catch (error) {
      console.error('子カテゴリ順序の更新に失敗しました:', error)
      toast.error('子カテゴリ順序の更新に失敗しました')
    }
  }

  // 子カテゴリの並び替えをキャンセルする
  const handleCancelCategoryReorder = () => {
    if (!isCategoryReorderMode) return

    // 元の順序に戻す
    setTempCategoryOrder([])

    // 並び替えモードを終了
    setIsCategoryReorderMode(false)
    setOriginalCategoryOrder([])

    toast.info('子カテゴリの並び替えをキャンセルしました')
  }

  // DnDのセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // allCategoryIds の依存関係と更新ロジックを修正
  // 初回ロード時または変更検出時の効果
  // biome-ignore lint/correctness/useExhaustiveDependencies: arraysEqual is a stable function
  useEffect(() => {
    const activeIds = getActiveCategoryIds()
    console.log('カテゴリ状態を再計算 - 有効カテゴリ:', activeIds)

    // アクティブなカテゴリが見つかり、現在の表示と異なる場合に更新
    if (activeIds.length > 0 && !arraysEqual(activeIds, allCategoryIds)) {
      console.log('カテゴリ表示を更新:', activeIds)
      setAllCategoryIds(activeIds)
    }
  }, [getActiveCategoryIds, allCategoryIds, categoryUpdateTrigger])

  // カテゴリ設定やキーワードの変更を監視して表示を更新
  // biome-ignore lint/correctness/useExhaustiveDependencies: arraysEqual is a stable function
  useEffect(() => {
    // サブカテゴリまたはキーワード設定の変更を検知
    if (group.subCategories || group.categoryKeywords) {
      const activeIds = getActiveCategoryIds()
      if (activeIds.length > 0 && !arraysEqual(activeIds, allCategoryIds)) {
        console.log('カテゴリ設定変更を検知 - 表示を更新:', activeIds)
        setAllCategoryIds(activeIds)
      }
    }
  }, [
    group.subCategories,
    group.categoryKeywords,
    getActiveCategoryIds,
    allCategoryIds,
  ])

  // タブの変更を検知して強制的に表示を更新する追加のロジック
  const prevUrlsRef = useRef<TabGroup['urls']>([])
  useEffect(() => {
    // タブのサブカテゴリに変更があった場合のみ再計算
    const prevUrls = prevUrlsRef.current
    const currentUrls = group.urls

    // サブカテゴリの変更を検出
    const hasSubCategoryChanges =
      (prevUrls?.length || 0) > 0 &&
      ((prevUrls?.length || 0) !== (currentUrls?.length || 0) ||
        (prevUrls || []).some(
          (prevUrl, i) =>
            i >= (currentUrls?.length || 0) ||
            prevUrl.subCategory !== currentUrls?.[i]?.subCategory,
        ))

    if (hasSubCategoryChanges) {
      console.log('タブのサブカテゴリ変更を検出 - 表示を更新')
      const activeIds = getActiveCategoryIds()
      setAllCategoryIds(activeIds)
    }

    // 参照を更新
    prevUrlsRef.current = [...(currentUrls || [])]
  }, [group.urls, getActiveCategoryIds])

  // モーダルを閉じる際に強制更新する処理を追加
  const handleCloseKeywordModal = () => {
    setShowKeywordModal(false)
    // 強制的にカテゴリデータを再計算するためのトリガー
    setCategoryUpdateTrigger(prev => prev + 1)

    // データの反映を確認するための重独更新
    Promise.resolve().then(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve))
      setCategoryUpdateTrigger(prev => prev + 1)
    })
  }

  // カテゴリ削除後の処理を追加
  const handleCategoryDelete = async (
    groupId: string,
    categoryName: string,
  ) => {
    if (handleDeleteCategory) {
      await handleDeleteCategory(groupId, categoryName)
      // 削除後に強制更新
      setCategoryUpdateTrigger(prev => prev + 1)
    }
  }

  // カテゴリ内の全タブを削除する関数を修正（新形式対応）
  const handleDeleteAllTabsInCategory = useCallback(
    async (categoryName: string, urlsToDelete: Array<{ url: string }>) => {
      try {
        // 削除するURLリスト
        const urlsToRemove = urlsToDelete.map(item => item.url)
        console.log(
          `「${categoryName}」から${urlsToRemove.length}件のタブを削除します`,
        )

        // 新形式のURL削除関数をインポート
        const { removeUrlFromTabGroup } = await import('@/lib/storage/tabs')

        // 各URLを削除
        for (const url of urlsToRemove) {
          await removeUrlFromTabGroup(group.id, url)
        }

        // 削除完了後にUIを更新
        if (handleUpdateUrls) {
          handleUpdateUrls(group.id, [])
        }

        // カテゴリ表示を更新
        requestAnimationFrame(() => {
          const newActiveIds = getActiveCategoryIds()
          setAllCategoryIds(newActiveIds)
          setCategoryUpdateTrigger(prev => prev + 1)
        })

        console.log(
          `「${categoryName}」カテゴリから${urlsToRemove.length}件のタブを削除完了`,
        )
      } catch (error) {
        console.error('カテゴリ内タブ削除エラー:', error)
      }
    },
    [group.id, getActiveCategoryIds, handleUpdateUrls],
  )

  // 親カテゴリデータをロードする
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

  // 親カテゴリ作成ハンドラ
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

  // ドメインを親カテゴリに割り当てるハンドラ
  const handleAssignToParentCategory = useCallback(
    async (groupId: string, categoryId: string) => {
      try {
        await assignDomainToCategory(groupId, categoryId)
        // 必要に応じてUIを更新
      } catch (error) {
        console.error('ドメイン割り当てエラー:', error)
        throw error
      }
    },
    [],
  )

  // 親カテゴリの更新ハンドラ
  const handleUpdateParentCategories = useCallback(
    (categories: ParentCategory[]) => {
      setParentCategories(categories)
    },
    [],
  )

  // Monitor global drag state for collapse
  const [isDraggingGlobal, setIsDraggingGlobal] = useState<boolean>(false)
  useDndMonitor({
    onDragStart: () => {
      // ドメインドラッグ開始時にすべてのドメインを折りたたむ
      setIsDraggingGlobal(true)
    },
    onDragEnd: () => {
      setIsDraggingGlobal(false)
      // 並び替えモード中でなければドロップ時に展開する
      if (!isReorderMode) {
        setIsCollapsed(false)
      }
    },
    onDragCancel: () => {
      setIsDraggingGlobal(false)
      // 並び替えモード中でなければドラッグキャンセル時も展開する
      if (!isReorderMode) {
        setIsCollapsed(false)
      }
    },
  })
  useEffect(() => {
    // ドメイン自体がドラッグされている場合または並び替えモード中は折りたたむ
    if (isDraggingGlobal || isReorderMode) {
      setIsCollapsed(true)
    } else if (!isDraggingGlobal && !isReorderMode) {
      // ドラッグもモードも終了したらユーザーが設定した状態に戻す
      setIsCollapsed(userCollapsedState)
    }
  }, [isDraggingGlobal, isReorderMode, userCollapsedState])

  // 親カテゴリの有無に応じてsticky位置を動的に設定
  const stickyTop = categoryId ? 'top-8' : 'top-6'
  const categorySectionStickyTop = categoryId ? 'top-20' : 'top-18'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='shadow-md'
      data-category-id={categoryId}
      data-urls-count={group.urls?.length || 0}
    >
      <div className={`sticky ${stickyTop} z-40 w-full bg-card p-2`}>
        <div className='flex w-full items-center justify-between gap-2'>
          {/* 折りたたみ切り替えボタン */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='secondary'
                size='sm'
                onClick={e => {
                  e.stopPropagation()
                  if (!isReorderMode) {
                    const newState = !isCollapsed
                    setIsCollapsed(newState)
                    setUserCollapsedState(newState) // ユーザーの手動設定を記憶
                  }
                }}
                className={`flex items-center gap-1 ${
                  isReorderMode
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer'
                }`}
                aria-label={isCollapsed ? '展開' : '折りたたむ'}
                disabled={isReorderMode}
              >
                {isCollapsed ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronUp size={14} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              {isReorderMode
                ? '並び替えモード中'
                : isCollapsed
                  ? '展開'
                  : '折りたたむ'}
            </TooltipContent>
          </Tooltip>

          {/* ソート順切り替え */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='secondary'
                size='sm'
                onClick={e => {
                  e.stopPropagation()
                  setSortOrder(o =>
                    o === 'default' ? 'asc' : o === 'asc' ? 'desc' : 'default',
                  )
                }}
                className='flex cursor-pointer items-center gap-1'
                aria-label={
                  sortOrder === 'default'
                    ? 'デフォルト'
                    : sortOrder === 'asc'
                      ? '保存日時の昇順'
                      : '保存日時の降順'
                }
              >
                {sortOrder === 'default' ? (
                  <ArrowUpDown size={14} />
                ) : sortOrder === 'asc' ? (
                  <ArrowUpNarrowWide size={14} />
                ) : (
                  <ArrowUpWideNarrow size={14} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              {sortOrder === 'default'
                ? 'デフォルト'
                : sortOrder === 'asc'
                  ? '保存日時の昇順'
                  : '保存日時の降順'}
            </TooltipContent>
          </Tooltip>

          {/* ドラッグハンドル＆ドメイン表示 */}
          <div
            className='flex flex-grow cursor-grab items-center gap-2 overflow-hidden hover:cursor-grab active:cursor-grabbing'
            {...attributes}
            {...listeners}
          >
            <div className='flex-shrink-0 text-muted-foreground/80'>
              <GripVertical size={16} aria-hidden='true' />
            </div>
            <h2 className='truncate font-semibold text-foreground text-lg'>
              {group.domain}
            </h2>
            <span className='text-muted-foreground text-sm'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant='secondary'>{group.urls?.length || 0}</Badge>
                </TooltipTrigger>
                <TooltipContent side='top' className='block lg:hidden'>
                  タブ数
                </TooltipContent>
              </Tooltip>
            </span>
          </div>

          {/* 子カテゴリ並び替えモード中の確定・キャンセルボタン */}
          {isCategoryReorderMode && (
            <div className='flex flex-shrink-0 items-center gap-2'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleCancelCategoryReorder}
                    className='flex cursor-pointer items-center gap-1'
                    aria-label='子カテゴリの並び替えをキャンセル'
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
                <TooltipTrigger asChild>
                  <Button
                    variant='default'
                    size='sm'
                    onClick={handleConfirmCategoryReorder}
                    className='flex cursor-pointer items-center gap-1'
                    aria-label='子カテゴリの並び替えを確定'
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

          {/* 操作ボタン群 */}
          <div className='flex flex-shrink-0 items-center gap-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => setShowKeywordModal(!showKeywordModal)}
                  className='flex cursor-pointer items-center gap-1'
                  aria-label='子カテゴリを管理'
                >
                  <Settings size={14} />
                  <span className='hidden lg:inline'>子カテゴリ管理</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                子カテゴリを管理
              </TooltipContent>
            </Tooltip>
            {/* すべて開く */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={e => {
                    if (
                      (group.urls?.length || 0) >= 10 &&
                      !window.confirm(
                        '10個以上のタブを開こうとしています。続行しますか？',
                      )
                    )
                      return
                    e.stopPropagation()
                    handleOpenAllTabs(group.urls || [])
                  }}
                  className='flex cursor-pointer items-center gap-1'
                  aria-label='すべてのタブを開く'
                >
                  <ExternalLink size={14} />
                  <span className='hidden lg:inline'>すべて開く</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                すべてのタブを開く
              </TooltipContent>
            </Tooltip>

            {/* グループ削除 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={e => {
                    e.stopPropagation()
                    e.preventDefault()
                    if (
                      !settings.confirmDeleteAll ||
                      window.confirm('すべてのタブを削除しますか？')
                    ) {
                      handleDeleteGroup(group.id)
                    }
                  }}
                  className='flex cursor-pointer items-center gap-1'
                  aria-label='すべてのタブを削除'
                >
                  <Trash size={14} />
                  <span className='hidden lg:inline'>すべて削除</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                すべてのタブを削除
              </TooltipContent>
            </Tooltip>

            {/* キーワードモーダル */}
            {showKeywordModal && (
              <CategoryKeywordModal
                group={group}
                isOpen={showKeywordModal}
                onClose={handleCloseKeywordModal}
                onSave={handleSaveKeywords}
                onDeleteCategory={handleCategoryDelete}
                parentCategories={parentCategories}
                onCreateParentCategory={handleCreateParentCategory}
                onAssignToParentCategory={handleAssignToParentCategory}
                onUpdateParentCategories={handleUpdateParentCategories}
              />
            )}
          </div>
        </div>
      </div>

      {/* カード展開部 */}
      {!isCollapsed && (
        <CardContent className='space-y-1 p-2'>
          {(group.urls?.length || 0) > 0 ? (
            allCategoryIds.length > 1 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleCategoryDragEnd}
              >
                <SortableContext
                  items={
                    isCategoryReorderMode ? tempCategoryOrder : allCategoryIds
                  }
                  strategy={verticalListSortingStrategy}
                >
                  {(isCategoryReorderMode
                    ? tempCategoryOrder
                    : allCategoryIds
                  ).map(categoryName => {
                    const urls = categorizedUrls[categoryName] || []
                    if (urls.length === 0) return null
                    return (
                      <SortableCategorySection
                        key={categoryName}
                        id={categoryName}
                        categoryName={categoryName}
                        urls={urls}
                        groupId={group.id}
                        handleDeleteUrl={handleDeleteUrl}
                        handleOpenTab={handleOpenTab}
                        handleUpdateUrls={handleUpdateUrls}
                        handleOpenAllTabs={handleOpenAllTabs}
                        handleDeleteAllTabs={urls =>
                          handleDeleteAllTabsInCategory(categoryName, urls)
                        }
                        settings={settings}
                        stickyTop={categorySectionStickyTop}
                        isReorderMode={isCategoryReorderMode}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            ) : (
              <CategorySection
                categoryName={allCategoryIds[0] ?? '__uncategorized'}
                urls={categorizedUrls[allCategoryIds[0] ?? '__uncategorized']}
                groupId={group.id}
                handleDeleteUrl={handleDeleteUrl}
                handleOpenTab={handleOpenTab}
                handleUpdateUrls={handleUpdateUrls}
                handleOpenAllTabs={handleOpenAllTabs}
                settings={settings}
              />
            )
          ) : (
            <div className='py-4 text-center text-gray-400'>
              {(group.urls?.length || 0) === 0
                ? 'このドメインにはタブがありません'
                : 'カテゴリを追加するにはカテゴリ管理から行ってください'}
            </div>
          )}
        </CardContent>
      )}
    </div>
  )
}
