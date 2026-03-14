import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from '../shared/SavedTabsResponsive'
import { CategoryDeleteConfirm } from './CategoryDeleteConfirm'
import { useCategoryModalContext } from './CategoryModalContext'

/**
 * カテゴリ選択セクション
 * セレクタと削除確認UIを含む
 */
export const CategorySelector = () => {
  const { state } = useCategoryModalContext()
  const { selection, deletion, isLoading } = state

  if (selection.categories.length === 0) {
    return null
  }

  return (
    <div>
      <div className='mb-2 flex items-center justify-between'>
        <Label htmlFor='categorySelect'>親カテゴリ選択</Label>
        {selection.categories.length > 0 &&
          selection.selectedCategoryId &&
          selection.selectedCategoryId !== 'uncategorized' && (
            <Tooltip>
              <TooltipTrigger asChild={true}>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={deletion.handleDeleteClick}
                  disabled={isLoading}
                  className='cursor-pointer'
                >
                  <Trash2 size={16} />
                  <SavedTabsResponsiveLabel>
                    選択中の親カテゴリを削除
                  </SavedTabsResponsiveLabel>
                </Button>
              </TooltipTrigger>
              <SavedTabsResponsiveTooltipContent side='top'>
                選択中の親カテゴリを削除
              </SavedTabsResponsiveTooltipContent>
            </Tooltip>
          )}
      </div>
      <Select
        value={selection.selectedCategoryId || ''}
        onValueChange={selection.handleCategoryChange}
      >
        <SelectTrigger className='w-full' id='categorySelect'>
          <SelectValue placeholder='作成済みのカテゴリを選択してドメインを管理' />
        </SelectTrigger>
        <SelectContent>
          {selection.categories.map(category => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <CategoryDeleteConfirm />
    </div>
  )
}
