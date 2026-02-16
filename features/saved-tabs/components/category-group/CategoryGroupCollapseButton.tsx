import { CollapseToggle } from '../shared/CollapseToggle'
import { useCategoryGroup } from './CategoryGroupContext'

/**
 * CategoryGroup の折りたたみ切り替えボタン
 * 親カテゴリ並び替えモード中は無効化される
 */
export const CategoryGroupCollapseButton = () => {
  const { state, isCategoryReorderMode } = useCategoryGroup()
  const { collapse } = state

  return (
    <CollapseToggle
      isCollapsed={collapse.isCollapsed}
      setIsCollapsed={collapse.setIsCollapsed}
      setUserCollapsedState={collapse.setUserCollapsedState}
      isDisabled={isCategoryReorderMode}
      disabledMessage='親カテゴリ並び替えモード中'
    />
  )
}
