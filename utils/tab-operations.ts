import type { TabGroup } from './storage'
import { updateDomainCategorySettings } from './storage'

interface ParentCategory {
  id: string
  domainNames?: string[]
  // 他の必要なプロパティがあれば追加
}

interface DomainCategoryMapping {
  domain: string
  categoryId: string
}

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
      console.log(`タブグループ削除前の処理: ${groupToDelete.domain}`)

      // 子カテゴリ設定を保存
      await updateDomainCategorySettings(
        groupToDelete.domain,
        groupToDelete.subCategories || [],
        groupToDelete.categoryKeywords || [],
      )

      // 親カテゴリにドメイン名を確実に保持させる
      if (groupToDelete.parentCategoryId) {
        const parentCategories =
          await chrome.storage.local.get('parentCategories')
        const categories = parentCategories.parentCategories || []
        const parentCategory = categories.find(
          (cat: ParentCategory) => cat.id === groupToDelete.parentCategoryId,
        )

        if (parentCategory) {
          // domainNamesが存在し、このドメイン名を含んでいるか確認
          const hasDomainName = parentCategory.domainNames?.includes(
            groupToDelete.domain,
          )

          if (!hasDomainName) {
            // ドメイン名を追加
            const updatedCategory = {
              ...parentCategory,
              domainNames: [
                ...(parentCategory.domainNames || []),
                groupToDelete.domain,
              ],
            }

            // 親カテゴリを更新
            await chrome.storage.local.set({
              parentCategories: categories.map((cat: ParentCategory) =>
                cat.id === groupToDelete.parentCategoryId
                  ? updatedCategory
                  : cat,
              ),
            })
            console.log(
              `ドメイン ${groupToDelete.domain} を親カテゴリのdomainNamesに追加しました`,
            )
          }
        }
      }

      // ドメイン-カテゴリマッピングも保持
      if (groupToDelete.parentCategoryId) {
        const mappings = await chrome.storage.local.get(
          'domainCategoryMappings',
        )
        const domainCategoryMappings = mappings.domainCategoryMappings || []

        // 既存のマッピングを探す
        const existingIndex = domainCategoryMappings.findIndex(
          (m: DomainCategoryMapping) => m.domain === groupToDelete.domain,
        )

        if (existingIndex >= 0) {
          // 既存のマッピングを更新
          domainCategoryMappings[existingIndex].categoryId =
            groupToDelete.parentCategoryId
        } else {
          // 新しいマッピングを追加
          domainCategoryMappings.push({
            domain: groupToDelete.domain,
            categoryId: groupToDelete.parentCategoryId,
          })
        }

        await chrome.storage.local.set({ domainCategoryMappings })
        console.log(
          `ドメイン ${groupToDelete.domain} のマッピングを更新しました`,
        )
      }
    }
  } catch (error) {
    console.error('タブグループの削除処理中にエラーが発生:', error)
  }
}
