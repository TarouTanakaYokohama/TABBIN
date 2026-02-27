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
import { useCategoryGroup } from './CategoryGroupContext'

/**
 * CategoryGroup の操作ボタン群
 * 親カテゴリ管理、すべて開く、すべて削除を含む
 */
export const CategoryGroupActions = () => {
  const { state, category, domains, settings, handlers } = useCategoryGroup()
  const { modal, reorder } = state

  const [isOpenAllConfirmOpen, setIsOpenAllConfirmOpen] = useState(false)
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false)

  const domainsToUse = reorder.isReorderMode ? reorder.tempDomainOrder : domains
  const urlsToOpen = domainsToUse.flatMap(group => group.urls || [])

  /** カテゴリ内の全ドメインを削除する処理（確認済みの場合） */
  const executeDeleteAll = async () => {
    const domainsToDelete = reorder.isReorderMode
      ? reorder.tempDomainOrder
      : domains
    for (const { id } of domainsToDelete) {
      await handlers.handleDeleteGroup(id)
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    if (reorder.isReorderMode) {
      console.log(
        `並び替えモード中にカテゴリ ${category.name} のすべてのドメインを削除しました`,
      )
    }
  }

  return (
    <>
      <div className='pointer-events-auto ml-2 flex flex-shrink-0 gap-2'>
        {/* 親カテゴリ管理 */}
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              variant='secondary'
              size='sm'
              onClick={() => {
                modal.setIsModalOpen(true)
              }}
              className='flex cursor-pointer items-center gap-1'
              aria-label='親カテゴリを管理'
            >
              <Settings size={14} />
              <span className='hidden lg:inline'>親カテゴリ管理</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side='top' className='block lg:hidden'>
            親カテゴリを管理
          </TooltipContent>
        </Tooltip>

        {/* すべて開く */}
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              variant='secondary'
              size='sm'
              onClick={() => {
                if (urlsToOpen.length >= 10) {
                  setIsOpenAllConfirmOpen(true)
                  return
                }
                handlers.handleOpenAllTabs(urlsToOpen)
                if (reorder.isReorderMode) {
                  console.log(
                    `並び替えモード中にカテゴリ ${category.name} のタブをすべて開きました`,
                  )
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

        {/* すべて削除 */}
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              variant='secondary'
              size='sm'
              onClick={e => {
                e.stopPropagation()
                e.preventDefault()
                if (settings.confirmDeleteAll) {
                  setIsDeleteAllConfirmOpen(true)
                } else {
                  void executeDeleteAll()
                }
              }}
              className='flex cursor-pointer items-center gap-1'
              aria-label='すべてのタブを削除'
            >
              <Trash size={14} />
              <span className='hidden lg:inline'>すべて削除</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side='top' className='block lg:hidden'>
            すべてのタブを削除
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 10個以上タブを開く確認ダイアログ */}
      <AlertDialog
        open={isOpenAllConfirmOpen}
        onOpenChange={setIsOpenAllConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>タブをすべて開きますか？</AlertDialogTitle>
            <AlertDialogDescription>
              10個以上のタブを開こうとしています。続行しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handlers.handleOpenAllTabs(urlsToOpen)
                if (reorder.isReorderMode) {
                  console.log(
                    `並び替えモード中にカテゴリ ${category.name} のタブをすべて開きました`,
                  )
                }
              }}
            >
              開く
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* カテゴリ全削除確認ダイアログ */}
      <AlertDialog
        open={isDeleteAllConfirmOpen}
        onOpenChange={setIsDeleteAllConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              すべてのドメインを削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              カテゴリ内のすべてのドメインを削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => void executeDeleteAll()}>
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
