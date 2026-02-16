import { ArrowUpDown, ArrowUpNarrowWide, ArrowUpWideNarrow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SortOrder } from '../../hooks/useSortOrder'

/** SortOrderToggle の props */
type SortOrderToggleProps = {
  /** 現在のソート順 */
  sortOrder: SortOrder
  /** ソート順を設定する関数 */
  setSortOrder: (updater: (prev: SortOrder) => SortOrder) => void
}

/**
 * ソート順切り替えトグルボタン
 * DomainCard と CategoryGroup で共通利用される
 * default → asc → desc のサイクルで切り替わる
 * @param props SortOrderToggleProps
 */
export const SortOrderToggle = ({
  sortOrder,
  setSortOrder,
}: SortOrderToggleProps) => {
  const label =
    sortOrder === 'default'
      ? 'デフォルト'
      : sortOrder === 'asc'
        ? '保存日時の昇順'
        : '保存日時の降順'

  return (
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
          aria-label={label}
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
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
