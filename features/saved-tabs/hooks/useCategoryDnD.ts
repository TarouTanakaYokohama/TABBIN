import type { Active, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
// filepath: features/saved-tabs/hooks/useCategoryDnD.ts
import { useState } from 'react'

/**
 * カテゴリ・URLのドラッグ＆ドロップ状態管理用カスタムフック
 */
export function useCategoryDnD() {
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
  const handleDragOver = (event: DragOverEvent, project: { id: string }) => {
    const { over } = event
    // 未分類エリアへのドラッグはハイライト解除
    const isOverUncategorized =
      over?.id === `uncategorized-${project.id}` ||
      (typeof over?.id === 'string' &&
        String(over.id).includes('uncategorized')) ||
      over?.data?.current?.type === 'uncategorized'
    if (isOverUncategorized) {
      setDraggedOverCategory(null)
      return
    }
    if (over?.data?.current) {
      if (over.data.current.type === 'uncategorized') {
        setDraggedOverCategory(null)
        return
      }
      const isCategory =
        over.data.current.type === 'category' ||
        over.data.current.isCategory === true ||
        over.data.current.isDropArea === true ||
        (typeof over.id === 'string' &&
          (String(over.id).startsWith('category-drop-') ||
            String(over.id).includes('category')))
      let categoryName = over.data.current.categoryName
      if (!categoryName && typeof over.id === 'string') {
        const parts = String(over.id).split('-')
        if (parts.length >= 4) {
          categoryName = parts.slice(3).join('-')
        }
      }
      if (isCategory && categoryName) {
        setDraggedOverCategory(categoryName)
        return
      }
      setDraggedOverCategory(null)
    } else {
      setDraggedOverCategory(null)
    }
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
