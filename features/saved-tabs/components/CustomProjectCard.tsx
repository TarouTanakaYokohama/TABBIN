import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CustomProject, UserSettings } from '@/utils/storage'
import {
  Edit,
  ExternalLink,
  FolderPlus,
  GripVertical,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { CustomProjectCategory } from './CustomProjectCategory'
import { ProjectUrlItem } from './ProjectUrlItem'

// DND関連のインポート
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Active,
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'

interface CustomProjectCardProps {
  project: CustomProject
  handleOpenUrl: (url: string) => void
  handleDeleteUrl: (projectId: string, url: string) => void
  handleAddUrl: (
    projectId: string,
    url: string,
    title: string,
    category?: string,
  ) => void
  handleDeleteProject: (projectId: string) => void
  handleRenameProject: (projectId: string, newName: string) => void
  handleAddCategory: (projectId: string, categoryName: string) => void
  handleDeleteCategory: (projectId: string, categoryName: string) => void
  handleSetUrlCategory: (
    projectId: string,
    url: string,
    category?: string,
  ) => void
  handleUpdateCategoryOrder: (projectId: string, newOrder: string[]) => void
  handleReorderUrls: (projectId: string, urls: CustomProject['urls']) => void
  handleOpenAllUrls?: (urls: { url: string; title: string }[]) => void
  settings: UserSettings
  // 追加: ドラッグ中のアイテム情報
  draggedItem?: { url: string; projectId: string; title: string } | null
  // カテゴリ間のURL移動処理を追加
  handleMoveUrlsBetweenCategories?: (
    projectId: string,
    sourceCategoryName: string,
    targetCategoryName: string,
  ) => void
  // ドロップターゲットであるかのフラグを追加
  isDropTarget?: boolean
  // プロジェクト間のURL移動処理を追加
  handleMoveUrlBetweenProjects?: (
    sourceProjectId: string,
    targetProjectId: string,
    url: string,
  ) => void
  handleRenameCategory?: (
    projectId: string,
    oldCategoryName: string,
    newCategoryName: string,
  ) => void
}

export const CustomProjectCard = ({
  project,
  handleOpenUrl,
  handleDeleteUrl,
  handleAddUrl,
  handleDeleteProject,
  handleRenameProject,
  handleAddCategory,
  handleDeleteCategory,
  handleRenameCategory, // カテゴリ名変更ハンドラ
  handleSetUrlCategory,
  handleUpdateCategoryOrder,
  handleReorderUrls,
  handleOpenAllUrls,
  settings,
  draggedItem,
  handleMoveUrlsBetweenCategories,
  isDropTarget = false,
  handleMoveUrlBetweenProjects,
}: CustomProjectCardProps) => {
  // プロジェクト全体をドラッグ可能にするためのsortable設定
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    data: {
      type: 'project',
      projectId: project.id,
      name: project.name,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(project.name)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [activeId, setActiveId] = useState<Active | null>(null)
  const [draggedOverCategory, setDraggedOverCategory] = useState<string | null>(
    null,
  )
  const [isDraggingCategory, setIsDraggingCategory] = useState(false)
  const [draggedCategoryName, setDraggedCategoryName] = useState<string | null>(
    null,
  )

  // このプロジェクトをドロップターゲットとして設定
  const { setNodeRef: setProjectDroppableRef, isOver: isProjectOver } =
    useDroppable({
      id: `project-${project.id}`,
      data: {
        type: 'project',
        projectId: project.id,
      },
    })

  // 未分類URLエリア用のドロップ領域を追加
  const { setNodeRef: setUncategorizedDropRef, isOver: isUncategorizedOver } =
    useDroppable({
      id: `uncategorized-${project.id}`,
      data: {
        type: 'uncategorized',
        projectId: project.id,
        isDropArea: true,
      },
    })

  // 両方のrefを組み合わせる
  const setCombinedRefs = (node: HTMLElement | null) => {
    setNodeRef(node)
    setProjectDroppableRef(node)
  }

  // DND用のセンサー
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Custom collision detection: prioritize uncategorized drop zone via pointerCoordinates
  const collisionDetectionStrategy: CollisionDetection = args => {
    const { droppableRects, active } = args
    // URL drags: default pointer→intersection→center detection
    if (active.data.current?.type === 'url') {
      const pointerCollisions = pointerWithin(args)
      if (pointerCollisions.length > 0) return pointerCollisions
      const intersections = rectIntersection(args)
      if (intersections.length > 0) return intersections
      return closestCenter(args)
    }
    console.log('collisionDetectionStrategy:', {
      droppables: Array.from(droppableRects.keys()),
      pointerCoordinates: args.pointerCoordinates,
    })
    const uncategorizedId = `uncategorized-${project.id}`

    // Prioritize uncategorized drop zone only for non-URL drags
    const pointerCollisions = pointerWithin(args)
    console.log('pointerWithin:', pointerCollisions)
    const uncPointer = pointerCollisions.find(c => c.id === uncategorizedId)
    if (uncPointer && active.data.current?.type !== 'url') {
      console.log('collision by pointerWithin -> uncategorized')
      return [uncPointer]
    }

    // Fallback to rectIntersection detection
    const intersections = rectIntersection(args)
    console.log('rectIntersection:', intersections)
    const uncRect = intersections.find(c => c.id === uncategorizedId)
    if (uncRect && active.data.current?.type !== 'url') {
      console.log('collision by rectIntersection -> uncategorized')
      return [uncRect]
    }
    if (intersections.length > 0) {
      return intersections
    }

    // Then fallback to pointerCollisions
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }

    const centerCollisions = closestCenter(args)
    console.log('closestCenter:', centerCollisions)
    return centerCollisions
  }

  // 別プロジェクトからドラッグされているかを判定
  const isExternalItemOver =
    (isProjectOver || isDropTarget) &&
    draggedItem &&
    draggedItem.projectId !== project.id

  const handleRenameClick = () => {
    if (newName && newName !== project.name) {
      handleRenameProject(project.id, newName)
      setIsRenaming(false)
    } else {
      setNewName(project.name)
      setIsRenaming(false)
    }
  }

  const handleAddCategoryClick = () => {
    if (newCategoryName.trim()) {
      handleAddCategory(project.id, newCategoryName.trim())
      setNewCategoryName('')
      setIsAddingCategory(false)
    }
  }

  // URLアイテムのドラッグ開始時
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active)
    setDraggedOverCategory(null)

    // ドラッグしているのがカテゴリかどうかを判定
    const itemType = event.active.data.current?.type
    const itemId = event.active.id
    console.log(`ドラッグ開始: ${itemId}, タイプ: ${itemType}`)

    if (itemType === 'category') {
      setIsDraggingCategory(true)
      setDraggedCategoryName(String(itemId))
      console.log(`カテゴリ "${itemId}" のドラッグを開始`)
    } else {
      setIsDraggingCategory(false)
      setDraggedCategoryName(null)
    }
  }

  // URLアイテムのドラッグ中
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    // 実際のURL（プレフィックスなし）を取得
    const actualUrl = active.data.current?.url || String(active.id)
    const dragSourceProjectId = active.data.current?.projectId as string
    const dragSourceCategory = active.data.current?.category

    console.log('ドラッグ中:', {
      activeId: active.id,
      activeUrl: actualUrl,
      activeType: active.data.current?.type,
      activeProjectId: dragSourceProjectId,
      activeCategory: dragSourceCategory,
      overId: over?.id,
      overType: over?.data?.current?.type,
      currentProjectId: project.id,
      overData: over?.data?.current || 'データなし',
    })

    // 未分類エリアへのドラッグを検出 - より強化した条件
    const isOverUncategorized =
      over?.id === `uncategorized-${project.id}` ||
      (typeof over?.id === 'string' &&
        String(over.id).includes('uncategorized')) ||
      over?.data?.current?.type === 'uncategorized'

    // 未分類エリアが検出されたらコンソールに詳細出力
    if (isOverUncategorized) {
      console.log('未分類エリアの上でドラッグ中', over?.id, over?.data?.current)
      setDraggedOverCategory(null)
      return
    }

    if (over?.data?.current) {
      console.log('ドロップターゲットのデータ:', over.data.current)

      // 未分類エリアへのドラッグの場合もハイライトを解除
      if (over.data.current.type === 'uncategorized') {
        console.log('未分類エリアの上でドラッグ中')
        setDraggedOverCategory(null)
        return
      }

      // カテゴリへのドラッグ判定を改善 - より多くの条件で判定
      const isCategory =
        over.data.current.type === 'category' ||
        over.data.current.isCategory === true ||
        over.data.current.isDropArea === true ||
        (typeof over.id === 'string' &&
          (String(over.id).startsWith('category-drop-') ||
            String(over.id).includes('category'))) ||
        // データ属性から判定
        (over.data.current.categoryName && !over.data.current.url) ||
        // 親要素を確認してカテゴリかどうかを判断
        over.data.current.parent?.type === 'category'

      if (isCategory) {
        // カテゴリ名を取得 (より確実に)
        let categoryName = over.data.current.categoryName

        if (!categoryName && typeof over.id === 'string') {
          const parts = String(over.id).split('-')
          if (parts.length >= 4) {
            // 最後の部分がカテゴリ名
            categoryName = parts.slice(3).join('-')
          }
        }

        if (categoryName) {
          console.log(
            `"${categoryName}" カテゴリの上でドラッグ中 (ID: ${over.id})`,
          )
          setDraggedOverCategory(categoryName)
          return
        }
      }

      setDraggedOverCategory(null)
    } else {
      setDraggedOverCategory(null)
    }
  }

  // URLアイテムのドラッグ終了時
  const handleUrlDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // DEBUG: log uncategorizedOver and drop target
    console.log('handleUrlDragEnd:', { overId: over?.id, isUncategorizedOver })

    // 実際のURL（プレフィックスなし）を取得
    const actualUrl = active.data.current?.url || String(active.id)
    const dragSourceProjectId = active.data.current?.projectId as string
    const dragSourceCategory = active.data.current?.category

    console.log('ドラッグ終了:', {
      activeId: active.id,
      activeUrl: actualUrl,
      activeType: active.data.current?.type,
      activeProjectId: dragSourceProjectId,
      activeCategory: dragSourceCategory,
      overId: over?.id,
      overType: over?.data?.current?.type,
      currentProjectId: project.id,
      overData: over?.data?.current || 'データなし',
    })

    setActiveId(null)

    // Manual detection for any uncategorized area (empty or non-empty)
    if (event.activatorEvent instanceof MouseEvent) {
      const activatorEvent = event.activatorEvent as MouseEvent
      const { delta } = event
      const dropX = activatorEvent.clientX + delta.x
      const dropY = activatorEvent.clientY + delta.y
      const dropEl = document.elementFromPoint(
        dropX,
        dropY,
      ) as HTMLElement | null
      if (
        dropEl?.closest('[data-uncategorized-area="true"]') &&
        dragSourceCategory
      ) {
        handleSetUrlCategory(project.id, actualUrl, undefined)
        toast.success('URLを未分類に移動しました')
        setDraggedOverCategory(null)
        return
      }
    }

    // 未分類エリアへのドロップ検出（empty含む）
    if (isUncategorizedOver && dragSourceCategory) {
      console.log('moving to uncategorized via handleUrlDragEnd')
      handleSetUrlCategory(project.id, actualUrl, undefined)
      toast.success('URLを未分類に移動しました')
      setDraggedOverCategory(null)
      return
    }

    if (!over) {
      console.log('ドロップ先なし')
      setDraggedOverCategory(null)
      return
    }

    // 1. まず直接的な未分類エリア検出（by ID）
    if (
      over?.id === `uncategorized-${project.id}` ||
      (typeof over?.id === 'string' && over.id.includes('uncategorized'))
    ) {
      console.log('未分類エリアにドロップされました（ID検出）')
      if (dragSourceCategory) {
        handleSetUrlCategory(project.id, actualUrl, undefined)
        toast.success('URLを未分類に移動しました')
        setDraggedOverCategory(null)
        return
      }
    }

    // 2. データ属性ベースの未分類エリア検出
    if (over?.data?.current?.type === 'uncategorized') {
      console.log('未分類エリアにドロップされました（データ属性検出）')
      if (dragSourceCategory) {
        handleSetUrlCategory(project.id, actualUrl, undefined)
        toast.success('URLを未分類に移動しました')
        setDraggedOverCategory(null)
        return
      }
    }

    // 3. 同一プロジェクト内でURLの並び替え
    if (
      over &&
      active.data.current?.type === 'url' &&
      over.data.current?.type === 'url' &&
      over.id !== active.id
    ) {
      // ドロップ先がカテゴリカードの場合はcategoryNameを、そうでなければcategoryを参照
      const overCategory =
        over.data?.current?.type === 'category'
          ? over.data?.current?.categoryName
          : over.data?.current?.category
      // 並び替え（同じカテゴリ or 未分類内）
      if (
        (!dragSourceCategory && !overCategory) ||
        (dragSourceCategory && dragSourceCategory === overCategory)
      ) {
        const urlsInTarget = project.urls.filter(
          u => u.category === dragSourceCategory,
        )
        const oldIndex = urlsInTarget.findIndex(u => u.url === actualUrl)
        const newIndex = urlsInTarget.findIndex(u => u.url === over.id)
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const moved = arrayMove(urlsInTarget, oldIndex, newIndex)
          // 全体のurls配列を新順序に反映
          let newUrls: typeof project.urls
          if (!dragSourceCategory) {
            // 未分類の場合: moved items in place using movedIndex
            let movedIndex = 0
            newUrls = project.urls.map(u => {
              if (!u.category) {
                return moved[movedIndex++]
              }
              return u
            })
          } else {
            // カテゴリ内の場合: moved items in place using movedIndex
            let movedIndex = 0
            newUrls = project.urls.map(u => {
              if (u.category === dragSourceCategory) {
                return moved[movedIndex++]
              }
              return u
            })
          }
          handleReorderUrls(project.id, newUrls)
          toast.success('URLの順序を変更しました')
          setDraggedOverCategory(null)
          return
        }
      } else {
        // カテゴリ間、未分類⇔カテゴリ間の移動
        if (dragSourceCategory !== overCategory) {
          handleSetUrlCategory(project.id, actualUrl, overCategory)
          toast.success(
            overCategory
              ? `URLを「${overCategory}」に移動しました`
              : 'URLを未分類に移動しました',
          )
          setDraggedOverCategory(null)
          return
        }
      }
    }

    // カテゴリへのドロップを検出（未分類エリア検出後に実行）
    if (over?.data?.current?.type === 'category') {
      const targetCategory = over.data.current.categoryName
      if (targetCategory && targetCategory !== dragSourceCategory) {
        console.log(
          `カテゴリ "${targetCategory}" にドロップされました (ID: ${over.id})`,
        )
        handleSetUrlCategory(project.id, actualUrl, targetCategory)
        toast.success(`URLを「${targetCategory}」に移動しました`)
        setDraggedOverCategory(null)
        return
      }
    }

    setDraggedOverCategory(null)
  }

  // カテゴリのドラッグ&ドロップ処理（カテゴリの順序変更のみに修正）
  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    console.log('カテゴリドラッグ終了:', {
      activeId: active.id,
      activeType: active.data.current?.type,
      overId: over?.id,
      overType: over?.data?.current?.type,
      isDraggingCategory,
    })

    setIsDraggingCategory(false)
    setActiveId(null)

    if (!over) {
      setDraggedCategoryName(null)
      return
    }

    // カテゴリをドラッグしていた場合
    if (isDraggingCategory && draggedCategoryName) {
      const sourceCategoryName = draggedCategoryName

      // 別のカテゴリ上にドロップされた場合も、単にカテゴリの順序を変更
      if (active.id !== over.id) {
        console.log(
          `カテゴリの順序を変更: ${active.id} を ${over.id} の位置に移動`,
        )

        // カテゴリの順序を変更
        const oldIndex =
          project.categoryOrder?.indexOf(active.id as string) ??
          project.categories.indexOf(active.id as string)

        const newIndex =
          project.categoryOrder?.indexOf(over.id as string) ??
          project.categories.indexOf(over.id as string)

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(
            project.categoryOrder || project.categories,
            oldIndex,
            newIndex,
          )

          handleUpdateCategoryOrder(project.id, newOrder)
          toast.success('カテゴリの順序を変更しました')
        }
      }
    }

    setDraggedCategoryName(null)
  }

  // カテゴリに属さないURL
  const uncategorizedUrls = project.urls.filter(url => !url.category)

  // カテゴリ表示順を設定
  const categoryOrder = project.categoryOrder || project.categories

  // ページ全体にクリックイベントリスナーを追加（緊急時の手動カテゴリ解除用）
  useEffect(() => {
    const handleManualCategoryReset = (e: MouseEvent) => {
      // Alt+クリックでカテゴリを強制的に解除（緊急時用）
      if (e.altKey) {
        // クリック位置の要素を取得
        const targetElement = document.elementFromPoint(
          e.clientX,
          e.clientY,
        ) as HTMLElement
        if (targetElement) {
          const urlAttr =
            targetElement.getAttribute('data-url') ||
            targetElement.closest('[data-url]')?.getAttribute('data-url')

          if (urlAttr && project.urls.some(u => u.url === urlAttr)) {
            console.log('Alt+クリックでカテゴリを解除:', urlAttr)
            handleSetUrlCategory(project.id, urlAttr, undefined)
            toast.success('URLのカテゴリを解除しました（Alt+クリック）')
          }
        }
      }
    }

    document.addEventListener('click', handleManualCategoryReset)
    return () =>
      document.removeEventListener('click', handleManualCategoryReset)
  }, [project.id, project.urls, handleSetUrlCategory])

  return (
    <Card
      className={`mb-4 w-full overflow-x-hidden ${
        isExternalItemOver
          ? 'border-primary border-2 shadow-lg bg-primary/5'
          : ''
      }`}
      ref={setCombinedRefs}
      style={style}
    >
      <CardHeader className='flex flex-row flex-wrap justify-between items-baseline py-3 gap-2'>
        {isRenaming ? (
          <div className='flex items-center gap-2 w-full'>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className='flex-grow'
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameClick()
                if (e.key === 'Escape') {
                  setNewName(project.name)
                  setIsRenaming(false)
                }
              }}
            />
            <Button size='sm' onClick={handleRenameClick}>
              保存
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => {
                setNewName(project.name)
                setIsRenaming(false)
              }}
            >
              キャンセル
            </Button>
          </div>
        ) : (
          <>
            <div className='flex items-center gap-2 min-w-0 flex-1'>
              {/* プロジェクトのドラッグハンドル */}
              <div
                {...attributes}
                {...attributes}
                className='cursor-grab active:cursor-grabbing p-1 hover:bg-accent hover:text-accent-foreground rounded-md'
              />
            </div>
            <div className='flex gap-2 flex-wrap justify-end items-center min-w-0 max-w-full'>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      className='truncate'
                      size='sm'
                      onClick={() => setIsAddingCategory(true)}
                    >
                      <FolderPlus size={16} className='mr-1' />
                      <span className='hidden md:inline'>カテゴリ追加</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>新しいカテゴリを追加</TooltipContent>
                </Tooltip>

                {project.urls.length > 0 && handleOpenAllUrls && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        className='truncate max-w-[120px] md:max-w-xs'
                        size='sm'
                        onClick={() => handleOpenAllUrls(project.urls)}
                      >
                        <ExternalLink size={16} className='mr-1' />
                        <span className='hidden md:inline'>すべて開く</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>すべてのタブを開く</TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
            </div>
          </>
        )}
      </CardHeader>
      <CardContent className='overflow-x-hidden'>
        {/* プロジェクト間ドラッグ中の表示 */}
        {isExternalItemOver && (
          <div className='border-2 border-dashed border-primary p-4 mb-4 rounded bg-primary/10 text-center font-medium'>
            <span className='text-primary'>{draggedItem?.title || 'URL'}</span>{' '}
            をここにドロップして追加
          </div>
        )}

        {/* すべてのドラッグ&ドロップを単一のDndContextで処理 */}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={
            isDraggingCategory ? handleCategoryDragEnd : handleUrlDragEnd
          }
        >
          {/* カテゴリ表示部分 - フラットな構造に変更 */}
          {project.categories.length > 0 && (
            <SortableContext
              items={categoryOrder}
              strategy={verticalListSortingStrategy}
            >
              {categoryOrder.map(categoryName => (
                <div key={categoryName} className='mb-4'>
                  <CustomProjectCategory
                    projectId={project.id}
                    category={categoryName}
                    urls={project.urls}
                    handleOpenUrl={handleOpenUrl}
                    handleDeleteUrl={handleDeleteUrl}
                    handleDeleteCategory={handleDeleteCategory}
                    handleSetUrlCategory={handleSetUrlCategory}
                    handleAddCategory={handleAddCategory}
                    handleRenameCategory={handleRenameCategory}
                    settings={settings}
                    handleOpenAllUrls={handleOpenAllUrls}
                    dragData={{ type: 'category' }}
                    isHighlighted={draggedOverCategory === categoryName}
                    isDraggingCategory={isDraggingCategory}
                    draggedCategoryName={draggedCategoryName}
                    isCategoryReorder={true}
                  />
                </div>
              ))}
            </SortableContext>
          )}

          {/* 未分類URL表示部分 */}
          {project.urls.length > 0 && uncategorizedUrls.length > 0 && (
            <div
              className={`mt-4 p-4 uncategorized-area uncategorized-drop-zone overflow-x-hidden ${
                isUncategorizedOver
                  ? 'border-2 border-primary bg-primary/10 rounded shadow-sm'
                  : 'border border-dashed border-muted rounded'
              }`}
              ref={setUncategorizedDropRef}
              id={`uncategorized-${project.id}`}
              data-type='uncategorized'
              data-project-id={project.id}
              data-is-drop-area='true'
              data-uncategorized-area='true'
              data-uncategorized-container='true'
              aria-label='未分類URLエリア'
            >
              {project.categories.length > 0 && (
                <h3
                  className='text-md font-semibold mb-2 px-2 uncategorized-heading'
                  data-type='uncategorized'
                  data-uncategorized-area='true'
                >
                  未分類のURL
                  {isUncategorizedOver && (
                    <span className='text-primary' data-type='uncategorized'>
                      {' '}
                      (ドロップでカテゴリ解除)
                    </span>
                  )}
                </h3>
              )}

              <SortableContext
                items={uncategorizedUrls.map(item => item.url)}
                strategy={verticalListSortingStrategy}
              >
                <ul
                  className='space-y-2 uncategorized-area uncategorized-list'
                  data-type='uncategorized'
                  data-parent-id={`uncategorized-${project.id}`}
                  data-uncategorized-area='true'
                  data-uncategorized-list='true'
                  style={{ overflow: 'hidden' }}
                >
                  {uncategorizedUrls.map(item => (
                    <ProjectUrlItem
                      key={item.url}
                      item={item}
                      projectId={project.id}
                      handleOpenUrl={handleOpenUrl}
                      handleDeleteUrl={handleDeleteUrl}
                      handleSetCategory={handleSetUrlCategory}
                      isInUncategorizedArea={true}
                      parentType='uncategorized'
                      settings={settings}
                    />
                  ))}
                </ul>
              </SortableContext>
            </div>
          )}

          {/* 空の未分類エリアも表示して、ドロップ可能にする */}
          {project.urls.length > 0 &&
            uncategorizedUrls.length === 0 &&
            project.categories.length > 0 && (
              <button
                className={`mt-4 p-8 border-2 border-dashed rounded cursor-pointer w-full text-left uncategorized-area uncategorized-drop-zone uncategorized-empty ${
                  isUncategorizedOver
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-muted hover:border-muted-foreground hover:bg-accent/5'
                }`}
                ref={setUncategorizedDropRef}
                id={`uncategorized-${project.id}`}
                data-type='uncategorized'
                data-project-id={project.id}
                data-is-drop-area='true'
                data-uncategorized-area='true'
                data-uncategorized-container='true'
                data-empty-container='true'
                aria-label='URLをここにドロップして未分類に移動'
                onClick={() => {
                  // 直接クリックでもカテゴリ解除できるようにする（万が一のフォールバック）
                  const selectedUrl = window.getSelection()?.toString()
                  if (
                    selectedUrl &&
                    project.urls.some(u => u.url === selectedUrl)
                  ) {
                    handleSetUrlCategory(project.id, selectedUrl, undefined)
                    toast.success('URLを未分類に移動しました')
                  }
                }}
                type='button'
              >
                <div className='text-center font-medium'>
                  <span
                    className={
                      isUncategorizedOver
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }
                  >
                    URLをここにドロップして<strong>未分類</strong>に移動
                  </span>
                </div>
              </button>
            )}

          {/* ドラッグ中のオーバーレイ */}
          {activeId && (
            <DragOverlay style={{ pointerEvents: 'none' }}>
              {project.urls.find(
                u =>
                  u.url === activeId.id ||
                  u.url === activeId.data?.current?.url,
              ) && (
                <div className='border p-2 rounded bg-secondary'>
                  {project.urls.find(
                    u =>
                      u.url === activeId.id ||
                      u.url === activeId.data?.current?.url,
                  )?.title || 'URL'}
                </div>
              )}
            </DragOverlay>
          )}
        </DndContext>

        {/* プロジェクトが空の場合 */}
        {project.urls.length === 0 && !isExternalItemOver && (
          <div className='text-center text-muted-foreground py-4'>
            このプロジェクトにはURLがありません。
            <br />
            拡張機能アイコンからタブを保存するか、右クリックメニューから追加できます。
            <br />
            他のプロジェクトからURLをドラッグ&ドロップして追加することもできます。
          </div>
        )}
      </CardContent>

      {/* カテゴリ追加モーダル */}
      <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいカテゴリを追加</DialogTitle>
          </DialogHeader>
          <Input
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            placeholder='カテゴリ名'
            className='w-full'
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddCategoryClick()
            }}
          />
          <DialogFooter>
            <Button
              variant='ghost'
              onClick={() => {
                setNewCategoryName('')
                setIsAddingCategory(false)
              }}
            >
              キャンセル
            </Button>
            <Button onClick={handleAddCategoryClick}>追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// 要素が未分類エリア内にあるかを判定
function isElementInUncategorizedArea(element: HTMLElement): boolean {
  let currentElement = element
  const maxDepth = 10 // 無限ループを避けるための最大探索深度

  for (let i = 0; i < maxDepth && currentElement; i++) {
    if (
      currentElement.getAttribute('data-uncategorized-area') === 'true' ||
      currentElement.getAttribute('data-type') === 'uncategorized' ||
      currentElement.id?.includes('uncategorized') ||
      currentElement.classList.contains('uncategorized-area')
    ) {
      return true
    }

    // 親要素に遡る
    currentElement = currentElement.parentElement as HTMLElement
    if (!currentElement) break
  }

  return false
}
