import { ExternalLink, Settings, Trash } from 'lucide-react'
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

  return (
    <div className='pointer-events-auto ml-2 flex flex-shrink-0 gap-2'>
      {/* 親カテゴリ管理 */}
      <Tooltip>
        <TooltipTrigger asChild>
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
        <TooltipTrigger asChild>
          <Button
            variant='secondary'
            size='sm'
            onClick={() => {
              const domainsToOpen = reorder.isReorderMode
                ? reorder.tempDomainOrder
                : domains
              const urlsToOpen = domainsToOpen.flatMap(
                group => group.urls || [],
              )

              if (
                urlsToOpen.length >= 10 &&
                !window.confirm(
                  '10個以上のタブを開こうとしています。続行しますか？',
                )
              )
                return
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
        <TooltipTrigger asChild>
          <Button
            variant='secondary'
            size='sm'
            onClick={async e => {
              e.stopPropagation()
              e.preventDefault()
              if (
                !settings.confirmDeleteAll ||
                window.confirm('カテゴリ内のすべてのドメインを削除しますか？')
              ) {
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
  )
}
