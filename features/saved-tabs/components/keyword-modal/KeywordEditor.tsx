import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useKeywordModal } from './KeywordModalContext'

/**
 * キーワード設定セクション
 * キーワードの追加・削除を行う
 */
export const KeywordEditor = () => {
  const { state, group } = useKeywordModal()
  const { subcategory, keywords: keywordsState, rename } = state

  if (!group.subCategories || group.subCategories.length === 0) {
    return null
  }

  return (
    <div className='mb-4'>
      <Label htmlFor='keyword-input' className='block text-gray-400 text-sm'>
        「{subcategory.activeCategory}」子カテゴリのキーワード
      </Label>
      <span className='mb-1 text-gray-500 text-xs'>
        タイトルにキーワードが含まれていると自動的にこの子カテゴリに分類されます
      </span>

      <div className='my-2 flex'>
        <Input
          id='keyword-input'
          value={keywordsState.newKeyword}
          onChange={e => keywordsState.setNewKeyword(e.target.value)}
          placeholder='例: 技術、新機能、チュートリアル'
          className='flex-grow rounded border p-2'
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              keywordsState.handleAddKeyword()
            }
          }}
          onBlur={() => {
            if (keywordsState.newKeyword.trim()) {
              keywordsState.handleAddKeyword()
            }
          }}
          disabled={rename.isRenaming}
        />
      </div>

      <div className='flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded border p-2'>
        {keywordsState.keywords.length === 0 ? (
          <p className='text-gray-500'>キーワードがありません</p>
        ) : (
          keywordsState.keywords.map(keyword => (
            <Badge
              key={keyword}
              variant='outline'
              className='flex items-center gap-1 rounded px-2 py-1'
            >
              {keyword}
              <Button
                variant='ghost'
                size='sm'
                onClick={() => keywordsState.handleRemoveKeyword(keyword)}
                className='ml-1 cursor-pointer text-gray-400 hover:text-gray-200'
                aria-label='キーワードを削除'
                disabled={rename.isRenaming}
              >
                <X size={14} />
              </Button>
            </Badge>
          ))
        )}
      </div>
    </div>
  )
}
