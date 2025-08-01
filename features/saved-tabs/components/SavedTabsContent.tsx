import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { safelyUpdateGroupUrls } from '@/features/saved-tabs/lib'
import type { SortableCategorySectionProps } from '@/types/saved-tabs'
import type { UserSettings } from '@/types/storage'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Trash } from 'lucide-react'
import { useCallback, useState } from 'react'
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

  // 完全に再設計された削除処理
  const onDeleteAllTabs = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()

      // 処理中なら何もしない
      if (isDeleting) return

      const categoryDisplayName =
        props.categoryName === '__uncategorized' ? '未分類' : props.categoryName

      if (
        window.confirm(`「${categoryDisplayName}」のタブをすべて削除しますか？`)
      ) {
        setIsDeleting(true)

        // 即時実行関数で非同期処理をカプセル化
        ;(async () => {
          try {
            // URLのコピーを作成
            const urlsToDelete = [...(props.urls || [])]
            const urlsToRemove = urlsToDelete.map(item => item.url)

            // 親から渡された保存済み全URL
            const { savedTabs = [] } =
              await chrome.storage.local.get('savedTabs')
            const currentGroup = savedTabs.find(
              (tab: { id: string }) => tab.id === props.groupId,
            )

            if (currentGroup) {
              // 削除対象以外のURLだけを残す
              const remainingUrls = currentGroup.urls.filter(
                (urlItem: { url: string }) =>
                  !urlsToRemove.includes(urlItem.url),
              )

              // 安全に更新（非同期処理）
              await safelyUpdateGroupUrls(props.groupId, remainingUrls, () => {
                console.log(
                  `カテゴリ「${categoryDisplayName}」から${urlsToRemove.length}件のURLを削除しました`,
                )
                // 削除処理が完了してからフラグをリセット
                Promise.resolve().then(async () => {
                  await new Promise(resolve => requestAnimationFrame(resolve))
                  setIsDeleting(false)
                })
              })
            }
          } catch (error) {
            console.error('削除処理中にエラーが発生しました:', error)
            setIsDeleting(false)
          }
        })()
      }
    },
    [props.categoryName, props.urls, props.groupId, isDeleting],
  )

  return (
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
          className={`flex flex-grow items-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab hover:cursor-grab active:cursor-grabbing'}`}
          {...attributes}
          {...listeners}
        >
          <div className='mr-2 text-muted-foreground/60'>
            <GripVertical size={16} aria-hidden='true' />
          </div>
          <h3 className='font-medium text-foreground'>
            {props.categoryName === '__uncategorized'
              ? '未分類'
              : props.categoryName}{' '}
            <span className='text-muted-foreground text-sm'>
              ({props.urls?.length || 0})
            </span>
          </h3>
        </div>

        {/* ボタンコンテナ */}
        <div className='flex items-center gap-2'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='secondary'
                size='sm'
                onClick={e => {
                  if (
                    (props.urls?.length || 0) >= 10 &&
                    !window.confirm(
                      '10個以上のタブを開こうとしています。続行しますか？',
                    )
                  )
                    return
                  e.stopPropagation() // ドラッグイベントの伝播を防止
                  handleOpenAllTabs(props.urls || [])
                }}
                className='pointer-events-auto z-20 flex cursor-pointer items-center gap-1'
                style={{ position: 'relative' }} // ボタンを確実に上に表示
              >
                <ExternalLink size={14} />
                <span className='hidden lg:inline'>すべて開く</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              すべてのタブを開く
            </TooltipContent>
          </Tooltip>

          {/* 削除ボタンを追加 */}
          {handleDeleteAllTabs && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={onDeleteAllTabs}
                  className='pointer-events-auto z-20 flex cursor-pointer items-center gap-1'
                  style={{ position: 'relative' }}
                  disabled={isDeleting}
                >
                  <Trash size={14} />
                  <span className='hidden lg:inline'>
                    {isDeleting ? '削除中...' : 'すべて削除'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='block lg:hidden'>
                すべてのタブを削除
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <CategorySection {...props} settings={settings} />
    </div>
  )
}
