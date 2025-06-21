import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ViewMode } from '@/types/storage'
import { Check, X } from 'lucide-react'

type FooterProps = {
  currentMode: ViewMode
  // 親カテゴリ並び替え関連
  isCategoryReorderMode?: boolean
  onConfirmCategoryReorder?: () => void
  onCancelCategoryReorder?: () => void
}

export const Footer = ({
  currentMode,
  isCategoryReorderMode = false,
  onConfirmCategoryReorder = () => {},
  onCancelCategoryReorder = () => {},
}: FooterProps) => {
  // 親カテゴリ並び替えモード中のみフッターを表示
  if (!isCategoryReorderMode || currentMode !== 'domain') {
    return null
  }

  return (
    <div className='fixed right-0 bottom-0 left-0 z-50 border-border border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='container mx-auto flex items-center justify-center gap-4 px-4 py-3'>
        <div className='flex items-center gap-2'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                onClick={onCancelCategoryReorder}
                className='flex cursor-pointer items-center gap-1'
                aria-label='親カテゴリの並び替えをキャンセル'
              >
                <X size={16} />
                <span>キャンセル</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top'>
              親カテゴリの並び替えをキャンセル
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='default'
                size='sm'
                onClick={onConfirmCategoryReorder}
                className='flex cursor-pointer items-center gap-1'
                aria-label='親カテゴリの並び替えを確定'
              >
                <Check size={16} />
                <span>確定</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top'>
              親カテゴリの並び替えを確定
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
