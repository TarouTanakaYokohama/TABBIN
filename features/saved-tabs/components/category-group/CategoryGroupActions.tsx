import { CardGroupActions } from '../shared/CardGroupActions'
import { useCategoryGroup } from './CategoryGroupContext'

/**
 * CategoryGroup の操作ボタン群
 * 親カテゴリ管理、すべて開く、すべて削除を含む
 */
export const CategoryGroupActions = () => {
  const { state, category, domains, settings, handlers } = useCategoryGroup()
  const { modal, reorder } = state

  const domainsToUse = reorder.isReorderMode ? reorder.tempDomainOrder : domains
  const urlsToOpen = domainsToUse.flatMap(group => group.urls || [])

  /** カテゴリ内の全ドメインを削除する処理（確認済みの場合） */
  const executeDeleteAll = async () => {
    const domainsToDelete = reorder.isReorderMode
      ? reorder.tempDomainOrder
      : domains

    if (handlers.handleDeleteGroups) {
      await handlers.handleDeleteGroups(domainsToDelete.map(d => d.id))
    } else {
      for (const { id } of domainsToDelete) {
        await handlers.handleDeleteGroup(id)
      }
    }
    if (reorder.isReorderMode) {
      console.log(
        `並び替えモード中にカテゴリ ${category.name} のすべてのドメインを削除しました`,
      )
    }
  }

  const handleOpenAll = () => {
    handlers.handleOpenAllTabs(urlsToOpen)
    if (reorder.isReorderMode) {
      console.log(
        `並び替えモード中にカテゴリ ${category.name} のタブをすべて開きました`,
      )
    }
  }

  return (
    <CardGroupActions
      onManage={() => modal.setIsModalOpen(true)}
      manageLabel='親カテゴリ管理'
      onOpenAll={urlsToOpen.length > 0 ? handleOpenAll : undefined}
      onDeleteAll={domainsToUse.length > 0 ? executeDeleteAll : undefined}
      onConfirmOpenAll={urlsToOpen.length >= 10}
      onConfirmDeleteAll={settings.confirmDeleteAll}
      openAllThreshold={10}
      itemName='すべてのドメイン'
      warningMessage='カテゴリ内のすべてのドメインを削除します。この操作は元に戻せません。'
    />
  )
}
