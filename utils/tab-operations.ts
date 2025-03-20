import type { TabGroup } from './storage'
import { updateDomainCategorySettings } from './storage'

/**
 * タブグループ削除前の処理関数
 * グループのカテゴリ設定を保存します
 *
 * @param groupId 削除対象のグループID
 */
export async function handleTabGroupRemoval(groupId: string): Promise<void> {
  try {
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
    const groupToDelete = savedTabs.find(
      (group: TabGroup) => group.id === groupId,
    )

    if (groupToDelete) {
      // 子カテゴリ設定を保存
      await updateDomainCategorySettings(
        groupToDelete.domain,
        groupToDelete.subCategories || [],
        groupToDelete.categoryKeywords || [],
      )
    }
  } catch (error) {
    console.error('タブグループ削除前処理エラー:', error)
  }
}
