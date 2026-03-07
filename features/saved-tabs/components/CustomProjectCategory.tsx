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
import { memo, useEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import type { CustomProjectCategoryProps } from '../types/CustomProjectCategory.types'
import { ProjectUrlItem } from './ProjectUrlItem'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from './shared/SavedTabsResponsive'

type CategoryUrl = NonNullable<CustomProjectCategoryProps['urls']>[number]
type SortOrder = 'default' | 'asc' | 'desc'

const sortOrderLabels: Record<SortOrder, string> = {
  default: 'デフォルト',
  asc: '保存日時の昇順',
  desc: '保存日時の降順',
}

const nextSortOrderMap: Record<SortOrder, SortOrder> = {
  default: 'asc',
  asc: 'desc',
  desc: 'default',
}

const sortOrderIcons = {
  default: ArrowUpDown,
  asc: ArrowUpNarrowWide,
  desc: ArrowUpWideNarrow,
} as const

const getCollapseLabel = (isCollapsed: boolean): string =>
  isCollapsed ? '展開' : '折りたたむ'

const shouldConfirmBulkOpen = (urlCount: number): boolean => urlCount >= 10

const shouldStopDialogPropagation = (key: string): boolean =>
  key === 'Enter' || key === ' '

const sortCategoryUrls = (
  categoryUrls: CategoryUrl[],
  sortOrder: SortOrder,
): CategoryUrl[] => {
  if (sortOrder === 'default') {
    return categoryUrls
  }

  const sorted = [...categoryUrls]
  sorted.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))
  if (sortOrder === 'desc') {
    sorted.reverse()
  }
  return sorted
}

const getEmptyCategoryMessage = ({
  isReorderTarget,
  isCategoryReorder,
  isDropTarget,
}: {
  isReorderTarget: boolean
  isCategoryReorder: boolean
  isDropTarget: boolean
}): string => {
  if (isReorderTarget && isCategoryReorder) {
    return 'カテゴリの順序を変更'
  }
  if (isDropTarget) {
    return 'ここにドロップしてカテゴリに追加'
  }
  return 'このカテゴリにはURLがありません。URLをドラッグ＆ドロップで追加できます。'
}

const getReorderStyle = (isReorderTarget: boolean): React.CSSProperties => {
  if (!isReorderTarget) {
    return {}
  }
  return {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderColor: 'rgb(59, 130, 246)',
    borderWidth: '2px',
  }
}

interface CategoryHeaderMainProps {
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners: ReturnType<typeof useSortable>['listeners']
  category: string
  isCollapsed: boolean
  isCollapseDisabled: boolean
  sortOrder: SortOrder
  urlCount: number
  onToggleCollapse: (event: React.MouseEvent) => void
  onToggleSort: (event: React.MouseEvent) => void
}

const CategoryHeaderMain = ({
  attributes,
  listeners,
  category,
  isCollapsed,
  isCollapseDisabled,
  sortOrder,
  urlCount,
  onToggleCollapse,
  onToggleSort,
}: CategoryHeaderMainProps) => {
  const SortOrderIcon = sortOrderIcons[sortOrder]
  const collapseLabel = getCollapseLabel(isCollapsed)
  const sortLabel = sortOrderLabels[sortOrder]

  return (
    <div
      {...attributes}
      {...listeners}
      className='flex grow cursor-grab items-center gap-2 overflow-hidden hover:cursor-grab active:cursor-grabbing'
    >
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <Button
            variant='secondary'
            size='sm'
            onPointerDown={event => event.stopPropagation()}
            onClick={onToggleCollapse}
            className={`flex items-center gap-1 ${
              isCollapseDisabled
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            }`}
            aria-label={collapseLabel}
            disabled={isCollapseDisabled}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </Button>
        </TooltipTrigger>
        <SavedTabsResponsiveTooltipContent side='top'>
          {collapseLabel}
        </SavedTabsResponsiveTooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild={true}>
          <Button
            variant='secondary'
            size='sm'
            onPointerDown={event => event.stopPropagation()}
            onClick={onToggleSort}
            className='flex cursor-pointer items-center gap-1'
            aria-label={sortLabel}
          >
            <SortOrderIcon size={14} />
          </Button>
        </TooltipTrigger>
        <SavedTabsResponsiveTooltipContent side='top'>
          {sortLabel}
        </SavedTabsResponsiveTooltipContent>
      </Tooltip>

      <div className='shrink-0 text-muted-foreground'>
        <GripVertical size={16} aria-hidden='true' />
      </div>
      <h3 className='m-0 border-none bg-transparent p-0 font-medium text-lg'>
        {category}
      </h3>
      <Badge variant='secondary'>{urlCount}</Badge>
    </div>
  )
}

interface CategoryHeaderActionsProps {
  isReorderTarget: boolean
  isCategoryReorder: boolean
  showManageActions: boolean
  showBulkActions: boolean
  onOpenManageDialog: () => void
  onOpenAllClick: () => void
  onDeleteAllClick: () => void
}

const CategoryHeaderActions = ({
  isReorderTarget,
  isCategoryReorder,
  showManageActions,
  showBulkActions,
  onOpenManageDialog,
  onOpenAllClick,
  onDeleteAllClick,
}: CategoryHeaderActionsProps) => (
  <div className='flex items-center gap-1'>
    {isReorderTarget && isCategoryReorder && (
      <div className='mr-2 flex items-center text-blue-600 text-sm'>
        <ArrowUpDown className='mr-1' size={14} />
        <span>順序を変更</span>
      </div>
    )}

    {showManageActions && (
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <Button
            variant='secondary'
            size='sm'
            className='flex cursor-pointer items-center gap-1'
            onClick={onOpenManageDialog}
            aria-label='カテゴリ管理'
          >
            <Settings size={14} />
            <SavedTabsResponsiveLabel>カテゴリ管理</SavedTabsResponsiveLabel>
          </Button>
        </TooltipTrigger>
        <SavedTabsResponsiveTooltipContent side='top'>
          カテゴリ管理
        </SavedTabsResponsiveTooltipContent>
      </Tooltip>
    )}

    {showBulkActions && (
      <>
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              variant='secondary'
              size='sm'
              className='flex cursor-pointer items-center gap-1'
              onClick={onOpenAllClick}
              aria-label='すべて開く'
            >
              <ExternalLink size={14} />
              <SavedTabsResponsiveLabel>すべて開く</SavedTabsResponsiveLabel>
            </Button>
          </TooltipTrigger>
          <SavedTabsResponsiveTooltipContent side='top'>
            すべて開く
          </SavedTabsResponsiveTooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              variant='secondary'
              size='sm'
              className='flex cursor-pointer items-center gap-1'
              onClick={onDeleteAllClick}
              aria-label='すべて削除'
            >
              <Trash2 size={14} />
              <SavedTabsResponsiveLabel>すべて削除</SavedTabsResponsiveLabel>
            </Button>
          </TooltipTrigger>
          <SavedTabsResponsiveTooltipContent side='top'>
            すべて削除
          </SavedTabsResponsiveTooltipContent>
        </Tooltip>
      </>
    )}
  </div>
)

interface CategoryContentProps {
  urls: CategoryUrl[]
  isOver: boolean
  isDropTarget: boolean
  isReorderTarget: boolean
  isCategoryReorder: boolean
  category: string
  projectId: string
  categoryDropId: string
  setDroppableRef: (node: HTMLElement | null) => void
  handleOpenUrl: (url: string) => void
  handleDeleteUrl: (projectId: string, url: string) => void
  handleSetUrlCategory: (
    projectId: string,
    url: string,
    category?: string,
  ) => void
  settings: CustomProjectCategoryProps['settings']
}

const CategoryContent = ({
  urls,
  isOver,
  isDropTarget,
  isReorderTarget,
  isCategoryReorder,
  category,
  projectId,
  categoryDropId,
  setDroppableRef,
  handleOpenUrl,
  handleDeleteUrl,
  handleSetUrlCategory,
  settings,
}: CategoryContentProps) => {
  const emptyMessage = getEmptyCategoryMessage({
    isReorderTarget,
    isCategoryReorder,
    isDropTarget,
  })

  return (
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
      {urls.length > 0 ? (
        <SortableContext
          items={urls.map(item => item.url)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            className={`space-y-1 ${isOver ? 'rounded bg-primary/5 p-1' : ''}`}
          >
            {urls.map(item => (
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
          {emptyMessage}
        </div>
      )}
    </CardContent>
  )
}

interface CategoryManageDialogProps {
  category: string
  showManageDialog: boolean
  setShowManageDialog: (open: boolean) => void
  newCategoryName: string
  setNewCategoryName: (name: string) => void
  renameError: string | null
  showDeleteConfirm: boolean
  setShowDeleteConfirm: (show: boolean) => void
  onRename: () => void
  onConfirmDelete: () => void
}

const CategoryManageDialog = ({
  category,
  showManageDialog,
  setShowManageDialog,
  newCategoryName,
  setNewCategoryName,
  renameError,
  showDeleteConfirm,
  setShowDeleteConfirm,
  onRename,
  onConfirmDelete,
}: CategoryManageDialogProps) => {
  const handleDialogKeyDown = (event: React.KeyboardEvent) => {
    if (shouldStopDialogPropagation(event.key)) {
      event.stopPropagation()
    }
  }

  const handleRenameInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    onRename()
  }

  return (
    <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
      <DialogContent
        onClick={event => event.stopPropagation()}
        onPointerDown={event => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
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
              onChange={event => setNewCategoryName(event.target.value)}
              onBlur={onRename}
              placeholder='例: 開発資料、参考サイト'
              className={`w-full rounded border p-2 ${renameError ? 'border-red-500' : ''}`}
              onKeyDown={handleRenameInputKeyDown}
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
                  onClick={onConfirmDelete}
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
  )
}

interface CategoryBulkConfirmDialogsProps {
  isOpenAllConfirmOpen: boolean
  setIsOpenAllConfirmOpen: (open: boolean) => void
  isDeleteAllConfirmOpen: boolean
  setIsDeleteAllConfirmOpen: (open: boolean) => void
  categoryDisplayName: string
  onConfirmOpenAll: () => void
  onConfirmDeleteAll: () => Promise<void>
}

const CategoryBulkConfirmDialogs = ({
  isOpenAllConfirmOpen,
  setIsOpenAllConfirmOpen,
  isDeleteAllConfirmOpen,
  setIsDeleteAllConfirmOpen,
  categoryDisplayName,
  onConfirmOpenAll,
  onConfirmDeleteAll,
}: CategoryBulkConfirmDialogsProps) => (
  <>
    <AlertDialog
      open={isOpenAllConfirmOpen}
      onOpenChange={setIsOpenAllConfirmOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>タブをすべて開きますか？</AlertDialogTitle>
          <AlertDialogDescription>
            10個以上のタブを開こうとしています。続行しますか？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmOpenAll}>開く</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={isDeleteAllConfirmOpen}
      onOpenChange={setIsDeleteAllConfirmOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>タブをすべて削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            「{categoryDisplayName}
            」のタブをすべて削除します。この操作は元に戻せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirmDeleteAll()}>
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
)

const CustomProjectCategoryComponent = ({
  projectId,
  category,
  urls,
  handleOpenUrl,
  handleDeleteUrl,
  handleDeleteUrlsFromProject,
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

  const [sortOrder, setSortOrder] = useState<SortOrder>('default')
  const sortedCategoryUrls = useMemo(
    () => sortCategoryUrls(urls || [], sortOrder),
    [urls, sortOrder],
  )
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [userCollapsedState, setUserCollapsedState] = useState(false)
  const [showManageDialog, setShowManageDialog] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState(category)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isOpenAllConfirmOpen, setIsOpenAllConfirmOpen] = useState(false)
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false)

  useEffect(() => {
    setNewCategoryName(category)
  }, [category])

  useEffect(() => {
    if (isDraggingCategory || isCategoryReorder) {
      setIsCollapsed(true)
      return
    }
    setIsCollapsed(userCollapsedState)
  }, [isDraggingCategory, isCategoryReorder, userCollapsedState])

  const isDropTarget = isHighlighted || isOver
  const isSelfDragging = isDraggingCategory && draggedCategoryName === category
  const isReorderTarget =
    isDraggingCategory &&
    draggedCategoryName !== null &&
    draggedCategoryName !== category &&
    isDropTarget

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const cardStyle = {
    ...style,
    ...(isOver ? { backgroundColor: 'rgba(0, 255, 0, 0.05)' } : {}),
    ...getReorderStyle(isReorderTarget),
  }
  const cardClassName = `mb-2 overflow-x-hidden ${
    isDropTarget ? 'border-2 border-primary bg-primary/5' : ''
  } ${isSelfDragging ? 'opacity-50' : ''}`
  const categoryDisplayName =
    category === '__uncategorized' ? '未分類' : category
  const showManageActions = Boolean(
    handleRenameCategory || handleDeleteCategory,
  )
  const showBulkActions = sortedCategoryUrls.length > 0
  const isCollapseDisabled = isDraggingCategory || isCategoryReorder

  const handleToggleCollapse = (event: React.MouseEvent) => {
    event.stopPropagation()
    const newState = !isCollapsed
    setIsCollapsed(newState)
    setUserCollapsedState(newState)
  }

  const handleToggleSort = (event: React.MouseEvent) => {
    event.stopPropagation()
    setSortOrder(current => nextSortOrderMap[current])
  }

  const handleOpenAllUrlsConfirmed = () => {
    if (handleOpenAllUrls) {
      handleOpenAllUrls(sortedCategoryUrls)
      return
    }
    for (const item of sortedCategoryUrls) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleDeleteAllUrlsConfirmed = async () => {
    if (handleDeleteUrlsFromProject) {
      await handleDeleteUrlsFromProject(
        projectId,
        sortedCategoryUrls.map(item => item.url),
      )
    } else {
      for (const item of sortedCategoryUrls) {
        await handleDeleteUrl(projectId, item.url)
      }
    }
  }

  const handleOpenAllClick = () => {
    if (shouldConfirmBulkOpen(sortedCategoryUrls.length)) {
      setIsOpenAllConfirmOpen(true)
      return
    }
    handleOpenAllUrlsConfirmed()
  }

  const handleDeleteAllClick = () => {
    if (settings.confirmDeleteAll) {
      setIsDeleteAllConfirmOpen(true)
      return
    }
    void handleDeleteAllUrlsConfirmed()
  }

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
    <>
      <Card
        ref={setNodeRef}
        style={cardStyle}
        className={cardClassName}
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
          <CategoryHeaderMain
            attributes={attributes}
            listeners={listeners}
            category={category}
            isCollapsed={isCollapsed}
            isCollapseDisabled={isCollapseDisabled}
            sortOrder={sortOrder}
            urlCount={sortedCategoryUrls.length}
            onToggleCollapse={handleToggleCollapse}
            onToggleSort={handleToggleSort}
          />
          <CategoryHeaderActions
            isReorderTarget={isReorderTarget}
            isCategoryReorder={isCategoryReorder}
            showManageActions={showManageActions}
            showBulkActions={showBulkActions}
            onOpenManageDialog={() => setShowManageDialog(true)}
            onOpenAllClick={handleOpenAllClick}
            onDeleteAllClick={handleDeleteAllClick}
          />
        </CardHeader>

        {!isCollapsed && (
          <CategoryContent
            urls={sortedCategoryUrls}
            isOver={isOver}
            isDropTarget={isDropTarget}
            isReorderTarget={isReorderTarget}
            isCategoryReorder={isCategoryReorder}
            category={category}
            projectId={projectId}
            categoryDropId={categoryDropId}
            setDroppableRef={setDroppableRef}
            handleOpenUrl={handleOpenUrl}
            handleDeleteUrl={handleDeleteUrl}
            handleSetUrlCategory={handleSetUrlCategory}
            settings={settings}
          />
        )}

        <CategoryManageDialog
          category={category}
          showManageDialog={showManageDialog}
          setShowManageDialog={setShowManageDialog}
          newCategoryName={newCategoryName}
          setNewCategoryName={setNewCategoryName}
          renameError={renameError}
          showDeleteConfirm={showDeleteConfirm}
          setShowDeleteConfirm={setShowDeleteConfirm}
          onRename={handleRename}
          onConfirmDelete={handleConfirmDelete}
        />
      </Card>

      <CategoryBulkConfirmDialogs
        isOpenAllConfirmOpen={isOpenAllConfirmOpen}
        setIsOpenAllConfirmOpen={setIsOpenAllConfirmOpen}
        isDeleteAllConfirmOpen={isDeleteAllConfirmOpen}
        setIsDeleteAllConfirmOpen={setIsDeleteAllConfirmOpen}
        categoryDisplayName={categoryDisplayName}
        onConfirmOpenAll={handleOpenAllUrlsConfirmed}
        onConfirmDeleteAll={handleDeleteAllUrlsConfirmed}
      />
    </>
  )
}

const CustomProjectCategory = memo(CustomProjectCategoryComponent)
CustomProjectCategory.displayName = 'CustomProjectCategory'

export { CustomProjectCategory }
