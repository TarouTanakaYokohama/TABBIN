import { SortOrderToggle } from '../shared/SortOrderToggle'
import { useDomainCard } from './DomainCardContext'

/**
 * DomainCard のソート順切り替えボタン
 * default → asc → desc のサイクルで切り替わる
 */
export const DomainCardSortButton = () => {
  const { state } = useDomainCard()
  const { sort } = state

  return (
    <SortOrderToggle
      sortOrder={sort.sortOrder}
      setSortOrder={sort.setSortOrder}
    />
  )
}
