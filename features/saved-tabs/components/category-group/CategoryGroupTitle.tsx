import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CardGroupTitle } from '../shared/CardGroupTitle'
import { useCategoryGroup } from './CategoryGroupContext'

/**
 * CategoryGroup のドラッグハンドル＆カテゴリ名表示
 * カテゴリ名、タブ数・ドメイン数バッジ、ドラッグハンドルを含む
 */
export const CategoryGroupTitle = () => {
  const { category, allUrls, visibleDomainsCount, sortable } =
    useCategoryGroup()

  const badges = (
    <>
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
    </>
  )

  return (
    <CardGroupTitle
      title={category.name}
      badges={badges}
      sortableAttributes={sortable.attributes}
      sortableListeners={sortable.listeners}
    />
  )
}
