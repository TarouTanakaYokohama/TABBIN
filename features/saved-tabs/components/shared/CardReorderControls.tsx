import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from './SavedTabsResponsive'

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
            <SavedTabsResponsiveLabel>キャンセル</SavedTabsResponsiveLabel>
          </Button>
        </TooltipTrigger>
        <SavedTabsResponsiveTooltipContent side='top'>
          並び替えをキャンセル
        </SavedTabsResponsiveTooltipContent>
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
            <SavedTabsResponsiveLabel>確定</SavedTabsResponsiveLabel>
          </Button>
        </TooltipTrigger>
        <SavedTabsResponsiveTooltipContent side='top'>
          並び替えを確定
        </SavedTabsResponsiveTooltipContent>
      </Tooltip>
    </div>
  )
}
