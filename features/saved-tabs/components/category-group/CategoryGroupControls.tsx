import { CardCollapseControl } from '../shared/CardCollapseControl'
import { CardReorderControls } from '../shared/CardReorderControls'
import { CardSortControl } from '../shared/CardSortControl'
import { useCategoryGroup } from './CategoryGroupContext'

/** CategoryGroup の折りたたみ切り替えボタン */
export const CategoryGroupCollapseControl = () => {
  const { state, isCategoryReorderMode } = useCategoryGroup()
  const { collapse } = state

  return (
    <CardCollapseControl
      isCollapsed={collapse.isCollapsed}
      setIsCollapsed={collapse.setIsCollapsed}
      setUserCollapsedState={collapse.setUserCollapsedState}
      isDisabled={isCategoryReorderMode}
      disabledMessage='親カテゴリ並び替えモード中'
    />
  )
}

/** CategoryGroup のソート順切り替えボタン */
export const CategoryGroupSortControl = () => {
  const { state } = useCategoryGroup()
  const { sort } = state

  return (
    <CardSortControl
      sortOrder={sort.sortOrder}
      setSortOrder={sort.setSortOrder}
    />
  )
}

/** CategoryGroup のドメイン並び替え確定・キャンセルボタン */
export const CategoryGroupReorderControl = () => {
  const { state } = useCategoryGroup()
  const { reorder } = state

  return (
    <CardReorderControls
      isReorderMode={reorder.isReorderMode}
      onCancel={reorder.handleCancelReorder}
      onConfirm={reorder.handleConfirmReorder}
      className='pointer-events-auto ml-2 gap-2'
    />
  )
}
