import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** CardReorderControls の props */
interface CardReorderControlsProps {
  /** 並び替えモード */
  isReorderMode: boolean
  /** 並び替えキャンセル */
  onCancel: () => void
  /** 並び替え確定 */
  onConfirm: () => void
  /** コンテナのクラス */
  className?: string
  /** キャンセルボタンの aria-label */
  cancelLabel?: string
  /** 確定ボタンの aria-label */
  confirmLabel?: string
}

/**
 * 並び替え確定・キャンセルボタン
 * @param props CardReorderControlsProps
 */
export const CardReorderControls = ({
  isReorderMode,
  onCancel,
  onConfirm,
  className,
  cancelLabel = '並び替えをキャンセル',
  confirmLabel = '並び替えを確定',
}: CardReorderControlsProps) => {
  if (!isReorderMode) {
    return null
  }

  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <Button
            variant='outline'
            size='sm'
            onClick={onCancel}
            className='flex cursor-pointer items-center gap-1'
            aria-label={cancelLabel}
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
            onClick={onConfirm}
            className='flex cursor-pointer items-center gap-1'
            aria-label={confirmLabel}
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
