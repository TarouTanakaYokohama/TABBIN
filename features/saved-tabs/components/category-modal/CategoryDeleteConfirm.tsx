import { Trash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SavedTabsResponsiveLabel } from '../shared/SavedTabsResponsive'
import { useCategoryModalContext } from './CategoryModalContext'

/**
 * 親カテゴリの削除確認UI
 * 削除確認モード中のみ表示される
 */
export const CategoryDeleteConfirm = () => {
  const { state } = useCategoryModalContext()
  const { deletion, isLoading } = state

  if (!(deletion.showDeleteConfirm && deletion.categoryToDelete)) {
    return null
  }

  return (
    <div className='mt-2 mb-3 rounded border p-3'>
      <p className='mb-2 text-gray-700 dark:text-gray-300'>
        親カテゴリ「{deletion.categoryToDelete.name}
        」を削除しますか？この操作は取り消せません。
        {deletion.categoryToDelete.domainNames?.length > 0 ? (
          <span className='mt-1 block text-xs'>
            このカテゴリには {deletion.categoryToDelete.domainNames.length}
            件のドメインが関連付けられています。
            削除すると、ドメインと親カテゴリの関連付けも削除されます。
          </span>
        ) : null}
      </p>
      <div className='flex justify-end gap-2'>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => deletion.setShowDeleteConfirm(false)}
          disabled={isLoading}
        >
          キャンセル
        </Button>
        <Button
          variant='destructive'
          size='sm'
          onClick={deletion.handleDeleteCategory}
          disabled={isLoading}
          className='flex items-center gap-1'
        >
          <Trash size={14} />
          <SavedTabsResponsiveLabel>削除</SavedTabsResponsiveLabel>
        </Button>
      </div>
    </div>
  )
}
