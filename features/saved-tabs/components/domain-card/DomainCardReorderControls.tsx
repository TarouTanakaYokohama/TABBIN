import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDomainCard } from './DomainCardContext'

/**
 * DomainCard の子カテゴリ並び替え確定・キャンセルボタン
 * カテゴリ並び替えモード中のみ表示される
 */
export const DomainCardReorderControls = () => {
  const { state } = useDomainCard()
  const { categoryReorder } = state

  if (!categoryReorder.isCategoryReorderMode) {
    return null
  }

  return (
    <div className='flex flex-shrink-0 items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <Button
            variant='outline'
            size='sm'
            onClick={categoryReorder.handleCancelCategoryReorder}
            className='flex cursor-pointer items-center gap-1'
            aria-label='子カテゴリの並び替えをキャンセル'
          >
            <X size={14} />
            <span className='hidden lg:inline'>キャンセル</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top' className='block lg:hidden'>
          並び替えをキャンセル
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild={true}>
          <Button
            variant='default'
            size='sm'
            onClick={categoryReorder.handleConfirmCategoryReorder}
            className='flex cursor-pointer items-center gap-1'
            aria-label='子カテゴリの並び替えを確定'
          >
            <Check size={14} />
            <span className='hidden lg:inline'>確定</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top' className='block lg:hidden'>
          並び替えを確定
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
