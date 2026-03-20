import { Input } from '@/components/ui/input'
import { useI18n } from '@/features/i18n/context/I18nProvider'
import { useKeywordModal } from './KeywordModalContext'

/**
 * 子カテゴリのリネームフォーム
 * リネームモード中のみ表示される
 */
export const SubCategoryRenameForm = () => {
  const { t } = useI18n()
  const { state } = useKeywordModal()
  const { subcategory, rename } = state

  if (!rename.isRenaming) {
    return null
  }

  return (
    <div className='mt-2 mb-3 rounded border p-3'>
      <div className='mb-2 text-gray-300 text-sm'>
        {t('savedTabs.subCategory.renamePrompt', undefined, {
          name: subcategory.activeCategory,
        })}
        <br />
        <span className='text-gray-400 text-xs'>
          {t('savedTabs.subCategory.renameHint')}
        </span>
      </div>
      <Input
        value={rename.newCategoryName}
        onChange={rename.handleRenameCategoryNameChange}
        placeholder={t('savedTabs.subCategory.addPlaceholder')}
        className={`w-full rounded border p-2 ${rename.categoryRenameError ? 'border-red-500' : ''}`}
        autoFocus={true}
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
