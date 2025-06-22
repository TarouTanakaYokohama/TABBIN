import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CustomProject, UserSettings } from '@/types/storage'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical, X } from 'lucide-react'

export interface ProjectUrlItemProps {
  item: NonNullable<CustomProject['urls']>[0]
  projectId: string
  handleOpenUrl: (url: string) => void
  handleDeleteUrl: (projectId: string, url: string) => void
  handleSetCategory?: (
    projectId: string,
    url: string,
    category?: string,
  ) => void
  availableCategories?: string[]
  // 追加: 未分類エリア内にあるかどうかのフラグ
  isInUncategorizedArea?: boolean
  // 追加: 親要素のタイプ情報
  parentType?: string
  settings: UserSettings
}

// カテゴリ名から表示名を取得する関数を追加
const getCategoryDisplayName = (category?: string) => {
  if (!category) return ''
  const parts = category.split('/')
  return parts[parts.length - 1]
}

// カテゴリの階層レベルを取得
const getCategoryLevel = (category?: string) => {
  if (!category) return 0
  return category.split('/').length - 1
}

export const ProjectUrlItem = ({
  item,
  projectId,
  handleOpenUrl,
  handleDeleteUrl,
  isInUncategorizedArea = false,
  parentType,
  settings,
}: ProjectUrlItemProps) => {
  // 実際のURLを保存（元のURL）
  const originalUrl = item.url

  // ドラッグアンドドロップの設定を強化
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: originalUrl,
    data: {
      type: 'url',
      url: originalUrl,
      projectId: projectId,
      title: item.title || originalUrl.substring(0, 30), // タイトルがない場合はURLの一部を使用
      isUncategorized: !item.category,
      category: item.category,
      notes: item.notes, // メタデータを保存
      isCategory: false, // URLであることを明示
      // カテゴリ操作に関する情報を追加
      canMoveToUncategorized: true,
      originalCategory: item.category,
      hasCategory: !!item.category, // カテゴリ有無の明示的なフラグ
      // 親コンテナ情報を追加
      parent: parentType
        ? { type: parentType, id: `${parentType}-${projectId}` }
        : undefined,
      isInUncategorizedArea, // 未分類エリア内にあるかの情報を追加
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // カテゴリの階層情報
  const categoryLevel = getCategoryLevel(item.category)
  const isInSubcategory = categoryLevel > 0

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group relative flex min-w-0 items-center overflow-hidden border-border border-b pb-1 last:border-0 ${isDragging ? 'bg-secondary/50 opacity-50' : ''}
        ${isInSubcategory ? 'pl-2' : ''}
        ${item.category ? 'border-l-2 border-l-primary/30' : ''}
      `}
      data-url={originalUrl}
      data-project-id={projectId}
      data-category={item.category}
      data-has-category={!!item.category}
      data-category-level={categoryLevel}
      data-parent-type={parentType || ''}
      data-in-uncategorized={isInUncategorizedArea ? 'true' : 'false'}
    >
      <div
        {...attributes}
        {...listeners}
        className='cursor-grab p-1 opacity-30 active:cursor-grabbing group-hover:opacity-100'
      >
        <GripVertical size={16} className='text-muted-foreground' />
      </div>
      {/* タイトル＋バッジ部 */}
      <div className='flex min-w-0 flex-1 items-center'>
        <Button
          asChild
          variant='ghost'
          size='sm'
          className='flex flex-1 items-center gap-1 overflow-hidden text-left text-foreground hover:text-foreground hover:underline'
        >
          <a
            href={item.url}
            target='_blank'
            rel='noopener noreferrer'
            onClick={e => {
              e.preventDefault()
              handleOpenUrl(item.url)
            }}
          >
            {/* サブカテゴリ付きのURLの場合はChevronRightを表示 */}
            {item.category?.includes('/') && (
              <ChevronRight
                size={14}
                className='mr-1 inline-block text-primary'
              />
            )}
            <span className='flex-1 truncate'>{item.title || item.url}</span>
            {/* カテゴリ階層の視覚的な表示をシンプル化 */}
            {item.category?.includes('/') && (
              <Badge variant='outline' className='ml-2 shrink-0 text-xs'>
                {getCategoryDisplayName(item.category)}
              </Badge>
            )}
          </a>
        </Button>
      </div>
      {/* ボタン群 */}
      <div className='flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
        <Button
          variant='ghost'
          size='sm'
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            if (
              !settings.confirmDeleteEach ||
              window.confirm('このURLを削除しますか？')
            ) {
              handleDeleteUrl(projectId, item.url)
            }
          }}
          className='h-8 w-8 cursor-pointer p-0'
          title='URLを削除'
          aria-label='URLを削除'
        >
          <X size={14} />
        </Button>
      </div>
    </li>
  )
}
