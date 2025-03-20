import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SortableCategorySectionProps } from '@/types/saved-tabs'
import { TimeRemaining, formatDatetime } from '@/utils/datetime' // TimeRemaining をインポート追加
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Trash } from 'lucide-react'
import { useState } from 'react' // useState を追加
import { SortableUrlItem } from './SortableUrlItem' // SortableUrlItem をインポート

// 並び替え可能なカテゴリセクションコンポーネント
export const SortableCategorySection = ({
  id,
  categoryName,
  urls,
  groupId,
  handleOpenAllTabs,
  handleDeleteAllTabs,
  handleDeleteUrl,
  handleOpenTab,
  handleUpdateUrls,
  settings,
}: SortableCategorySectionProps & {
  settings: UserSettings
  handleDeleteAllTabs?: (urls: Array<{ url: string }>) => Promise<void> // Promise<void>に変更
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

  // 削除中の状態を追加
  const [isDeleting, setIsDeleting] = useState(false)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    position: isDragging ? 'relative' : 'static',
    opacity: isDragging ? 0.8 : 1,
  }

  // 安全な削除処理を実装
  const safeDeleteAllTabs = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!handleDeleteAllTabs || urls.length === 0) return

    try {
      setIsDeleting(true)

      // ここでPromiseが完了するまで待機しない - 非同期処理との競合を防ぐ
      handleDeleteAllTabs(urls).catch(error => {
        console.error('カテゴリ内のタブ削除中にエラーが発生しました:', error)
      })

      // 状態の更新は行わない - コンポーネントがアンマウントされている可能性があるため
    } catch (error) {
      console.error('カテゴリ削除処理中にエラーが発生:', error)
    }
  }

  // CategorySection コンポーネントを内部実装
  const CategorySection = () => (
    <ul className='space-y-1 py-0.5'>
      {urls.map(urlItem => (
        <SortableUrlItem
          key={urlItem.url}
          id={urlItem.url}
          url={urlItem.url}
          title={urlItem.title}
          groupId={groupId}
          subCategory={urlItem.subCategory}
          savedAt={urlItem.savedAt}
          autoDeletePeriod={settings.autoDeletePeriod}
          handleDeleteUrl={handleDeleteUrl}
          handleOpenTab={handleOpenTab}
          categoryContext={categoryName}
          settings={settings}
          handleUpdateUrls={handleUpdateUrls}
        />
      ))}
    </ul>
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? 'category-section mb-1 bg-muted rounded-md shadow-lg'
          : 'category-section mb-1'
      }
    >
      <div className='category-header mb-0.5 pb-0.5 border-b border-border flex items-center justify-between'>
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
            {categoryName === '__uncategorized' ? '未分類' : categoryName}{' '}
            <span className='text-sm text-muted-foreground'>
              ({urls.length})
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
                  handleOpenAllTabs(urls)
                }}
                className='flex items-center gap-1 z-20 pointer-events-auto cursor-pointer'
                title={`${categoryName === '__uncategorized' ? '未分類' : categoryName}のタブをすべて開く`}
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

          {/* 削除ボタンを追加 - 処理をsafeDeleteAllTabsに置き換え */}
          {handleDeleteAllTabs && urls.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={safeDeleteAllTabs}
                  disabled={isDeleting}
                  className='flex items-center gap-1 z-20 pointer-events-auto cursor-pointer'
                  title={`${categoryName === '__uncategorized' ? '未分類' : categoryName}のタブをすべて削除する`}
                  style={{ position: 'relative' }}
                >
                  <Trash size={14} />
                  <span className='lg:inline hidden'>
                    {isDeleting ? '削除中...' : 'すべて削除'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side='top' className='lg:hidden block'>
                {isDeleting ? '削除中...' : 'すべてのタブを削除'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <CategorySection />
    </div>
  )
}
