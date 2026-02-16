import { CollapseToggle } from '../shared/CollapseToggle'
import { useDomainCard } from './DomainCardContext'

/**
 * DomainCard の折りたたみ切り替えボタン
 * 並び替えモード中は無効化される
 */
export const DomainCardCollapseButton = () => {
  const { state, isReorderMode } = useDomainCard()
  const { collapse } = state

  return (
    <CollapseToggle
      isCollapsed={collapse.isCollapsed}
      setIsCollapsed={collapse.setIsCollapsed}
      setUserCollapsedState={collapse.setUserCollapsedState}
      isDisabled={isReorderMode}
      disabledMessage='並び替えモード中'
    />
  )
}
