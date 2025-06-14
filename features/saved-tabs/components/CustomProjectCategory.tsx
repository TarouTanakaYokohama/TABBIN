import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
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
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CustomProjectCategoryProps } from '../types/CustomProjectCategory.types'
import { ProjectUrlItem } from './ProjectUrlItem'

export const CustomProjectCategory = ({
  projectId,
  category,
  urls,
  handleOpenUrl,
  handleDeleteUrl,
  handleDeleteCategory,
  handleSetUrlCategory,
  settings,
  handleOpenAllUrls,
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

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node)
      setDroppableRef(node)
    },
    [setNodeRef, setDroppableRef],
  )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const categoryUrls = useMemo(
    () => urls.filter(u => u.category === category),
    [urls, category],
  )
  const [localCategoryUrls, setLocalCategoryUrls] = useState(categoryUrls)
  useEffect(() => {
    setLocalCategoryUrls(categoryUrls)
  }, [categoryUrls])
  // sort order state: 'default' preserves manual order
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>(
    'default',
  )
  useEffect(() => {
    if (sortOrder === 'default') {
      setLocalCategoryUrls(categoryUrls)
    } else {
      const sorted = [...categoryUrls]
      sorted.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))
      if (sortOrder === 'desc') sorted.reverse()
      setLocalCategoryUrls(sorted)
    }
  }, [categoryUrls, sortOrder])
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

  const [isCollapsed, setIsCollapsed] = useState(false)

  // カテゴリ管理ダイアログ用の状態
  const [showManageDialog, setShowManageDialog] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState(category)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    setNewCategoryName(category)
  }, [category])

  const prevCategoryRef = useRef<string>(category)

  useEffect(() => {
    // update reference without opening the dialog on reorder
    prevCategoryRef.current = category
  }, [category])

  const handleRename = () => {
    if (!newCategoryName.trim()) {
      setRenameError('カテゴリ名を入力してください')
      return
    }
    if (newCategoryName === category) {
      return
    }
    if (handleRenameCategory) {
      handleRenameCategory(projectId, category, newCategoryName)
    }
  }

  const handleConfirmDelete = () => {
    if (handleDeleteCategory) {
      handleDeleteCategory(projectId, category)
    }
    setShowManageDialog(false)
  }

  return (
    <Card
      ref={setRefs}
      style={cardStyle}
      className={`mb-2 overflow-x-hidden ${
        isDropTarget ? 'border-2 border-primary bg-primary/5' : ''
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
      <CardHeader className='flex-row items-center justify-between px-3 py-2'>
        <div
          {...attributes}
          {...listeners}
          className='flex flex-grow cursor-grab items-center gap-2 overflow-hidden hover:cursor-grab active:cursor-grabbing'
        >
          {/* collapse toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='secondary'
                size='sm'
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  setIsCollapsed(prev => !prev)
                }}
                className='flex cursor-pointer items-center gap-1'
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
            <TooltipContent side='top' className='block lg:hidden'>
              {isCollapsed ? '展開' : '折りたたむ'}
            </TooltipContent>
          </Tooltip>
          {/* sort toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='secondary'
                size='sm'
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  setSortOrder(o =>
                    o === 'default' ? 'asc' : o === 'asc' ? 'desc' : 'default',
                  )
                }}
                className='flex cursor-pointer items-center gap-1'
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
            <TooltipContent side='top' className='block lg:hidden'>
              {sortOrder === 'default'
                ? 'デフォルト'
                : sortOrder === 'asc'
                  ? '昇順'
                  : '降順'}
            </TooltipContent>
          </Tooltip>
          <div className='flex-shrink-0 text-muted-foreground'>
            <GripVertical size={16} aria-hidden='true' />
          </div>
          <h3 className='m-0 border-none bg-transparent p-0 font-medium text-lg'>
            {category}
          </h3>
          <Badge variant='secondary'>{localCategoryUrls.length}</Badge>
        </div>
        <div className='flex items-center gap-1'>
          {isReorderTarget && isCategoryReorder && (
            <div className='mr-2 flex items-center text-blue-600 text-sm'>
              <ArrowUpDown className='mr-1' size={14} />
              <span>順序を変更</span>
            </div>
          )}
          {(handleRenameCategory || handleDeleteCategory) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  className='flex cursor-pointer items-center gap-1'
                  onClick={() => setShowManageDialog(true)}
                  title='カテゴリ管理'
                  aria-label='カテゴリ管理'
                >
                  <Settings size={14} />
                  <span className='hidden lg:inline'>カテゴリ管理</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                カテゴリ管理
              </TooltipContent>
            </Tooltip>
          )}
          {localCategoryUrls.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  className='flex cursor-pointer items-center gap-1'
                  onClick={async () => {
                    if (
                      localCategoryUrls.length >= 10 &&
                      !window.confirm(
                        '10個以上のタブを開こうとしています。続行しますか？',
                      )
                    )
                      return
                    if (handleOpenAllUrls) {
                      handleOpenAllUrls(localCategoryUrls)
                    } else {
                      for (const u of localCategoryUrls) {
                        window.open(u.url, '_blank', 'noopener,noreferrer')
                      }
                    }
                  }}
                  title='すべて開く'
                  aria-label='すべて開く'
                >
                  <ExternalLink size={14} />
                  <span className='hidden lg:inline'>すべて開く</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                すべて開く
              </TooltipContent>
            </Tooltip>
          )}
          {localCategoryUrls.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  className='flex cursor-pointer items-center gap-1'
                  onClick={async () => {
                    if (
                      !settings.confirmDeleteAll ||
                      window.confirm(
                        `「${category === '__uncategorized' ? '未分類' : category}」のタブをすべて削除しますか？`,
                      )
                    ) {
                      setLocalCategoryUrls([])
                      for (const u of localCategoryUrls) {
                        await handleDeleteUrl(projectId, u.url)
                      }
                    }
                  }}
                  title='すべて削除'
                  aria-label='すべて削除'
                >
                  <Trash2 size={14} />
                  <span className='hidden lg:inline'>すべて削除</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                すべて削除
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>

      {!isCollapsed && (
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
          {localCategoryUrls.length > 0 ? (
            <SortableContext
              items={localCategoryUrls.map(item => item.url)}
              strategy={verticalListSortingStrategy}
            >
              <ul
                className={`space-y-1 ${
                  isOver ? 'rounded bg-primary/5 p-1' : ''
                }`}
              >
                {localCategoryUrls.map(item => (
                  <ProjectUrlItem
                    key={item.url}
                    item={item}
                    projectId={projectId}
                    handleOpenUrl={handleOpenUrl}
                    handleDeleteUrl={handleDeleteUrl}
                    handleSetCategory={handleSetUrlCategory}
                    availableCategories={['undefined']}
                    settings={settings}
                  />
                ))}
              </ul>
            </SortableContext>
          ) : (
            <div
              className={`rounded border-2 border-dashed p-4 py-2 text-center text-muted-foreground ${
                isOver ? 'border-primary bg-primary/10' : ''
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
      )}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>カテゴリ管理</DialogTitle>
            <DialogDescription>
              カテゴリ「{category}」を編集できます
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='rename-input'>カテゴリ名</Label>
              <Input
                id='rename-input'
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onBlur={handleRename}
                placeholder='例: 開発資料、参考サイト'
                className={`w-full rounded border p-2 ${renameError ? 'border-red-500' : ''}`}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleRename()
                  }
                }}
              />
              {renameError && (
                <p className='mt-1 text-red-500 text-xs'>{renameError}</p>
              )}
            </div>
            <div className='border-t pt-4'>
              <p className='text-gray-600 text-sm'>
                カテゴリを削除すると、このカテゴリに属するすべてのURLは未分類になります。
              </p>
              {showDeleteConfirm ? (
                <div className='mt-2 flex justify-end gap-2'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={handleConfirmDelete}
                  >
                    削除する
                  </Button>
                </div>
              ) : (
                <div className='mt-2 flex justify-end'>
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    カテゴリを削除
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
