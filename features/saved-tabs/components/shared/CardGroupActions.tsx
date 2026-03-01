import { ExternalLink, Settings, Trash } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CardGroupActionsProps {
  onOpenAll?: () => void
  onDeleteAll?: () => void
  onManage?: () => void
  onConfirmOpenAll?: boolean
  onConfirmDeleteAll?: boolean
  openAllThreshold?: number
  itemName?: string
  warningMessage?: string
  manageLabel?: string
}

/**
 * 汎用的なカードグループ操作ボタン群
 * すべて開く、すべて削除、管理（オプション）を含む
 */
export const CardGroupActions = ({
  onOpenAll,
  onDeleteAll,
  onManage,
  onConfirmOpenAll = false,
  onConfirmDeleteAll = false,
  openAllThreshold = 10,
  itemName = 'アイテム',
  warningMessage = 'すべてのドメインを削除します。この操作は元に戻せません。',
  manageLabel = '管理',
}: CardGroupActionsProps) => {
  const [isOpenAllConfirmOpen, setIsOpenAllConfirmOpen] = useState(false)
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false)

  return (
    <>
      <div className='pointer-events-auto ml-2 flex shrink-0 gap-2'>
        {/* 管理ボタン (オプション) */}
        {onManage && (
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Button
                variant='secondary'
                size='sm'
                onClick={onManage}
                className='flex cursor-pointer items-center gap-1'
                aria-label={manageLabel}
              >
                <Settings size={14} />
                <span className='hidden lg:inline'>{manageLabel}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              {manageLabel}
            </TooltipContent>
          </Tooltip>
        )}

        {/* すべて開く */}
        {onOpenAll && (
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Button
                variant='secondary'
                size='sm'
                onClick={() => {
                  if (onConfirmOpenAll) {
                    setIsOpenAllConfirmOpen(true)
                  } else {
                    onOpenAll()
                  }
                }}
                className='flex cursor-pointer items-center gap-1'
                aria-label='すべてのタブを開く'
              >
                <ExternalLink size={14} />
                <span className='hidden lg:inline'>すべて開く</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              すべてのタブを開く
            </TooltipContent>
          </Tooltip>
        )}

        {/* すべて削除 */}
        {onDeleteAll && (
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Button
                variant='secondary'
                size='sm'
                onClick={e => {
                  e.stopPropagation()
                  e.preventDefault()
                  if (onConfirmDeleteAll) {
                    setIsDeleteAllConfirmOpen(true)
                  } else {
                    onDeleteAll()
                  }
                }}
                className='flex cursor-pointer items-center gap-1'
                aria-label='すべて削除'
              >
                <Trash size={14} />
                <span className='hidden lg:inline'>すべて削除</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              すべて削除
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* タブを開く確認ダイアログ */}
      {onOpenAll && (
        <AlertDialog
          open={isOpenAllConfirmOpen}
          onOpenChange={setIsOpenAllConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>タブをすべて開きますか？</AlertDialogTitle>
              <AlertDialogDescription>
                {openAllThreshold}
                個以上のタブを開こうとしています。続行しますか？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onOpenAll()
                }}
              >
                開く
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* 全削除確認ダイアログ */}
      {onDeleteAll && (
        <AlertDialog
          open={isDeleteAllConfirmOpen}
          onOpenChange={setIsDeleteAllConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {itemName}をすべて削除しますか？
              </AlertDialogTitle>
              <AlertDialogDescription>{warningMessage}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={onDeleteAll}>
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
