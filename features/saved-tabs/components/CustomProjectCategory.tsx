import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CustomProject } from '@/utils/storage'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpDown, ChevronDown, GripVertical, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ProjectUrlItem } from './ProjectUrlItem'

export interface CustomProjectCategoryProps {
  projectId: string
  category: string
  urls: CustomProject['urls']
  handleOpenUrl: (url: string) => void
  handleDeleteUrl: (projectId: string, url: string) => void
  handleDeleteCategory?: (projectId: string, category: string) => void
  handleSetUrlCategory: (
    projectId: string,
    url: string,
    category?: string,
  ) => void
  handleAddCategory: (projectId: string, category: string) => void
  settings: { removeTabAfterOpen: boolean }
  dragData?: { type: string }
  isHighlighted?: boolean
  isDraggingCategory?: boolean
  draggedCategoryName?: string | null
  isCategoryReorder?: boolean
  handleRenameCategory?: (
    projectId: string,
    oldCategoryName: string,
    newCategoryName: string,
  ) => void
}

export const CustomProjectCategory = ({
  projectId,
  category,
  urls,
  handleOpenUrl,
  handleDeleteUrl,
  handleDeleteCategory,
  handleSetUrlCategory,
  handleAddCategory,
  settings,
  dragData = { type: 'category' },
  isHighlighted = false,
  isDraggingCategory = false,
  draggedCategoryName = null,
  isCategoryReorder = false,
  handleRenameCategory,
}: CustomProjectCategoryProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: category,
      data: {
        ...dragData,
        categoryName: category,
        projectId,
        isCategory: true,
      },
    })

  const categoryDropId = `category-drop-${projectId}-${category}`

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: categoryDropId,
    data: {
      type: 'category',
      categoryName: category,
      projectId,
      isDropArea: true,
      isCategory: true,
    },
  })

  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node)
    setDroppableRef(node)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const categoryUrls = urls.filter(u => u.category === category)
  const isDropTarget = isHighlighted || isOver
  const isSelfDragging = isDraggingCategory && draggedCategoryName === category
  const isReorderTarget =
    isDraggingCategory &&
    draggedCategoryName !== null &&
    draggedCategoryName !== category &&
    isDropTarget

  const reorderStyle = isReorderTarget
    ? {
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: '2px',
      }
    : {}

  const cardStyle = {
    ...style,
    ...(isOver ? { backgroundColor: 'rgba(0, 255, 0, 0.05)' } : {}),
    ...reorderStyle,
  }

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(category)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
    }
  }, [isEditing])

  useEffect(() => {
    setEditName(category)
  }, [category])

  return (
    <Card
      ref={setRefs}
      style={cardStyle}
      className={`mb-2 ${
        isDropTarget ? 'border-primary border-2 bg-primary/5' : ''
      } ${isSelfDragging ? 'opacity-50' : ''}`}
      id={categoryDropId}
      data-category={category}
      data-is-drop-target='true'
      data-project-id={projectId}
      data-category-name={category}
      data-is-category='true'
      data-type='category'
      data-category-drop-id={categoryDropId}
      aria-label={`カテゴリ: ${category}`}
    >
      <CardHeader className='flex-row justify-between items-center py-2 px-3'>
        <div className='flex items-center gap-2'>
          <div
            {...attributes}
            {...listeners}
            className='cursor-grab active:cursor-grabbing'
          >
            <GripVertical size={16} className='text-muted-foreground' />
          </div>
          <div className='flex items-center'>
            <ChevronDown size={16} className='text-primary mr-1' />
          </div>
          {isEditing ? (
            <input
              ref={inputRef}
              type='text'
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={() => {
                if (
                  handleRenameCategory &&
                  editName.trim() &&
                  editName.trim() !== category
                ) {
                  handleRenameCategory(projectId, category, editName.trim())
                }
                setIsEditing(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  ;(e.target as HTMLInputElement).blur()
                }
                if (e.key === 'Escape') {
                  setEditName(category)
                  setIsEditing(false)
                }
              }}
              className='text-lg font-medium bg-transparent border-b border-gray-300 focus:outline-none'
            />
          ) : (
            <h3 className='m-0'>
              <button
                type='button'
                onClick={() => setIsEditing(true)}
                className='text-lg font-medium cursor-text bg-transparent border-none p-0'
              >
                {category}
              </button>
            </h3>
          )}
          <Badge variant='secondary'>{categoryUrls.length} URL</Badge>
        </div>
        <div className='flex items-center gap-1'>
          {isReorderTarget && isCategoryReorder && (
            <div className='text-blue-600 text-sm flex items-center mr-2'>
              <ArrowUpDown className='mr-1' size={14} />
              <span>順序を変更</span>
            </div>
          )}
          {categoryUrls.length > 0 && (
            <Button
              variant='outline'
              size='sm'
              className='mr-1'
              onClick={() => {
                for (const u of categoryUrls) {
                  window.open(u.url, '_blank', 'noopener,noreferrer')
                }
              }}
            >
              すべて開く
            </Button>
          )}
          {handleDeleteCategory && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => handleDeleteCategory(projectId, category)}
                    className='h-8 w-8 p-0'
                  >
                    <Trash2
                      size={16}
                      className='text-muted-foreground hover:text-foreground'
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>カテゴリを削除</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <CardContent
        ref={setDroppableRef}
        className='p-2'
        data-is-drop-area='true'
        data-category-name={category}
        data-project-id={projectId}
        data-is-category='true'
        data-type='category'
        data-category-drop-id={categoryDropId}
      >
        {categoryUrls.length > 0 ? (
          <SortableContext
            items={categoryUrls.map(item => item.url)}
            strategy={verticalListSortingStrategy}
          >
            <ul
              className={`space-y-1 ${
                isOver ? 'bg-primary/5 p-1 rounded' : ''
              }`}
            >
              {categoryUrls.map(item => (
                <ProjectUrlItem
                  key={item.url}
                  item={item}
                  projectId={projectId}
                  handleOpenUrl={handleOpenUrl}
                  handleDeleteUrl={handleDeleteUrl}
                  handleSetCategory={handleSetUrlCategory}
                  availableCategories={['undefined']}
                />
              ))}
            </ul>
          </SortableContext>
        ) : (
          <div
            className={`text-center text-muted-foreground py-2 border-2 border-dashed rounded p-4 ${
              isOver ? 'bg-primary/10 border-primary' : ''
            }`}
          >
            {isReorderTarget && isCategoryReorder
              ? 'カテゴリの順序を変更'
              : isDropTarget
                ? 'ここにドロップしてカテゴリに追加'
                : 'このカテゴリにはURLがありません。URLをドラッグ＆ドロップで追加できます。'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
