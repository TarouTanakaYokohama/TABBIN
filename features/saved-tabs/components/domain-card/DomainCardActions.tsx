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
import { handleSaveKeywords } from '@/features/saved-tabs/lib/category-keywords'
import { CategoryKeywordModal } from '../CategoryKeywordModal'
import { useDomainCard } from './DomainCardContext'

/**
 * DomainCard の操作ボタン群
 * 子カテゴリ管理、すべて開く、すべて削除、キーワードモーダルを含む
 */
export const DomainCardActions = () => {
  const { state, group, settings, isReorderMode, handlers } = useDomainCard()
  const { keywordModal, parentCategories, categoryActions } = state

  const [isOpenAllConfirmOpen, setIsOpenAllConfirmOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  return (
    <>
      <div className='flex flex-shrink-0 items-center gap-2'>
        {/* 子カテゴリ管理 */}
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              variant='secondary'
              size='sm'
              onClick={() =>
                keywordModal.setShowKeywordModal(!keywordModal.showKeywordModal)
              }
              className='flex cursor-pointer items-center gap-1'
              aria-label='子カテゴリを管理'
            >
              <Settings size={14} />
              <span className='hidden lg:inline'>子カテゴリ管理</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side='top' className='block lg:hidden'>
            子カテゴリを管理
          </TooltipContent>
        </Tooltip>

        {/* すべて開く */}
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              variant='secondary'
              size='sm'
              onClick={e => {
                if ((group.urls?.length || 0) >= 10) {
                  setIsOpenAllConfirmOpen(true)
                  return
                }
                e.stopPropagation()
                handlers.handleOpenAllTabs(group.urls || [])
                if (isReorderMode) {
                  console.log(
                    `並び替えモード中にドメイン ${group.domain} のタブをすべて開きました`,
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

        {/* グループ削除 */}
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              variant='secondary'
              size='sm'
              onClick={e => {
                e.stopPropagation()
                e.preventDefault()
                if (settings.confirmDeleteAll) {
                  setIsDeleteConfirmOpen(true)
                } else {
                  handlers.handleDeleteGroup(group.id)
                  if (isReorderMode) {
                    console.log(
                      `並び替えモード中にドメイン ${group.domain} を削除しました`,
                    )
                  }
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

        {/* キーワードモーダル */}
        {keywordModal.showKeywordModal && (
          <CategoryKeywordModal
            group={group}
            isOpen={keywordModal.showKeywordModal}
            onClose={keywordModal.handleCloseKeywordModal}
            onSave={handleSaveKeywords}
            onDeleteCategory={categoryActions.handleCategoryDelete}
            parentCategories={parentCategories.categories}
            onCreateParentCategory={parentCategories.handleCreateParentCategory}
            onAssignToParentCategory={
              parentCategories.handleAssignToParentCategory
            }
            onUpdateParentCategories={
              parentCategories.handleUpdateParentCategories
            }
          />
        )}
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
                handlers.handleOpenAllTabs(group.urls || [])
                if (isReorderMode) {
                  console.log(
                    `並び替えモード中にドメイン ${group.domain} のタブをすべて開きました`,
                  )
                }
              }}
            >
              開く
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* グループ削除確認ダイアログ */}
      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>すべてのタブを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              このグループのすべてのタブを削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handlers.handleDeleteGroup(group.id)
                if (isReorderMode) {
                  console.log(
                    `並び替えモード中にドメイン ${group.domain} を削除しました`,
                  )
                }
              }}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
