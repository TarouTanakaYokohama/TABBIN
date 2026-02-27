import { GripVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDomainCard } from './DomainCardContext'

/**
 * DomainCard のドラッグハンドル＆ドメイン名表示
 * ドメイン名、タブ数バッジ、ドラッグハンドルを含む
 */
export const DomainCardTitle = () => {
  const { group, sortable } = useDomainCard()

  return (
    <div
      className='flex grow cursor-grab items-center gap-2 overflow-hidden hover:cursor-grab active:cursor-grabbing'
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <div className='shrink-0 text-muted-foreground/80'>
        <GripVertical size={16} aria-hidden='true' />
      </div>
      <h2 className='truncate font-semibold text-foreground text-lg'>
        {group.domain}
      </h2>
      <span className='text-muted-foreground text-sm'>
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Badge variant='secondary'>{group.urls?.length || 0}</Badge>
          </TooltipTrigger>
          <TooltipContent side='top' className='block lg:hidden'>
            タブ数
          </TooltipContent>
        </Tooltip>
      </span>
    </div>
  )
}
