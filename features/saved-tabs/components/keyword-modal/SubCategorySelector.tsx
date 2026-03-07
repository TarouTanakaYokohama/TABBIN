import { Edit, Trash2 } from 'lucide-react'
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
import { useKeywordModal } from './KeywordModalContext'
import { SubCategoryDeleteConfirm } from './SubCategoryDeleteConfirm'
import { SubCategoryRenameForm } from './SubCategoryRenameForm'

/**
 * 既存の子カテゴリを選択・管理するセクション
 * セレクタ、リネーム、削除確認を含む
 */
export const SubCategorySelector = () => {
  const { state, group } = useKeywordModal()
  const { subcategory, rename, deletion } = state

  if (!group.subCategories || group.subCategories.length === 0) {
    return null
  }

  return (
    <div className='mb-4'>
      <div className='mb-2 flex items-center justify-between'>
        <Label htmlFor='category-select'>子カテゴリを選択</Label>

        <div className='flex gap-2'>
          {!rename.isRenaming && (
            <Tooltip>
              <TooltipTrigger asChild={true}>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={rename.handleStartRenaming}
                  className='flex cursor-pointer items-center gap-1 rounded px-2 py-1'
                  disabled={!subcategory.activeCategory}
                >
                  <Edit size={14} />
                  <SavedTabsResponsiveLabel>
                    子カテゴリ名を変更
                  </SavedTabsResponsiveLabel>
                </Button>
              </TooltipTrigger>
              <SavedTabsResponsiveTooltipContent side='top'>
                子カテゴリ名を変更
              </SavedTabsResponsiveTooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Button
                variant='secondary'
                size='sm'
                onClick={() => deletion.setShowDeleteConfirm(true)}
                className='flex cursor-pointer items-center gap-1 rounded px-2 py-1'
                disabled={!subcategory.activeCategory}
              >
                <Trash2 size={14} />
                <SavedTabsResponsiveLabel>
                  選択中の子カテゴリを削除
                </SavedTabsResponsiveLabel>
              </Button>
            </TooltipTrigger>
            <SavedTabsResponsiveTooltipContent side='top'>
              選択中の子カテゴリを削除
            </SavedTabsResponsiveTooltipContent>
          </Tooltip>
        </div>
      </div>

      <SubCategoryRenameForm />
      <SubCategoryDeleteConfirm />

      <Select
        value={subcategory.activeCategory}
        onValueChange={subcategory.setActiveCategory}
        disabled={rename.isRenaming}
      >
        <SelectTrigger className='w-full cursor-pointer rounded border p-2'>
          <SelectValue placeholder='管理する子カテゴリを選択' />
        </SelectTrigger>
        <SelectContent>
          {group.subCategories.map(cat => (
            <SelectItem key={cat} value={cat} className='cursor-pointer'>
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
