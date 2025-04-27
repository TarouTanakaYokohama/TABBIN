import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SortableCategorySectionProps } from '@/types/saved-tabs'
import { safelyUpdateGroupUrls } from '@/utils/tab-operations'
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
import { useCallback, useMemo, useState } from 'react'
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

      // タイムアウトを使って処理を次のイベントループに移す
      setTimeout(async () => {
        try {
          // URLのコピーを作成
          const urlsToDelete = [...props.urls]

          // まず削除フラグを設定して安全にUIを更新
          if (handleDeleteAllTabs) {
            await handleDeleteAllTabs(urlsToDelete)
          }

          // 削除完了後は一定時間待ってからステートをリセット
          setTimeout(() => {
            setIsDeleting(false)
          }, 500)
        } catch (error) {
          console.error('削除処理中にエラーが発生しました:', error)
          setIsDeleting(false)
        }
      }, 0)
    },
    [props.urls, handleDeleteAllTabs, isDeleting],
  )

  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div>
      <div
        ref={setNodeRef}
        style={style}
        className={
          isDragging
            ? 'category-section mb-1 bg-muted rounded-md shadow-lg'
            : 'category-section mb-1'
        }
      >
        <div className='category-header mb-0.5 pb-0.5 border-b border-border flex items-center justify-between gap-2'>
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
                className='flex items-center gap-1 cursor-pointer'
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
            <TooltipContent side='top' className='lg:hidden block'>
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
                className='flex items-center gap-1 cursor-pointer'
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
            <TooltipContent side='top' className='lg:hidden block'>
              {sortOrder === 'default'
                ? 'デフォルト'
                : sortOrder === 'asc'
                  ? '昇順'
                  : '降順'}
            </TooltipContent>
          </Tooltip>
          {/* ドラッグハンドル部分 */}
          <div
            className={`flex items-center flex-grow ${isDragging ? 'cursor-grabbing' : 'cursor-grab hover:cursor-grab active:cursor-grabbing'}`}
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
              <span className='text-sm text-muted-foreground'>
                ({props.urls.length})
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
                    e.stopPropagation() // ドラッグイベントの伝播を防止
                    handleOpenAllTabs(props.urls)
                  }}
                  className='flex items-center gap-1 z-20 pointer-events-auto cursor-pointer'
                  title={`${props.categoryName === '__uncategorized' ? '未分類' : props.categoryName}のタブをすべて開く`}
                  style={{ position: 'relative' }} // ボタンを確実に上に表示
                >
                  <ExternalLink size={14} />
                  <span className='lg:inline hidden'>すべて開く</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='lg:hidden block'>
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
                    className='flex items-center gap-1 z-20 pointer-events-auto cursor-pointer'
                    title={`${props.categoryName === '__uncategorized' ? '未分類' : props.categoryName}のタブをすべて削除する`}
                    style={{ position: 'relative' }}
                    disabled={isDeleting}
                  >
                    <Trash size={14} />
                    <span className='lg:inline hidden'>
                      {isDeleting ? '削除中...' : 'すべて削除'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side='top' className='lg:hidden block'>
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
