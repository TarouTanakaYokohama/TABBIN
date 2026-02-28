import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** CardCollapseControl の props */
interface CardCollapseControlProps {
  /** 折りたたみ状態 */
  isCollapsed: boolean
  /** 折りたたみ状態を設定する関数 */
  setIsCollapsed: (value: boolean) => void
  /** ユーザーが明示的に設定した折りたたみ状態 */
  setUserCollapsedState: (value: boolean) => void
  /** 無効化状態（並び替えモード中など） */
  isDisabled?: boolean
  /** 無効化時のツールチップメッセージ */
  disabledMessage?: string
}

/**
 * 折りたたみ切り替えトグルボタン
 * @param props CardCollapseControlProps
 */
export const CardCollapseControl = ({
  isCollapsed,
  setIsCollapsed,
  setUserCollapsedState,
  isDisabled = false,
  disabledMessage = '並び替えモード中',
}: CardCollapseControlProps) => {
  let tooltipLabel = disabledMessage
  if (!isDisabled) {
    tooltipLabel = isCollapsed ? '展開' : '折りたたむ'
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        <Button
          variant='secondary'
          size='sm'
          onClick={e => {
            e.stopPropagation()
            const newState = !isCollapsed
            setIsCollapsed(newState)
            setUserCollapsedState(newState)
          }}
          className={`flex items-center gap-1 ${
            isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
          aria-label={isCollapsed ? '展開' : '折りたたむ'}
          disabled={isDisabled}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side='top' className='block lg:hidden'>
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  )
}
