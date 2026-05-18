import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'

export const useSortableCategoryDrag = (id: string) => {
  const sortable = useSortable({
    id,
    data: {
      type: 'category-section',
    },
  })
  const { transform, transition, isDragging } = sortable

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    position: isDragging ? 'relative' : 'static',
    opacity: isDragging ? 0.8 : 1,
  }

  return { ...sortable, style }
}
