import { Trash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SavedTabsResponsiveLabel } from '../shared/SavedTabsResponsive'
import { useKeywordModal } from './KeywordModalContext'

/**
 * 子カテゴリの削除確認UI
 * 削除確認モード中のみ表示される
 */
export const SubCategoryDeleteConfirm = () => {
  const { state } = useKeywordModal()
  const { subcategory, deletion } = state

  if (!deletion.showDeleteConfirm) {
    return null
  }

  return (
    <div className='mt-2 mb-3 rounded border p-3'>
      <p className='mb-2 text-gray-300'>
        「{subcategory.activeCategory}」子カテゴリを削除しますか？
        <br />
        <span className='text-xs'>
          この子カテゴリに属するすべてのタブは未分類になります
        </span>
      </p>
      <div className='flex justify-end gap-2'>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => deletion.setShowDeleteConfirm(false)}
          className='cursor-pointer rounded px-2 py-1'
        >
          キャンセル
        </Button>
        <Button
          variant='destructive'
          size='sm'
          onClick={deletion.handleDeleteCategory}
          className='flex cursor-pointer items-center gap-1'
        >
          <Trash size={14} />
          <SavedTabsResponsiveLabel>削除</SavedTabsResponsiveLabel>
        </Button>
      </div>
    </div>
  )
}
