import { memo, useMemo } from 'react'
import type { SortableDomainCardProps } from '@/types/saved-tabs'
import type { UserSettings } from '@/types/storage'
import { DomainCardActions } from './domain-card/DomainCardActions'
import { DomainCardCollapseButton } from './domain-card/DomainCardCollapseButton'
import { DomainCardContent } from './domain-card/DomainCardContent'
import { DomainCardHeader } from './domain-card/DomainCardHeader'
import { DomainCardReorderControls } from './domain-card/DomainCardReorderControls'
import { DomainCardRoot } from './domain-card/DomainCardRoot'
import { DomainCardSortButton } from './domain-card/DomainCardSortButton'
import { DomainCardTitle } from './domain-card/DomainCardTitle'

/**
 * ドメインごとのタブグループを表示するソート可能なカードコンポーネント
 * 複合コンポーネントパターンで構成される薄いラッパー
 * @param props SortableDomainCardProps & { settings: UserSettings }
 */
const SortableDomainCardComponent = ({
  group,
  handleOpenAllTabs,
  handleDeleteGroup,
  handleDeleteUrl,
  handleOpenTab,
  handleUpdateUrls,
  handleDeleteCategory,
  categoryId,
  isDraggingOver: _isDraggingOver,
  settings,
  isReorderMode = false,
  searchQuery = '',
}: SortableDomainCardProps & { settings: UserSettings }) => {
  const handlers = useMemo(
    () => ({
      handleOpenAllTabs,
      handleDeleteGroup,
      handleDeleteUrl,
      handleOpenTab,
      handleUpdateUrls,
    }),
    [
      handleOpenAllTabs,
      handleDeleteGroup,
      handleDeleteUrl,
      handleOpenTab,
      handleUpdateUrls,
    ],
  )

  return (
    <DomainCardRoot
      group={group}
      settings={settings}
      categoryId={categoryId}
      isReorderMode={isReorderMode}
      searchQuery={searchQuery}
      handlers={handlers}
      handleDeleteCategory={handleDeleteCategory}
    >
      <DomainCardHeader>
        <DomainCardCollapseButton />
        <DomainCardSortButton />
        <DomainCardTitle />
        <DomainCardReorderControls />
        <DomainCardActions />
      </DomainCardHeader>
      <DomainCardContent />
    </DomainCardRoot>
  )
}

export const SortableDomainCard = memo(SortableDomainCardComponent)
