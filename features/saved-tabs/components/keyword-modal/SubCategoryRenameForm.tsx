import { Input } from '@/components/ui/input'
import { useKeywordModal } from './KeywordModalContext'

/**
 * 子カテゴリのリネームフォーム
 * リネームモード中のみ表示される
 */
export const SubCategoryRenameForm = () => {
  const { state } = useKeywordModal()
  const { subcategory, rename } = state

  if (!rename.isRenaming) {
    return null
  }

  return (
    <div className='mt-2 mb-3 rounded border p-3'>
      <div className='mb-2 text-gray-300 text-sm'>
        「{subcategory.activeCategory}」の新しい名前を入力してください
        <br />
        <span className='text-gray-400 text-xs'>
          入力後、フォーカスを外すかEnterキーで保存されます。キャンセルするにはEscを押してください
        </span>
      </div>
      <Input
        value={rename.newCategoryName}
        onChange={rename.handleRenameCategoryNameChange}
        placeholder='例: ニュース、ブログ、コラム'
        className={`w-full rounded border p-2 ${rename.categoryRenameError ? 'border-red-500' : ''}`}
        autoFocus
        data-rename-input='true'
        onBlur={rename.handleSaveRenaming}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            rename.handleCancelRenaming()
          }
        }}
      />
      {rename.categoryRenameError && (
        <p className='mt-1 text-red-500 text-xs'>
          {rename.categoryRenameError}
        </p>
      )}
    </div>
  )
}
