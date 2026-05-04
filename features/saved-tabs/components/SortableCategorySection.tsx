import { useDndMonitor } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowUpDown,
  ArrowUpNarrowWide,
  ArrowUpWideNarrow,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Trash,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/features/i18n/context/I18nProvider'
import type { SortableCategorySectionProps } from '@/types/saved-tabs'
import type { UserSettings } from '@/types/storage'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from './shared/SavedTabsResponsive'
import { CategorySection } from './TimeRemaining'

type SortOrder = 'default' | 'asc' | 'desc'

const nextSortOrderMap: Record<SortOrder, SortOrder> = {
  default: 'asc',
  asc: 'desc',
  desc: 'default',
}

const sortIconMap = {
  default: ArrowUpDown,
  asc: ArrowUpNarrowWide,
  desc: ArrowUpWideNarrow,
} as const

const getCollapseTooltipText = (
  isReorderMode: boolean,
  isCollapsed: boolean,
  t: (
    key: string,
    fallback?: string,
    values?: Record<string, string>,
  ) => string,
): string => {
  if (isReorderMode) {
    return t('savedTabs.reorder.disabled')
  }
  return isCollapsed ? t('savedTabs.expand') : t('savedTabs.collapse')
}

const getCollapseIcon = (isCollapsed: boolean) =>
  isCollapsed ? ChevronDown : ChevronUp

const getCollapseButtonClassName = (isReorderMode: boolean): string =>
  `flex items-center gap-1 ${
    isReorderMode ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
  }`

const openTabsWithConfirm = ({
  urlCount,
  setIsOpenAllConfirmOpen,
  handleOpenAllTabs,
  urls,
}: {
  urlCount: number
  setIsOpenAllConfirmOpen: (open: boolean) => void
  handleOpenAllTabs: SortableCategorySectionProps['handleOpenAllTabs']
  urls: Parameters<SortableCategorySectionProps['handleOpenAllTabs']>[0]
}) => {
  if (urlCount >= 10) {
    setIsOpenAllConfirmOpen(true)
    return
  }
  handleOpenAllTabs(urls)
}

// 並び替え可能なカテゴリセクションコンポーネント
export const SortableCategorySection = ({
  id,
  handleOpenAllTabs,
  handleDeleteAllTabs, // 削除ハンドラを追加
  settings,
  stickyTop = 'top-16', // デフォルト値を設定
  isReorderMode = false, // 並び替えモード状態
  ...props
}: SortableCategorySectionProps & {
  settings: UserSettings
  handleDeleteAllTabs?: (urls: Array<{ url: string }>) => void // 新しいプロップの型定義
}) => {
  const { t } = useI18n()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: 'category-section',
    },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    position: isDragging ? 'relative' : 'static',
    opacity: isDragging ? 0.8 : 1,
  }

  const [isDeleting, setIsDeleting] = useState(false)
  // sort order state: 'default' preserves manual drag order
  const [sortOrder, setSortOrder] = useState<SortOrder>('default')
  const urls = props.urls ?? []
  const urlCount = urls.length
  // derive sorted urls by savedAt (default = original order)
  const sortedUrls = useMemo(() => {
    if (sortOrder === 'default') {
      return urls
    }
    const arr = [...urls]
    arr.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))
    if (sortOrder === 'desc') {
      arr.reverse()
    }
    return arr
  }, [urls, sortOrder])

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isOpenAllConfirmOpen, setIsOpenAllConfirmOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [userCollapsedState, setUserCollapsedState] = useState(false)
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false)
  const displayedCategoryName =
    props.categoryName === '__uncategorized'
      ? t('savedTabs.uncategorized')
      : props.categoryName
  const sectionClassName = isDragging
    ? 'category-section mb-1 rounded-md bg-muted shadow-lg'
    : 'category-section mb-1'
  const collapseTooltipText = getCollapseTooltipText(
    isReorderMode,
    isCollapsed,
    t,
  )
  const sortLabelMap: Record<SortOrder, string> = {
    default: t('savedTabs.sort.default'),
    asc: t('savedTabs.sort.asc'),
    desc: t('savedTabs.sort.desc'),
  }
  const sortLabel = sortLabelMap[sortOrder]
  const SortIcon = sortIconMap[sortOrder]
  const CollapseIcon = getCollapseIcon(isCollapsed)
  const collapseButtonClassName = getCollapseButtonClassName(isReorderMode)

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

  const handleOpenAllClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    openTabsWithConfirm({
      urlCount,
      setIsOpenAllConfirmOpen,
      handleOpenAllTabs,
      urls,
    })
  }

  const onDeleteAllTabsConfirmed = useCallback(async () => {
    setIsDeleteConfirmOpen(false)
    setIsDeleting(true)
    try {
      const urlsToDelete = [...urls]
      await handleDeleteAllTabs?.(urlsToDelete)
    } catch (error) {
      console.error('削除処理中にエラーが発生しました:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [urls, handleDeleteAllTabs])

  const onDeleteAllTabs = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (settings.confirmDeleteAll) {
        setIsDeleteConfirmOpen(true)
      } else {
        void onDeleteAllTabsConfirmed()
      }
    },
    [settings.confirmDeleteAll, onDeleteAllTabsConfirmed],
  )

  const handleDragEndOrCancel = useCallback(() => {
    setIsDraggingGlobal(false)
    if (!isReorderMode) {
      setIsCollapsed(false)
    }
  }, [isReorderMode])

  const handleConfirmOpenAll = () => {
    setIsOpenAllConfirmOpen(false)
    handleOpenAllTabs(urls)
  }

  useDndMonitor({
    onDragStart: () => {
      setIsDraggingGlobal(true)
    },
    onDragEnd: handleDragEndOrCancel,
    onDragCancel: handleDragEndOrCancel,
  })

  useEffect(() => {
    // ドラッグ中または並び替えモード中は折りたたむ
    if (isDraggingGlobal || isReorderMode) {
      setIsCollapsed(true)
      return
    }

    // ドラッグもモードも終了したらユーザーが設定した状態に戻す
    setIsCollapsed(userCollapsedState)
  }, [isDraggingGlobal, isReorderMode, userCollapsedState])

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className={sectionClassName}
        data-saved-tabs-scroll-target='child'
      >
        <div
          className={`category-header sticky ${stickyTop} z-30 mb-0.5 flex items-center justify-between gap-2 bg-background pb-0.5`}
        >
          {/* 折りたたみ切り替えボタン */}
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleToggleCollapse}
                className={collapseButtonClassName}
                aria-label={
                  isCollapsed ? t('savedTabs.expand') : t('savedTabs.collapse')
                }
                disabled={isReorderMode}
              >
                <CollapseIcon size={14} />
              </Button>
            </TooltipTrigger>
            <SavedTabsResponsiveTooltipContent side='top'>
              {collapseTooltipText}
            </SavedTabsResponsiveTooltipContent>
          </Tooltip>
          {/* ソート順切り替え */}
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Button
                variant='secondary'
                size='sm'
                onClick={handleToggleSort}
                className='flex cursor-pointer items-center gap-1'
                aria-label={sortLabel}
              >
                <SortIcon size={14} />
              </Button>
            </TooltipTrigger>
            <SavedTabsResponsiveTooltipContent side='top'>
              {sortLabel}
            </SavedTabsResponsiveTooltipContent>
          </Tooltip>
          {/* ドラッグハンドル部分 */}
          <div
            className={`flex grow items-center gap-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab hover:cursor-grab active:cursor-grabbing'}`}
            {...attributes}
            {...listeners}
          >
            <div className='text-muted-foreground/60'>
              <GripVertical size={16} aria-hidden='true' />
            </div>
            <h3 className='font-medium text-foreground'>
              {displayedCategoryName}
            </h3>
            <span className='text-muted-foreground text-sm'>
              <Tooltip>
                <TooltipTrigger asChild={true}>
                  <Badge variant='secondary'>{urlCount}</Badge>
                </TooltipTrigger>
                <SavedTabsResponsiveTooltipContent side='top'>
                  {t('savedTabs.sortableCategory.tabCountLabel')}
                </SavedTabsResponsiveTooltipContent>
              </Tooltip>
            </span>
          </div>

          {/* ボタンコンテナ */}
          <div className='flex items-center gap-2'>
            <Tooltip>
              <TooltipTrigger asChild={true}>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={handleOpenAllClick}
                  className='pointer-events-auto z-20 flex cursor-pointer items-center gap-1'
                  style={{ position: 'relative' }} // ボタンを確実に上に表示
                >
                  <ExternalLink size={14} />
                  <SavedTabsResponsiveLabel>
                    {t('savedTabs.openAll')}
                  </SavedTabsResponsiveLabel>
                </Button>
              </TooltipTrigger>
              <SavedTabsResponsiveTooltipContent side='top'>
                {t('savedTabs.openAllTabs')}
              </SavedTabsResponsiveTooltipContent>
            </Tooltip>

            {/* 削除ボタンを追加 */}
            {handleDeleteAllTabs && (
              <Tooltip>
                <TooltipTrigger asChild={true}>
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={onDeleteAllTabs}
                    className='pointer-events-auto z-20 flex cursor-pointer items-center gap-1'
                    style={{ position: 'relative' }}
                    disabled={isDeleting}
                  >
                    <Trash size={14} />
                    <SavedTabsResponsiveLabel>
                      {isDeleting
                        ? t('savedTabs.deletingAll')
                        : t('savedTabs.deleteAll')}
                    </SavedTabsResponsiveLabel>
                  </Button>
                </TooltipTrigger>
                <SavedTabsResponsiveTooltipContent side='top'>
                  {t('savedTabs.deleteAllTabs')}
                </SavedTabsResponsiveTooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {!isCollapsed && (
          <CategorySection
            {...props}
            urls={sortedUrls}
            settings={settings}
            scrollTarget={false}
          />
        )}
      </div>

      {/* 削除確認ダイアログ */}
      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('savedTabs.sortableCategory.bulkDeleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'savedTabs.sortableCategory.bulkDeleteDescription',
                undefined,
                {
                  name: displayedCategoryName,
                },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDeleteAllTabsConfirmed()}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* すべて開く確認ダイアログ */}
      <AlertDialog
        open={isOpenAllConfirmOpen}
        onOpenChange={setIsOpenAllConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('savedTabs.sortableCategory.bulkOpenTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('savedTabs.openAllConfirmDescription', undefined, {
                count: '10',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOpenAll}>
              {t('common.open')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
