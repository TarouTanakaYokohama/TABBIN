import { GripVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCategoryGroup } from './CategoryGroupContext'

/**
 * CategoryGroup のドラッグハンドル＆カテゴリ名表示
 * カテゴリ名、タブ数・ドメイン数バッジ、ドラッグハンドルを含む
 */
export const CategoryGroupTitle = () => {
  const { category, allUrls, visibleDomainsCount, sortable } =
    useCategoryGroup()

  return (
    <div
      className='flex w-full cursor-grab items-center gap-2 text-foreground hover:cursor-grab active:cursor-grabbing'
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <GripVertical size={16} aria-hidden='true' />
      <div className='flex items-center gap-2'>
        <h2 className='font-bold text-foreground text-xl'>{category.name}</h2>
        <span className='flex gap-2 text-muted-foreground'>
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Badge variant='secondary'>{allUrls?.length ?? 0}</Badge>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              タブ数
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Badge variant='secondary'>{visibleDomainsCount}</Badge>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              ドメイン数
            </TooltipContent>
          </Tooltip>
        </span>
      </div>
    </div>
  )
}
