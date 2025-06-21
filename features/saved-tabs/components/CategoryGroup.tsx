import { Button } from '@/components/ui/button'
import { CardContent, CardHeader } from '@/components/ui/card'
import type { CategoryGroupProps } from '@/types/saved-tabs'
import { CategoryManagementModal } from '../components/CategoryManagementModal'

interface TabGroup {
  id: string
  domain: string
  urls: Array<{ url: string; title: string; subCategory?: string }>
  subCategories?: string[]
}

interface ParentCategory {
  id: string
  name: string
  domains: string[]
  domainNames: string[]
}
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSortOrder } from '../hooks/useSortOrder'
import { SortableDomainCard } from './SortableDomainCard'

// カテゴリグループコンポーネント
export const CategoryGroup = ({
  category,
  domains,
  handleOpenAllTabs,
  handleDeleteGroup,
  handleDeleteUrl,
  handleOpenTab,
  handleUpdateUrls,
  handleUpdateDomainsOrder,
  handleMoveDomainToCategory,
  handleDeleteCategory,
  settings,
  isCategoryReorderMode = false, // 親カテゴリ並び替えモード状態
}: CategoryGroupProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [userCollapsedState, setUserCollapsedState] = useState(false) // ユーザーが手動設定した状態
  const [_isDraggingOver, setIsDraggingOver] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  // Track when a domain card is being dragged
  const [isDraggingDomains, setIsDraggingDomains] = useState(false)
  // Track global drag state
  const [isDraggingGlobal, setIsDraggingGlobal] = useState<boolean>(false)
  // 並び替えモード状態管理
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [_originalDomainOrder, setOriginalDomainOrder] = useState<TabGroup[]>(
    [],
  )
  const [tempDomainOrder, setTempDomainOrder] = useState<TabGroup[]>([])
  // ドメインの状態とソート順を共通フックで管理
  const [localDomains, setLocalDomains] = useState<TabGroup[]>(domains)
  const {
    sortOrder,
    setSortOrder,
    sortedItems: sortedDomains,
  } = useSortOrder(localDomains, d => d.domain)

  // カテゴリ名が更新されたときの処理
  const handleCategoryUpdate = async (categoryId: string, newName: string) => {
    try {
      // 詳細な開始ログ
      console.log('CategoryGroup - handleCategoryUpdate開始:', {
        categoryId,
        newName,
        currentCategory: category,
        isValidCategory: !!category && !!category.id,
        currentDomains: localDomains,
      })

      // ローカルストレージから現在のカテゴリグループを取得
      console.log('CategoryGroup - ストレージからカテゴリグループを取得中...')
      const result = await chrome.storage.local.get(['parentCategories'])
      const categoryGroups = result.parentCategories || []
      console.log('CategoryGroup - 現在のカテゴリグループ:', categoryGroups)

      // 対象のカテゴリが存在するか確認
      const existingCategory = categoryGroups.find(
        (cat: ParentCategory) => cat.id === categoryId,
      )
      console.log('CategoryGroup - 既存のカテゴリ:', existingCategory)

      if (!existingCategory) {
        console.log('CategoryGroup - カテゴリが見つからないため新規作成')
        categoryGroups.push({
          id: categoryId,
          name: newName,
          domains: [],
          domainNames: [],
        })
      }

      // カテゴリ名を更新
      console.log('CategoryGroup - カテゴリ名の更新処理開始')
      const updatedGroups = categoryGroups.map((cat: ParentCategory) => {
        if (cat.id === categoryId) {
          console.log('CategoryGroup - カテゴリを更新:', {
            oldName: cat.name,
            newName,
            currentCategory: cat,
          })
          return {
            ...cat,
            name: newName,
            domainNames: [...(cat.domainNames || [])], // 既存のドメイン名を保持
          }
        }
        return cat
      })

      console.log('CategoryGroup - 更新内容を確認:', {
        before: categoryGroups,
        after: updatedGroups,
        targetId: categoryId,
      })

      // ストレージに保存して確認
      console.log('CategoryGroup - ストレージに保存開始')
      await chrome.storage.local.set({ parentCategories: updatedGroups })

      // 保存結果を確認して再試行
      let retryCount = 0
      const maxRetries = 3

      while (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500))
        const checkResult = await chrome.storage.local.get('parentCategories')
        const savedCategory = checkResult.parentCategories?.find(
          (cat: ParentCategory) => cat.id === categoryId,
        )

        if (savedCategory && savedCategory.name === newName) {
          console.log('CategoryGroup - 保存の確認に成功:', savedCategory)
          break
        }

        console.log(
          `CategoryGroup - 保存の確認に失敗 (試行 ${retryCount + 1}/${maxRetries})`,
        )
        await chrome.storage.local.set({ parentCategories: updatedGroups })
        retryCount++
      }

      // 保存結果を確認
      const savedResult = await chrome.storage.local.get(['parentCategories'])
      const savedCategory = savedResult.parentCategories?.find(
        (cat: ParentCategory) => cat.id === categoryId,
      )

      if (!savedCategory || savedCategory.name !== newName) {
        console.error('CategoryGroup - 保存の検証に失敗:', {
          savedCategory,
          expectedName: newName,
        })
        throw new Error('カテゴリの更新が正しく保存されませんでした')
      }

      console.log('CategoryGroup - ストレージ保存完了', {
        savedCategory,
        allCategories: savedResult.parentCategories,
      })

      // 保存が完了したことを通知
      await new Promise(resolve => setTimeout(resolve, 500)) // 更新が反映されるまで待機

      // 更新の反映を待機してから処理を完了
      console.log('CategoryGroup - 更新完了を待機中...')
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 最終確認
      const finalCheck = await chrome.storage.local.get('parentCategories')
      const finalCategory = finalCheck.parentCategories?.find(
        (cat: ParentCategory) => cat.id === categoryId,
      )

      if (!finalCategory || finalCategory.name !== newName) {
        console.error('CategoryGroup - 最終確認で更新が反映されていません:', {
          expectedName: newName,
          actualName: finalCategory?.name,
        })
        throw new Error('カテゴリ名の更新が反映されていません')
      }

      console.log('CategoryGroup - カテゴリ更新が完了しました:', finalCategory)
    } catch (error) {
      console.error('CategoryGroup - カテゴリ名の更新に失敗:', {
        error,
        categoryId,
        newName,
        stack: error instanceof Error ? error.stack : undefined,
      })
      console.log('CategoryGroup - エラー発生時の状態:', {
        categoryGroups: await chrome.storage.local.get('categoryGroups'),
        localDomains,
      })
      toast.error('カテゴリ名の更新に失敗しました')
    }
  }

  // useSortableフックを使用してドラッグ機能を追加
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Monitor global drag state for collapse, but only for category dragging
  useDndMonitor({
    onDragStart: () => {
      // カテゴリドラッグ開始時にすべてのカテゴリを折りたたむ
      setIsDraggingGlobal(true)
    },
    onDragEnd: () => {
      setIsDraggingGlobal(false)
      // 並び替えモード中（ドメイン並び替えまたは親カテゴリ並び替え）でなければドロップ時に展開する
      if (!isReorderMode && !isCategoryReorderMode) {
        setIsCollapsed(false)
      }
    },
    onDragCancel: () => {
      setIsDraggingGlobal(false)
      // 並び替えモード中（ドメイン並び替えまたは親カテゴリ並び替え）でなければドラッグキャンセル時も展開する
      if (!isReorderMode && !isCategoryReorderMode) {
        setIsCollapsed(false)
      }
    },
  })

  // Update collapse state when dragging the category itself
  useEffect(() => {
    // カテゴリ自体がドラッグされている場合のみ折りたたむ
    // ドメイン並び替えモード中はカテゴリ自体は折りたたまない
    // 親カテゴリ並び替えモード中は既に折りたたまれているので追加処理は不要
    if (isDraggingGlobal && !isCategoryReorderMode) {
      setIsCollapsed(true)
    }
  }, [isDraggingGlobal, isCategoryReorderMode])

  // 親カテゴリ並び替えモード中の折りたたみ状態管理
  const prevReorderModeRef = useRef<boolean>(false)
  useEffect(() => {
    if (isCategoryReorderMode && !prevReorderModeRef.current) {
      // 並び替えモード開始時：現在のユーザー設定状態を保存し、折りたたむ
      setUserCollapsedState(isCollapsed)
      setIsCollapsed(true)
      prevReorderModeRef.current = true
    } else if (!isCategoryReorderMode && prevReorderModeRef.current) {
      // 並び替えモード終了時：ユーザー設定状態に復元
      setIsCollapsed(userCollapsedState)
      prevReorderModeRef.current = false
    }
  }, [isCategoryReorderMode, isCollapsed, userCollapsedState])

  // ドメインの変更を検知して更新
  useEffect(() => {
    setLocalDomains(domains)
  }, [domains])

  // このカテゴリ内のすべてのURLを取得
  const allUrls = domains.flatMap(group => group.urls)

  // ドラッグ&ドロップのためのセンサー
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // ドラッグオーバー時の処理を追加
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDraggingOver(true)
  }

  // ドラッグリーブ時の処理
  const handleDragLeave = () => {
    setIsDraggingOver(false)
  }

  // ドロップ時の処理
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDraggingOver(false)

    const domainId = event.dataTransfer.getData('domain-id')
    const fromCategoryId = event.dataTransfer.getData('from-category-id')

    if (domainId && handleMoveDomainToCategory) {
      // 同じカテゴリへのドロップでなければ処理
      if (fromCategoryId !== category.id) {
        handleMoveDomainToCategory(
          domainId,
          fromCategoryId || null,
          category.id,
        )
      }
    }
  }

  // ドラッグ終了時の処理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // ドメインの並び順を一時的に更新（まだストレージには保存しない）
      const currentOrder = isReorderMode ? tempDomainOrder : localDomains
      const oldIndex = currentOrder.findIndex(domain => domain.id === active.id)
      const newIndex = currentOrder.findIndex(domain => domain.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const updatedDomains = arrayMove(currentOrder, oldIndex, newIndex)

        if (!isReorderMode) {
          // 初回の並び替え時：並び替えモードを開始
          setIsReorderMode(true)
          setOriginalDomainOrder([...localDomains])
          setTempDomainOrder(updatedDomains)
          // カテゴリ自体は折りたたまない（個々のドメインが折りたたまれる）
        } else {
          // 既に並び替えモード中：一時的な順序を更新
          setTempDomainOrder(updatedDomains)
        }
      }
    }
    // ドラッグ終了時の処理
    setIsDraggingDomains(false)
    // 並び替えモード中でない場合のみ展開状態に戻す
    // 並び替えモード中は折りたたみ状態を維持
  }

  // Collapse all domain cards at drag start
  const handleDragStart = () => {
    setIsDraggingDomains(true)
  }

  // 並び替えを確定する
  const handleConfirmReorder = async () => {
    if (!isReorderMode) return

    try {
      // 親コンポーネントに通知してストレージに保存
      if (handleUpdateDomainsOrder) {
        await handleUpdateDomainsOrder(category.id, tempDomainOrder)
      }

      // ローカル状態を更新
      setLocalDomains(tempDomainOrder)

      // 並び替えモードを終了
      setIsReorderMode(false)
      setOriginalDomainOrder([])
      setTempDomainOrder([])

      toast.success('ドメインの順序を変更しました')
    } catch (error) {
      console.error('ドメイン順序の更新に失敗しました:', error)
      toast.error('ドメイン順序の更新に失敗しました')
    }
  }

  // 並び替えをキャンセルする
  const handleCancelReorder = () => {
    if (!isReorderMode) return

    // 元の順序に戻す
    setTempDomainOrder([])

    // 並び替えモードを終了
    setIsReorderMode(false)
    setOriginalDomainOrder([])

    toast.info('並び替えをキャンセルしました')
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardHeader className='sticky top-0 z-50 my-2 flex-row items-baseline justify-between bg-card'>
          <div className='flex flex-grow items-center gap-2'>
            {/* 折りたたみ切り替えボタン */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={e => {
                    e.stopPropagation()
                    if (!isCategoryReorderMode) {
                      const newState = !isCollapsed
                      setIsCollapsed(newState)
                      setUserCollapsedState(newState)
                    }
                  }}
                  className={`flex items-center gap-1 ${
                    isCategoryReorderMode
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer'
                  }`}
                  aria-label={isCollapsed ? '展開' : '折りたたむ'}
                  disabled={isCategoryReorderMode}
                >
                  {isCollapsed ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronUp size={14} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                {isCategoryReorderMode
                  ? '親カテゴリ並び替えモード中'
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
                      o === 'default'
                        ? 'asc'
                        : o === 'asc'
                          ? 'desc'
                          : 'default',
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
            <div
              className='flex w-full cursor-grab items-center gap-2 text-foreground hover:cursor-grab active:cursor-grabbing'
              {...attributes}
              {...listeners}
            >
              <GripVertical size={16} aria-hidden='true' />
              <div className='flex items-center gap-2'>
                <h2 className='font-bold text-foreground text-xl'>
                  {category.name}
                </h2>
                <span className='flex gap-2 text-muted-foreground'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant='secondary'>{allUrls.length}</Badge>
                    </TooltipTrigger>
                    <TooltipContent side='top' className='block lg:hidden'>
                      タブ数
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant='secondary'>{domains.length}</Badge>
                    </TooltipTrigger>
                    <TooltipContent side='top' className='block lg:hidden'>
                      ドメイン数
                    </TooltipContent>
                  </Tooltip>
                </span>
              </div>
            </div>
          </div>

          {/* 並び替えモード中の確定・キャンセルボタン */}
          {isReorderMode && (
            <div className='pointer-events-auto ml-2 flex flex-shrink-0 gap-2'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleCancelReorder}
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
                <TooltipTrigger asChild>
                  <Button
                    variant='default'
                    size='sm'
                    onClick={handleConfirmReorder}
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

          <div className='pointer-events-auto ml-2 flex flex-shrink-0 gap-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => {
                    console.log('CategoryGroup - カテゴリ管理ボタンクリック', {
                      categoryId: category.id,
                      categoryName: category.name,
                      domainsCount: domains.length,
                      currentState: { isModalOpen, isProcessing: false },
                    })
                    setIsModalOpen(true)
                  }}
                  className='flex cursor-pointer items-center gap-1'
                  aria-label='親カテゴリを管理'
                >
                  <Settings size={14} />
                  <span className='hidden lg:inline'>親カテゴリ管理</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                親カテゴリを管理
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => {
                    if (
                      allUrls.length >= 10 &&
                      !window.confirm(
                        '10個以上のタブを開こうとしています。続行しますか？',
                      )
                    )
                      return
                    handleOpenAllTabs(allUrls)
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={async e => {
                    e.stopPropagation()
                    e.preventDefault()
                    if (
                      !settings.confirmDeleteAll ||
                      window.confirm(
                        'カテゴリ内のすべてのドメインを削除しますか？',
                      )
                    ) {
                      for (const { id } of domains) {
                        await handleDeleteGroup(id)
                      }
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
          </div>
        </CardHeader>
        {!isCollapsed && (
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={(isReorderMode ? tempDomainOrder : sortedDomains).map(
                  domain => domain.id,
                )}
                strategy={verticalListSortingStrategy}
              >
                {(isReorderMode ? tempDomainOrder : sortedDomains).map(
                  group => (
                    <SortableDomainCard
                      key={group.id}
                      group={group}
                      handleOpenAllTabs={handleOpenAllTabs}
                      handleDeleteGroup={handleDeleteGroup}
                      handleDeleteUrl={handleDeleteUrl}
                      handleOpenTab={handleOpenTab}
                      handleUpdateUrls={handleUpdateUrls}
                      handleDeleteCategory={handleDeleteCategory}
                      categoryId={category.id} // 親カテゴリIDを渡す
                      isDraggingOver={isDraggingDomains}
                      settings={settings} // settingsを渡す
                      isReorderMode={isReorderMode} // 並び替えモード状態を渡す
                    />
                  ),
                )}
              </SortableContext>
            </DndContext>
          </CardContent>
        )}
      </div>

      {/* カテゴリ管理モーダル */}
      <CategoryManagementModal
        isOpen={isModalOpen}
        onClose={() => {
          console.log('CategoryGroup - モーダルを閉じる', {
            categoryId: category.id,
            categoryName: category.name,
            domainsCount: domains.length,
          })
          setIsModalOpen(false)
        }}
        category={category}
        domains={localDomains}
        onCategoryUpdate={handleCategoryUpdate}
      />
    </>
  )
}
