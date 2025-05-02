import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SortableDomainCardProps } from '@/types/saved-tabs'
import { handleSaveKeywords } from '@/utils/handleSaveKeywords'
import {
  assignDomainToCategory,
  createParentCategory,
  getParentCategories,
} from '@/utils/storage'
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
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Settings,
  Trash,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
  isDraggingOver,
  settings, // 追加: settingsを受け取る
}: SortableDomainCardProps & { settings: UserSettings }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: group.id })
  const [showKeywordModal, setShowKeywordModal] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>(
    'default',
  )
  // カテゴリの順序を管理する状態を追加
  const [categoryOrder, setCategoryOrder] = useState<string[]>([])
  // 未分類も含めたすべてのカテゴリを管理する状態を追加
  const [allCategoryIds, setAllCategoryIds] = useState<string[]>([])
  // カテゴリ更新フラグ - カテゴリ削除後のリフレッシュ用
  const [categoryUpdateTrigger, setCategoryUpdateTrigger] = useState(0)
  const [parentCategories, setParentCategories] = useState<ParentCategory[]>([])

  // カード内のタブをサブカテゴリごとに整理
  const organizeUrlsByCategory = () => {
    type UrlType = {
      url: string
      title: string
      subCategory?: string
      savedAt?: number
    }
    // default では手動順保持、それ以外は日時でソート
    let urlsToGroup = group.urls
    if (sortOrder !== 'default') {
      urlsToGroup = [...group.urls]
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
    for (const url of urlsToGroup) {
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
    for (const url of group.urls) {
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
    if (group.subCategories) {
      // subCategoryOrder がある場合はそれを使用、なければ subCategories をそのまま使用
      const initialOrder = group.subCategoryOrder || [...group.subCategories]
      setCategoryOrder(initialOrder)
    }

    // subCategoryOrderWithUncategorizedがあればそれを使用
    if (group.subCategoryOrderWithUncategorized) {
      const savedOrder = [...group.subCategoryOrderWithUncategorized]
      if (savedOrder.length > 0) {
        console.log('保存済みの順序を読み込み:', savedOrder)
        setAllCategoryIds(savedOrder)
      }
    }
  }, [
    group.subCategories,
    group.subCategoryOrder,
    group.subCategoryOrderWithUncategorized,
  ])

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
      setCategoryOrder(updatedOrder)

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
      // カテゴリの順序を更新
      const oldIndex = allCategoryIds.indexOf(active.id as string)
      const newIndex = allCategoryIds.indexOf(over.id as string)

      if (oldIndex !== -1 && newIndex !== -1) {
        // 新しい並び順を作成
        const updatedAllCategoryIds = arrayMove(
          allCategoryIds,
          oldIndex,
          newIndex,
        )

        console.log('新しいカテゴリ順序:', updatedAllCategoryIds)

        // 通常のカテゴリのみの順序を抽出（__uncategorizedを除く）
        const updatedCategoryOrder = updatedAllCategoryIds.filter(
          id => id !== '__uncategorized' && group.subCategories?.includes(id),
        )

        // 保存用の順序を更新（未分類を含む順序も保存）
        handleUpdateCategoryOrder(updatedCategoryOrder, updatedAllCategoryIds)
      }
    }
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
      prevUrls.length > 0 &&
      (prevUrls.length !== currentUrls.length ||
        prevUrls.some(
          (prevUrl, i) =>
            i >= currentUrls.length ||
            prevUrl.subCategory !== currentUrls[i].subCategory,
        ))

    if (hasSubCategoryChanges) {
      console.log('タブのサブカテゴリ変更を検出 - 表示を更新')
      const activeIds = getActiveCategoryIds()
      setAllCategoryIds(activeIds)
    }

    // 参照を更新
    prevUrlsRef.current = [...currentUrls]
  }, [group.urls, getActiveCategoryIds])

  // モーダルを閉じる際に強制更新する処理を追加
  const handleCloseKeywordModal = () => {
    setShowKeywordModal(false)
    // 強制的にカテゴリデータを再計算するためのトリガー
    setCategoryUpdateTrigger(prev => prev + 1)

    // 0.5秒後に再度更新して、データの反映を確認
    setTimeout(() => {
      setCategoryUpdateTrigger(prev => prev + 1)
    }, 500)
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

  // カテゴリ内の全タブを削除する関数を修正
  const handleDeleteAllTabsInCategory = useCallback(
    async (categoryName: string, urlsToDelete: Array<{ url: string }>) => {
      try {
        // 削除するURLリスト
        const urlsToRemove = urlsToDelete.map(item => item.url)
        console.log(
          `「${categoryName}」から${urlsToRemove.length}件のタブを削除します`,
        )

        return new Promise<void>(resolve => {
          // ストレージから現在の状態を取得
          chrome.storage.local.get('savedTabs', ({ savedTabs = [] }) => {
            // 対象グループを特定
            const targetGroup = savedTabs.find(
              (tab: TabGroup) => tab.id === group.id,
            )
            if (!targetGroup) {
              console.error('削除対象のグループが見つかりません')
              resolve()
              return
            }

            // 残りのURLを計算
            const remainingUrls = targetGroup.urls.filter(
              (urlItem: { url: string; title: string; subCategory?: string }) =>
                !urlsToRemove.includes(urlItem.url),
            )

            // 更新されたグループ
            const updatedGroups = savedTabs.map((tab: TabGroup) =>
              tab.id === group.id ? { ...tab, urls: remainingUrls } : tab,
            )

            // ストレージに保存
            chrome.storage.local.set({ savedTabs: updatedGroups }, () => {
              console.log(
                `「${categoryName}」カテゴリのタブ削除完了。残り: ${remainingUrls.length}件`,
              )

              // URL数が0になったら親コンポーネントに通知
              if (remainingUrls.length === 0 && handleUpdateUrls) {
                handleUpdateUrls(group.id, [])
              }

              // カテゴリ表示を更新
              setTimeout(() => {
                const newActiveIds = getActiveCategoryIds()
                setAllCategoryIds(newActiveIds)
                setCategoryUpdateTrigger(prev => prev + 1)
                resolve()
              }, 100)
            })
          })
        })
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
      // ドロップ時に展開する
      setIsCollapsed(false)
    },
    onDragCancel: () => {
      setIsDraggingGlobal(false)
      // ドラッグキャンセル時も展開する
      setIsCollapsed(false)
    },
  })
  useEffect(() => {
    // ドメイン自体がドラッグされている場合のみ折りたたむ
    if (isDraggingGlobal) {
      setIsCollapsed(true)
    }
  }, [isDraggingGlobal])

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`rounded-lg shadow-md ${
        isDraggingOver ? 'border-ring border-2' : 'border-border'
      }`}
      data-category-id={categoryId}
      data-urls-count={group.urls.length}
    >
      <CardHeader className='p-2 pb-0 w-full'>
        <div className='flex items-center justify-between w-full gap-2'>
          {/* 折りたたみ切り替えボタン */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='secondary'
                size='sm'
                onClick={e => {
                  e.stopPropagation()
                  setIsCollapsed(prev => !prev)
                }}
                className='flex items-center gap-1 cursor-pointer'
                title={isCollapsed ? '展開' : '折りたたむ'}
                aria-label={isCollapsed ? '展開' : '折りたたむ'}
              >
                {isCollapsed ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronUp size={14} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='lg:hidden block'>
              {isCollapsed ? '展開' : '折りたたむ'}
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
                className='flex items-center gap-1 cursor-pointer'
                title={
                  sortOrder === 'default'
                    ? 'デフォルト'
                    : sortOrder === 'asc'
                      ? '昇順'
                      : '降順'
                }
                aria-label={
                  sortOrder === 'default'
                    ? 'デフォルト'
                    : sortOrder === 'asc'
                      ? '昇順'
                      : '降順'
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
            <TooltipContent side='top' className='lg:hidden block'>
              {sortOrder === 'default'
                ? 'デフォルト'
                : sortOrder === 'asc'
                  ? '昇順'
                  : '降順'}
            </TooltipContent>
          </Tooltip>

          {/* ドラッグハンドル＆ドメイン表示 */}
          <div
            className='flex items-center gap-2 cursor-grab overflow-hidden flex-grow hover:cursor-grab active:cursor-grabbing'
            {...attributes}
            {...listeners}
          >
            <div className='text-muted-foreground/80 flex-shrink-0'>
              <GripVertical size={16} aria-hidden='true' />
            </div>
            <h2 className='text-lg font-semibold text-foreground truncate'>
              {group.domain}
            </h2>
            <span className='text-sm text-muted-foreground'>
              <Badge variant='secondary'>{group.urls.length}</Badge>
            </span>
          </div>

          {/* 操作ボタン群 */}
          <div className='flex items-center gap-2 flex-shrink-0 ml-2'>
            {/* すべて開く */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={e => {
                    e.stopPropagation()
                    handleOpenAllTabs(group.urls)
                  }}
                  className='flex items-center gap-1 cursor-pointer'
                  title='すべて開く'
                  aria-label='すべて開く'
                >
                  <ExternalLink size={14} />
                  <span className='lg:inline hidden'>すべて開く</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='lg:hidden block'>
                すべて開く
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
                  className='flex items-center gap-1 cursor-pointer'
                  title='グループを削除'
                  aria-label='グループを削除'
                >
                  <Trash size={14} />
                  <span className='lg:inline hidden'>すべて削除</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='lg:hidden block'>
                すべてのタブ削除
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
      </CardHeader>

      {/* カード展開部 */}
      {!isCollapsed && (
        <CardContent className='space-y-1 p-2'>
          {group.urls.length > 0 ? (
            allCategoryIds.length > 1 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleCategoryDragEnd}
              >
                <SortableContext
                  items={allCategoryIds}
                  strategy={verticalListSortingStrategy}
                >
                  {allCategoryIds.map(categoryName => {
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
            <div className='text-center py-4 text-gray-400'>
              {group.urls.length === 0
                ? 'このドメインにはタブがありません'
                : 'カテゴリを追加するにはカテゴリ管理から行ってください'}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
