import { ArrowUpDown, ArrowUpNarrowWide, ArrowUpWideNarrow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SortOrder } from '../../hooks/useSortOrder'

/** CardSortControl の props */
interface CardSortControlProps {
  /** 現在のソート順 */
  sortOrder: SortOrder
  /** ソート順を設定する関数 */
  setSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>
}

/**
 * ソート順切り替えトグルボタン
 * default → asc → desc のサイクルで切り替わる
 * @param props CardSortControlProps
 */
export const CardSortControl = ({
  sortOrder,
  setSortOrder,
}: CardSortControlProps) => {
  let label = '保存日時の降順'
  if (sortOrder === 'default') {
    label = 'デフォルト'
  } else if (sortOrder === 'asc') {
    label = '保存日時の昇順'
  }

  let icon = <ArrowUpWideNarrow size={14} />
  if (sortOrder === 'default') {
    icon = <ArrowUpDown size={14} />
  } else if (sortOrder === 'asc') {
    icon = <ArrowUpNarrowWide size={14} />
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        <Button
          variant='secondary'
          size='sm'
          onClick={e => {
            e.stopPropagation()
            setSortOrder(o => {
              if (o === 'default') {
                return 'asc'
              }
              if (o === 'asc') {
                return 'desc'
              }
              return 'default'
            })
          }}
          className='flex cursor-pointer items-center gap-1'
          aria-label={label}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side='top' className='block lg:hidden'>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
