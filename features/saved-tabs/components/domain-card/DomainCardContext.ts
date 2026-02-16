import type { useSortable } from '@dnd-kit/sortable'
import { createCompoundContext } from '@/lib/ui/createCompoundContext'
import type { SortableDomainCardProps } from '@/types/saved-tabs'
import type { UserSettings } from '@/types/storage'
import type { useDomainCardState } from '../../hooks/useDomainCardState'

/** DomainCard のコンテキスト型 */
export type DomainCardContextType = {
  /** フック戻り値 */
  state: ReturnType<typeof useDomainCardState>
  /** タブグループデータ */
  group: SortableDomainCardProps['group']
  /** 設定 */
  settings: UserSettings
  /** 親カテゴリID */
  categoryId?: string
  /** 並び替えモード状態 */
  isReorderMode: boolean
  /** ソート可能な属性・リスナー */
  sortable: Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>
  /** 操作ハンドラ */
  handlers: {
    handleOpenAllTabs: SortableDomainCardProps['handleOpenAllTabs']
    handleDeleteGroup: SortableDomainCardProps['handleDeleteGroup']
    handleDeleteUrl: SortableDomainCardProps['handleDeleteUrl']
    handleOpenTab: SortableDomainCardProps['handleOpenTab']
    handleUpdateUrls: SortableDomainCardProps['handleUpdateUrls']
  }
}

export const { Context: DomainCardContext, useCompoundContext: useDomainCard } =
  createCompoundContext<DomainCardContextType>('DomainCard')
