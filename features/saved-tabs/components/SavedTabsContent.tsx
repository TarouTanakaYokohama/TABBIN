import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Trash } from 'lucide-react'
import { useCallback, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/features/i18n/context/I18nProvider'
import { removeUrlsFromTabGroup } from '@/lib/storage/tabs'
import type { SortableCategorySectionProps } from '@/types/saved-tabs'
import type { UserSettings } from '@/types/storage'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from './shared/SavedTabsResponsive'
import { CategorySection } from './TimeRemaining'

// 並び替え可能なカテゴリセクションコンポーネント
export const SortableCategorySection = ({
  id,
  handleOpenAllTabs,
  handleDeleteAllTabs, // 削除ハンドラを追加
  settings,
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
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false)
  const [isOpenAllConfirmOpen, setIsOpenAllConfirmOpen] = useState(false)

  const categoryDisplayName =
    props.categoryName === '__uncategorized'
      ? t('savedTabs.uncategorized')
      : props.categoryName
  const urls = props.urls ?? []
  const urlCount = urls.length

  /**
   * カテゴリ内の全タブを削除する処理（確認済みの場合に呼び出す）
   */
  const executeDeleteAllTabs = useCallback(async () => {
    if (isDeleting) {
      return
    }
    setIsDeleting(true)
    try {
      const urlsToDelete = [...urls]
      const urlsToRemove = urlsToDelete.map(item => item.url)
      if (handleDeleteAllTabs) {
        await handleDeleteAllTabs(urlsToDelete)
      } else {
        await removeUrlsFromTabGroup(props.groupId, urlsToRemove)
      }
      console.log(
        `カテゴリ「${categoryDisplayName}」から${urlsToRemove.length}件のURLを削除しました`,
      )
    } catch (error) {
      console.error('削除処理中にエラーが発生しました:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [
    categoryDisplayName,
    handleDeleteAllTabs,
    isDeleting,
    props.groupId,
    urls,
  ])

  // 削除ボタンクリック時の処理
  const onDeleteAllTabs = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDeleteAllConfirmOpen(true)
  }, [])

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={
          isDragging
            ? 'category-section mb-1 rounded-md bg-muted shadow-lg'
            : 'category-section mb-1'
        }
      >
        <div className='category-header mb-0.5 flex items-center justify-between border-border border-b pb-0.5'>
          {/* ドラッグハンドル部分 */}
          <div
            className={`flex grow items-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab hover:cursor-grab active:cursor-grabbing'}`}
            {...attributes}
            {...listeners}
          >
            <div className='mr-2 text-muted-foreground/60'>
              <GripVertical size={16} aria-hidden='true' />
            </div>
            <h3 className='font-medium text-foreground'>
              {categoryDisplayName}{' '}
              <span className='text-muted-foreground text-sm'>
                ({urlCount})
              </span>
            </h3>
          </div>

          {/* ボタンコンテナ */}
          <div className='flex items-center gap-2'>
            <Tooltip>
              <TooltipTrigger asChild={true}>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={e => {
                    if (urlCount >= 10) {
                      e.stopPropagation()
                      setIsOpenAllConfirmOpen(true)
                      return
                    }
                    e.stopPropagation()
                    handleOpenAllTabs(urls)
                  }}
                  className='pointer-events-auto z-20 flex cursor-pointer items-center gap-1'
                  style={{ position: 'relative' }}
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

        <CategorySection {...props} urls={urls} settings={settings} />
      </div>

      {/* 10個以上タブを開く確認ダイアログ */}
      <AlertDialog
        open={isOpenAllConfirmOpen}
        onOpenChange={setIsOpenAllConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('savedTabs.openAllConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('savedTabs.openAllConfirmDescription', undefined, {
                count: '10',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleOpenAllTabs(urls)}>
              {t('common.open')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* カテゴリ全削除確認ダイアログ */}
      <AlertDialog
        open={isDeleteAllConfirmOpen}
        onOpenChange={setIsDeleteAllConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('savedTabs.deleteAllConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('savedTabs.deleteAllConfirmDescription', undefined, {
                categoryName: categoryDisplayName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void executeDeleteAllTabs()}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
