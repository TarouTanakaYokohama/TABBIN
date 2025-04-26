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
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpDown, ChevronDown, GripVertical, Trash2 } from 'lucide-react'
import { ProjectUrlItem } from './ProjectUrlItem'

interface CustomProjectCategoryProps {
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
  // カテゴリドラッグ関連のプロパティ
  isDraggingCategory?: boolean
  draggedCategoryName?: string | null
  // 追加: 順序変更モード
  isCategoryReorder?: boolean
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

  // ドロップターゲットの識別子
  const categoryDropId = `category-drop-${projectId}-${category}`

  // カテゴリをURLのドロップ先として設定
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: category, // 単純なカテゴリ名IDを使用
    data: {
      type: 'category',
      categoryName: category,
      projectId: projectId,
      isDropArea: true,
      isCategory: true,
    },
  })

  // 両方のrefを組み合わせる
  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node)
    setDroppableRef(node)
  }

  // デバッグログを削減
  if (isOver && isDraggingCategory) {
    console.log(`カテゴリ "${category}" が順序変更のドロップ対象です`)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // このカテゴリに属するURLを抽出
  const categoryUrls = urls.filter(url => url.category === category)

  // ドラッグ中のハイライト状態を決定
  const isDropTarget = isHighlighted || isOver

  // ドラッグ中のカテゴリがこのカテゴリ自身であるかを判定
  const isSelfDragging = isDraggingCategory && draggedCategoryName === category

  // 別のカテゴリがドラッグされており、このカテゴリがドロップ対象になっている場合
  const isReorderTarget =
    isDraggingCategory &&
    draggedCategoryName !== null &&
    draggedCategoryName !== category &&
    isDropTarget

  // カテゴリ順序変更時のスタイルを指定
  const reorderStyle = isReorderTarget
    ? {
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: '2px',
      }
    : {}

  // カードのスタイル計算
  const cardStyle = {
    ...style,
    ...(isOver ? { backgroundColor: 'rgba(0, 255, 0, 0.05)' } : {}),
    ...reorderStyle,
  }

  return (
    <Card
      ref={setRefs}
      style={cardStyle}
      className={`mb-2 ${isDropTarget ? 'border-primary border-2 bg-primary/5' : ''}
        ${isSelfDragging ? 'opacity-50' : ''}`}
      id={category} // IDを明示的に設定
      data-category={category}
      data-is-drop-target='true'
      data-project-id={projectId}
      data-category-name={category}
      data-is-category='true'
      data-type='category'
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

          <h3 className='text-lg font-medium'>{category}</h3>
          <Badge variant='secondary'>{categoryUrls.length} URL</Badge>
        </div>

        <div className='flex items-center gap-1'>
          {/* 順序変更中の表示 */}
          {isReorderTarget && isCategoryReorder && (
            <div className='text-blue-600 text-sm flex items-center mr-2'>
              <ArrowUpDown className='mr-1' size={14} />
              <span>順序を変更</span>
            </div>
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
        className='p-2'
        data-is-drop-area='true'
        data-category-name={category}
        data-project-id={projectId}
        data-is-category='true'
        data-type='category'
      >
        {categoryUrls.length > 0 ? (
          <ul
            className='space-y-1'
            data-is-drop-area='true'
            data-category-name={category}
            data-project-id={projectId}
            data-is-category='true'
            data-type='category'
          >
            {categoryUrls.map(item => (
              <ProjectUrlItem
                key={item.url}
                item={item}
                projectId={projectId}
                handleOpenUrl={handleOpenUrl}
                handleDeleteUrl={handleDeleteUrl}
                handleSetCategory={handleSetUrlCategory}
                // 修正: undefined を文字列として渡す
                availableCategories={['undefined']} // カテゴリ解除オプション（文字列として）
              />
            ))}
          </ul>
        ) : (
          <div
            className='text-center text-muted-foreground py-2 border-2 border-dashed rounded p-4'
            data-is-drop-area='true'
            data-category-name={category}
            data-project-id={projectId}
            data-is-category='true'
            data-type='category'
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
