import { ExternalLink, Settings, Trash } from 'lucide-react'
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

  return (
    <div className='flex flex-shrink-0 items-center gap-2'>
      {/* 子カテゴリ管理 */}
      <Tooltip>
        <TooltipTrigger asChild>
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
        <TooltipTrigger asChild>
          <Button
            variant='secondary'
            size='sm'
            onClick={e => {
              if (
                (group.urls?.length || 0) >= 10 &&
                !window.confirm(
                  '10個以上のタブを開こうとしています。続行しますか？',
                )
              )
                return
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
        <TooltipTrigger asChild>
          <Button
            variant='secondary'
            size='sm'
            onClick={e => {
              e.stopPropagation()
              e.preventDefault()
              if (
                !settings.confirmDeleteAll ||
                window.confirm('すべてのタブを削除しますか？')
              ) {
                handlers.handleDeleteGroup(group.id)
                if (isReorderMode) {
                  requestAnimationFrame(() => {
                    console.log(
                      `並び替えモード中にドメイン ${group.domain} を削除しました`,
                    )
                  })
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
  )
}
