import { SortOrderToggle } from '../shared/SortOrderToggle'
import { useCategoryGroup } from './CategoryGroupContext'

/**
 * CategoryGroup のソート順切り替えボタン
 * default → asc → desc のサイクルで切り替わる
 */
export const CategoryGroupSortButton = () => {
  const { state } = useCategoryGroup()
  const { sort } = state

  return (
    <SortOrderToggle
      sortOrder={sort.sortOrder}
      setSortOrder={sort.setSortOrder}
    />
  )
}
