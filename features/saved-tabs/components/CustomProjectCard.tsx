import { Card, CardContent } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { useCategoryDnD } from '../hooks/useCategoryDnD'
import type { CustomProjectCardProps } from '../types/CustomProjectCard.types'
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
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { toast } from 'sonner'

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

  // DnD状態管理をカスタムフックで共通化
  const {
    isDraggingCategory,
    draggedCategoryName,
    activeId,
    draggedOverCategory,
    setDraggedOverCategory,
    setActiveId,
    handleDragStart,
    handleDragOver,
    resetDnD,
  } = useCategoryDnD()

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
    resetDnD()
    if (!over) return
    if (isDraggingCategory && draggedCategoryName) {
      if (active.id !== over.id) {
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
          onDragOver={event => handleDragOver(event, project)}
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
              {categoryOrder.map((categoryName, idx) => (
                <div key={`${project.id}-${idx}`} className='mb-4'>
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
    </Card>
  )
}

// ユーティリティ関数として分離
// import { isElementInUncategorizedArea } from '../utils/isElementInUncategorizedArea'
