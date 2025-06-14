import {
  getParentCategories,
  saveParentCategories,
  updateDomainCategoryMapping,
  updateDomainCategorySettings,
} from '@/lib/storage'
import type { TabGroup } from '@/types/storage'

/**
 * タブグループ削除前の処理関数
 * グループのカテゴリ設定を保存します
 *
 * @param groupId 削除対象のグループID
 */
export async function handleTabGroupRemoval(groupId: string): Promise<void> {
  try {
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
    const groupToRemove = savedTabs.find(
      (group: TabGroup) => group.id === groupId,
    )
    if (groupToRemove?.domain) {
      console.log(`グループ削除前の処理: ${groupToRemove.domain}`)

      // カテゴリ設定を永続化
      await updateDomainCategorySettings(
        groupToRemove.domain,
        groupToRemove.subCategories || [],
        groupToRemove.categoryKeywords || [],
      )

      // 親カテゴリにドメイン名を確実に保持させる
      if (groupToRemove.parentCategoryId) {
        const parentCategories = await getParentCategories()
        const parentCategory = parentCategories.find(
          cat => cat.id === groupToRemove.parentCategoryId,
        )

        if (parentCategory) {
          // domainNamesが存在し、このドメイン名を含んでいるか確認
          const hasDomainName = parentCategory.domainNames?.includes(
            groupToRemove.domain,
          )

          if (!hasDomainName) {
            // ドメイン名を追加
            const updatedCategory = {
              ...parentCategory,
              domainNames: [
                ...(parentCategory.domainNames || []),
                groupToRemove.domain,
              ],
            }

            // 親カテゴリを更新
            await saveParentCategories(
              parentCategories.map(cat =>
                cat.id === groupToRemove.parentCategoryId
                  ? updatedCategory
                  : cat,
              ),
            )
            console.log(
              `ドメイン ${groupToRemove.domain} を親カテゴリのdomainNamesに追加しました`,
            )
          }
        }
      }

      // ドメイン-カテゴリマッピングも保持
      if (groupToRemove.parentCategoryId) {
        await updateDomainCategoryMapping(
          groupToRemove.domain,
          groupToRemove.parentCategoryId,
        )
        console.log(
          `ドメイン ${groupToRemove.domain} のマッピングを更新しました`,
        )
      }
    }
  } catch (error) {
    console.error('タブグループ削除前処理エラー:', error)
  }
}

/**
 * カテゴリ内のタブ削除を安全に処理する関数
 *
 * @param groupId グループID
 * @param urls 更新後のURL一覧
 * @param callback 成功時のコールバック
 */
export async function safelyUpdateGroupUrls(
  groupId: string,
  urls: TabGroup['urls'],
  callback?: () => void,
): Promise<void> {
  try {
    // ローカルストレージからタブを取得
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

    // 対象グループを特定
    const targetGroup = savedTabs.find((tab: TabGroup) => tab.id === groupId)
    if (!targetGroup) {
      console.log(`グループID ${groupId} が見つかりません`)
      if (callback) {
        Promise.resolve().then(callback)
      }
      return Promise.resolve()
    }

    // グループ内のURLが空になる場合でも、グループ自体は維持（表示はしない）
    const updatedTabs = savedTabs.map((tab: TabGroup) => {
      if (tab.id === groupId) {
        return { ...tab, urls }
      }
      return tab
    })

    // 更新を保存
    await chrome.storage.local.set({ savedTabs: updatedTabs })

    // URLsが空の場合はコンソールにその旨を出力
    if (urls.length === 0) {
      console.log(
        `グループ ${groupId} (${targetGroup.domain}) のURLがすべて削除されました。表示から除外されます。`,
      )
      try {
        chrome.runtime
          .sendMessage({
            action: 'groupEmptied',
            groupId,
          })
          .catch(() => {
            // エラーは無視（拡張がアクティブでない場合など）
          })
      } catch (_e) {
        // メッセージ送信エラーは無視
      }
    } else {
      console.log(
        `グループ ${groupId} のURLを更新しました。残り: ${urls.length}件`,
      )
    }

    // 成功時にコールバックを実行 - 非同期で実行
    if (callback) {
      setTimeout(() => {
        Promise.resolve().then(callback)
      }, 0)
    }

    return Promise.resolve()
  } catch (error) {
    console.error('タブ更新エラー:', error)
    return Promise.reject(error)
  }
}
