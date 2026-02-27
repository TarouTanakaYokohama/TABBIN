import { memo, useMemo } from 'react'
import type { CategoryGroupProps } from '@/types/saved-tabs'
import { CategoryGroupActions } from './category-group/CategoryGroupActions'
import { CategoryGroupCollapseButton } from './category-group/CategoryGroupCollapseButton'
import { CategoryGroupContent } from './category-group/CategoryGroupContent'
import { CategoryGroupHeader } from './category-group/CategoryGroupHeader'
import { CategoryGroupReorderControls } from './category-group/CategoryGroupReorderControls'
import { CategoryGroupRoot } from './category-group/CategoryGroupRoot'
import { CategoryGroupSortButton } from './category-group/CategoryGroupSortButton'
import { CategoryGroupTitle } from './category-group/CategoryGroupTitle'

/**
 * 親カテゴリグループコンポーネント
 * 複合コンポーネントパターンで構成される薄いラッパー
 * @param props CategoryGroupProps
 */
const CategoryGroupComponent = ({
  category,
  domains,
  handleOpenAllTabs,
  handleDeleteGroup,
  handleDeleteUrl,
  handleOpenTab,
  handleUpdateUrls,
  handleUpdateDomainsOrder,
  handleMoveDomainToCategory,
  handleDeleteCategory,
  settings,
  isCategoryReorderMode = false,
  searchQuery = '',
}: CategoryGroupProps) => {
  const handlers = useMemo(
    () => ({
      handleOpenAllTabs,
      handleDeleteGroup,
      handleDeleteUrl,
      handleOpenTab,
      handleUpdateUrls,
      handleUpdateDomainsOrder,
      handleMoveDomainToCategory,
      handleDeleteCategory,
    }),
    [
      handleOpenAllTabs,
      handleDeleteGroup,
      handleDeleteUrl,
      handleOpenTab,
      handleUpdateUrls,
      handleUpdateDomainsOrder,
      handleMoveDomainToCategory,
      handleDeleteCategory,
    ],
  )

  return (
    <CategoryGroupRoot
      category={category}
      domains={domains}
      settings={settings}
      isCategoryReorderMode={isCategoryReorderMode}
      searchQuery={searchQuery}
      handlers={handlers}
    >
      <CategoryGroupHeader>
        <div className='flex grow items-center gap-2'>
          <CategoryGroupCollapseButton />
          <CategoryGroupSortButton />
          <CategoryGroupTitle />
        </div>
        <CategoryGroupReorderControls />
        <CategoryGroupActions />
      </CategoryGroupHeader>
      <CategoryGroupContent />
    </CategoryGroupRoot>
  )
}

export const CategoryGroup = memo(CategoryGroupComponent)
