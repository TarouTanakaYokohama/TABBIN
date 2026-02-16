import { useDndMonitor } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo } from 'react'
import type { SortableDomainCardProps } from '@/types/saved-tabs'
import type { UserSettings } from '@/types/storage'
import { useDomainCardState } from '../../hooks/useDomainCardState'
import {
  DomainCardContext,
  type DomainCardContextType,
} from './DomainCardContext'

/** DomainCardRoot の props */
type DomainCardRootProps = {
  /** タブグループデータ */
  group: SortableDomainCardProps['group']
  /** 設定 */
  settings: UserSettings
  /** 親カテゴリID */
  categoryId?: string
  /** 並び替えモード */
  isReorderMode?: boolean
  /** 検索クエリ */
  searchQuery?: string
  /** 操作ハンドラ */
  handlers: DomainCardContextType['handlers']
  /** カテゴリ削除ハンドラ */
  handleDeleteCategory?: (groupId: string, categoryName: string) => void
  /** 子コンポーネント */
  children: React.ReactNode
}

/**
 * DomainCard の複合コンポーネントルート
 * コンテキスト + useSortable + useDomainCardState を提供する
 * @param props DomainCardRootProps
 */
export const DomainCardRoot = ({
  group,
  settings,
  categoryId,
  isReorderMode = false,
  searchQuery = '',
  handlers,
  handleDeleteCategory,
  children,
}: DomainCardRootProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: group.id })

  const state = useDomainCardState({
    group,
    handleUpdateUrls: handlers.handleUpdateUrls,
    handleDeleteCategory,
    isReorderMode,
  })

  // グローバルドラッグ監視
  useDndMonitor(state.dndMonitorHandlers)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // 検索でヒットしない場合は非表示
  const hasSearchQuery = searchQuery.trim().length > 0
  const totalUrls = group.urls?.length || 0

  const contextValue: DomainCardContextType = useMemo(
    () => ({
      state,
      group,
      settings,
      categoryId,
      isReorderMode,
      sortable: { attributes, listeners },
      handlers,
    }),
    [
      state,
      group,
      settings,
      categoryId,
      isReorderMode,
      attributes,
      listeners,
      handlers,
    ],
  )

  if (hasSearchQuery && totalUrls === 0) {
    return null
  }

  return (
    <DomainCardContext value={contextValue}>
      <div
        ref={setNodeRef}
        style={style}
        className='shadow-md'
        data-category-id={categoryId}
        data-urls-count={group.urls?.length || 0}
      >
        {children}
      </div>
    </DomainCardContext>
  )
}
