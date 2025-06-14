import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SortableCategorySectionProps } from '@/types/saved-tabs'
import type { UserSettings } from '@/types/storage'
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
  // sort order state: 'default' preserves manual drag order
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>(
    'default',
  )
  // derive sorted urls by savedAt (default = original order)
  const sortedUrls = useMemo(() => {
    if (sortOrder === 'default') return props.urls
    const arr = [...props.urls]
    arr.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))
    if (sortOrder === 'desc') arr.reverse()
    return arr
  }, [props.urls, sortOrder])

  // 完全に再設計された削除処理
  const onDeleteAllTabs = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()

      // 処理中なら何もしない
      if (isDeleting) return

      // 確認ダイアログを削除し、直接削除処理を実行
      setIsDeleting(true)

      // 非同期で処理を実行
      Promise.resolve().then(async () => {
        try {
          // URLのコピーを作成
          const urlsToDelete = [...props.urls]

          // まず削除フラグを設定して安全にUIを更新
          if (handleDeleteAllTabs) {
            if (
              !settings.confirmDeleteAll ||
              window.confirm(
                `「${props.categoryName === '__uncategorized' ? '未分類' : props.categoryName}」のタブをすべて削除しますか？`,
              )
            ) {
              await handleDeleteAllTabs(urlsToDelete)
            }
          }

          // 削除完了後のステートリセット
          Promise.resolve().then(async () => {
            await new Promise(resolve => requestAnimationFrame(resolve))
            setIsDeleting(false)
          })
        } catch (error) {
          console.error('削除処理中にエラーが発生しました:', error)
          setIsDeleting(false)
        }
      })
    },
    [props.urls, handleDeleteAllTabs, isDeleting, settings, props.categoryName],
  )

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false)
  useDndMonitor({
    onDragStart: () => {
      setIsDraggingGlobal(true)
    },
    onDragEnd: () => {
      setIsDraggingGlobal(false)
      setIsCollapsed(false)
    },
    onDragCancel: () => {
      setIsDraggingGlobal(false)
      setIsCollapsed(false)
    },
  })
  useEffect(() => {
    if (isDraggingGlobal) {
      setIsCollapsed(true)
    }
  }, [isDraggingGlobal])

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className={
          isDragging
            ? 'category-section mb-1 rounded-md bg-muted shadow-lg'
            : 'category-section mb-1'
        }
      >
        <div className='category-header mb-0.5 flex items-center justify-between gap-2 border-border border-b pb-0.5'>
          {/* 折りたたみ切り替えボタン */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='secondary'
                size='sm'
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
          {/* ソート順切り替え */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='secondary'
                size='sm'
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
          {/* ドラッグハンドル部分 */}
          <div
            className={`flex flex-grow items-center gap-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab hover:cursor-grab active:cursor-grabbing'}`}
            {...attributes}
            {...listeners}
          >
            <div className='text-muted-foreground/60'>
              <GripVertical size={16} aria-hidden='true' />
            </div>
            <h3 className='font-medium text-foreground'>
              {props.categoryName === '__uncategorized'
                ? '未分類'
                : props.categoryName}
            </h3>
            <span className='text-muted-foreground text-sm'>
              <Badge variant='secondary'>{props.urls.length}</Badge>
            </span>
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
                      props.urls.length >= 10 &&
                      !window.confirm(
                        '10個以上のタブを開こうとしています。続行しますか？',
                      )
                    )
                      return
                    e.stopPropagation() // ドラッグイベントの伝播を防止
                    handleOpenAllTabs(props.urls)
                  }}
                  className='pointer-events-auto z-20 flex cursor-pointer items-center gap-1'
                  title={`${props.categoryName === '__uncategorized' ? '未分類' : props.categoryName}のタブをすべて開く`}
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
                    title={`${props.categoryName === '__uncategorized' ? '未分類' : props.categoryName}のタブをすべて削除する`}
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

        {!isCollapsed && (
          <CategorySection {...props} urls={sortedUrls} settings={settings} />
        )}
      </div>
    </div>
  )
}
