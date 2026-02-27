import type { Active, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
// filepath: features/saved-tabs/hooks/useCategoryDnD.ts
import { useState } from 'react'

const parseCategoryNameFromOverId = (overId: string): string | undefined => {
  const parts = overId.split('-')
  if (parts.length < 4) {
    return undefined
  }
  return parts.slice(3).join('-')
}
const isUncategorizedDrop = (
  over: DragOverEvent['over'],
  projectId: string,
): boolean => {
  return Boolean(
    over?.id === `uncategorized-${projectId}` ||
      (typeof over?.id === 'string' &&
        String(over.id).includes('uncategorized')) ||
      over?.data?.current?.type === 'uncategorized',
  )
}
const resolveOverCategoryName = (
  over: DragOverEvent['over'],
): string | null => {
  if (!over?.data?.current) {
    return null
  }
  const overData = over.data.current
  if (overData.type === 'uncategorized') {
    return null
  }
  const isCategory =
    overData.type === 'category' ||
    overData.isCategory === true ||
    overData.isDropArea === true ||
    (typeof over.id === 'string' &&
      (String(over.id).startsWith('category-drop-') ||
        String(over.id).includes('category')))
  if (!isCategory) {
    return null
  }
  if (overData.categoryName) {
    return overData.categoryName
  }
  if (typeof over.id === 'string') {
    return parseCategoryNameFromOverId(String(over.id)) || null
  }
  return null
}

/**
 * カテゴリ・URLのドラッグ＆ドロップ状態管理用カスタムフック
 */
export const useCategoryDnD = () => {
  // ドラッグ中のカテゴリ名
  const [isDraggingCategory, setIsDraggingCategory] = useState(false)
  const [draggedCategoryName, setDraggedCategoryName] = useState<string | null>(
    null,
  )
  const [activeId, setActiveId] = useState<Active | null>(null)
  const [draggedOverCategory, setDraggedOverCategory] = useState<string | null>(
    null,
  )

  // ドラッグ開始
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active)
    setDraggedOverCategory(null)
    const itemType = event.active.data.current?.type
    const itemId = event.active.id
    if (itemType === 'category') {
      setIsDraggingCategory(true)
      setDraggedCategoryName(String(itemId))
    } else {
      setIsDraggingCategory(false)
      setDraggedCategoryName(null)
    }
  }

  // ドラッグ中
  const handleDragOver = (
    event: DragOverEvent,
    project: {
      id: string
    },
  ) => {
    const { over } = event
    if (isUncategorizedDrop(over, project.id)) {
      setDraggedOverCategory(null)
      return
    }
    const categoryName = resolveOverCategoryName(over)
    if (!categoryName) {
      setDraggedOverCategory(null)
      return
    }
    setDraggedOverCategory(categoryName)
  }

  // ドラッグ終了
  const resetDnD = () => {
    setIsDraggingCategory(false)
    setActiveId(null)
    setDraggedCategoryName(null)
    setDraggedOverCategory(null)
  }
  return {
    isDraggingCategory,
    draggedCategoryName,
    activeId,
    draggedOverCategory,
    setDraggedOverCategory,
    setActiveId,
    handleDragStart,
    handleDragOver,
    resetDnD,
  }
}
