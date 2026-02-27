import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCategoryGroup } from './CategoryGroupContext'

/**
 * CategoryGroup のドメイン並び替え確定・キャンセルボタン
 * 並び替えモード中のみ表示される
 */
export const CategoryGroupReorderControls = () => {
  const { state } = useCategoryGroup()
  const { reorder } = state

  if (!reorder.isReorderMode) {
    return null
  }

  return (
    <div className='pointer-events-auto ml-2 flex shrink-0 gap-2'>
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <Button
            variant='outline'
            size='sm'
            onClick={reorder.handleCancelReorder}
            className='flex cursor-pointer items-center gap-1'
            aria-label='並び替えをキャンセル'
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
            onClick={reorder.handleConfirmReorder}
            className='flex cursor-pointer items-center gap-1'
            aria-label='並び替えを確定'
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
