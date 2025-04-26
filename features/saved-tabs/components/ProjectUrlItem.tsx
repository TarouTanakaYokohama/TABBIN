import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CustomProject } from '@/utils/storage'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronRight,
  ExternalLink,
  Folder,
  GripVertical,
  MoreVertical,
  Trash2,
} from 'lucide-react'

interface ProjectUrlItemProps {
  item: CustomProject['urls'][0]
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

// 親カテゴリ名を取得
const getParentCategory = (category?: string) => {
  if (!category || !category.includes('/')) return ''
  const parts = category.split('/')
  return parts[0]
}

export const ProjectUrlItem = ({
  item,
  projectId,
  handleOpenUrl,
  handleDeleteUrl,
  handleSetCategory,
  availableCategories = [],
  isInUncategorizedArea = false,
  parentType,
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
      className={`flex justify-between items-center border-b border-border pb-1 last:border-0 group
        ${isDragging ? 'opacity-50 bg-secondary/50' : ''}
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
        className='cursor-grab active:cursor-grabbing p-1 opacity-30 group-hover:opacity-100'
      >
        <GripVertical size={16} className='text-muted-foreground' />
      </div>

      <Button
        variant='ghost'
        size='sm'
        className='text-left w-full justify-start text-foreground hover:text-foreground hover:underline truncate'
        onClick={() => handleOpenUrl(item.url)}
      >
        {/* サブカテゴリ付きのURLの場合はChevronRightを表示 */}
        {item.category?.includes('/') && (
          <ChevronRight size={14} className='text-primary mr-1 inline-block' />
        )}
        {item.title || item.url}
        {/* カテゴリ階層の視覚的な表示をシンプル化 */}
        {item.category?.includes('/') && (
          <Badge variant='outline' className='ml-2 text-xs'>
            {getCategoryDisplayName(item.category)}
          </Badge>
        )}
      </Button>

      <div className='flex items-center gap-1'>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => handleOpenUrl(item.url)}
          className='h-8 w-8 p-0'
          title='URLを開く'
        >
          <ExternalLink size={16} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem
              onClick={() => handleDeleteUrl(projectId, item.url)}
              className='text-destructive'
            >
              <Trash2 size={16} className='mr-2' />
              <span>削除</span>
            </DropdownMenuItem>

            {/* カテゴリが設定されている場合の「カテゴリ解除」オプション */}
            {item.category && handleSetCategory && (
              <DropdownMenuItem
                onClick={() =>
                  handleSetCategory(projectId, item.url, undefined)
                }
                className='border-l-2 border-primary text-primary'
              >
                <Folder size={16} className='mr-2' />
                <span>カテゴリ解除</span>
              </DropdownMenuItem>
            )}

            {/* カテゴリ選択メニュー */}
            {handleSetCategory &&
              availableCategories &&
              availableCategories.length > 0 &&
              availableCategories
                .filter(cat => cat !== item.category) // 現在のカテゴリは表示しない
                .map(category => (
                  <DropdownMenuItem
                    key={category}
                    onClick={() =>
                      // "undefined" 文字列を特別に処理してカテゴリを解除する
                      handleSetCategory(
                        projectId,
                        item.url,
                        category === 'undefined' ? undefined : category,
                      )
                    }
                  >
                    <Folder size={16} className='mr-2' />
                    <span>
                      {category === 'undefined'
                        ? 'カテゴリ解除'
                        : `「${category}」に移動`}
                    </span>
                  </DropdownMenuItem>
                ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
