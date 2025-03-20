import type { TabGroup } from '@/utils/storage'
import { handleTabGroupRemoval } from '@/utils/tab-operations'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { SortableDomainCard } from '../components/SortableDomainCard'

// SavedTabsContainer コンポーネントの定義
export const SavedTabsContainer: React.FC<{ settings: UserSettings }> = ({
  settings,
}) => {
  // タブグループの状態を管理
  const [savedTabs, setSavedTabs] = useState<TabGroup[]>([])
  const [loading, setLoading] = useState(true)

  // 初期データの読み込み
  useEffect(() => {
    const loadSavedTabs = async () => {
      try {
        const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
        setSavedTabs(savedTabs)
      } catch (error) {
        console.error('タブ読み込みエラー:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSavedTabs()
  }, [])

  // タブグループ削除のハンドラ関数
  const handleDeleteGroup = useCallback(async (groupId: string) => {
    try {
      // 削除前にグループ情報を保存（tab-operations.tsから処理をインポート）
      await handleTabGroupRemoval(groupId)

      // 状態を更新
      setSavedTabs(prev => prev.filter(group => group.id !== groupId))

      // ストレージも更新
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
      const updatedTabs = savedTabs.filter(
        (tab: TabGroup) => tab.id !== groupId,
      )
      await chrome.storage.local.set({ savedTabs: updatedTabs })

      console.log('タブグループを削除しました:', groupId)
    } catch (error) {
      console.error('タブグループ削除エラー:', error)
    }
  }, [])

  // タブ更新処理をより安定化
  const handleUpdateUrls = useCallback(
    async (groupId: string, updatedUrls: TabGroup['urls']) => {
      try {
        // まず保存処理を実行
        const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
        const updatedGroups = savedTabs.map((group: TabGroup) => {
          if (group.id === groupId) {
            return { ...group, urls: updatedUrls }
          }
          return group
        })

        // 空になったグループがあれば削除
        const finalGroups = updatedGroups.filter(
          (group: TabGroup) => group.urls.length > 0,
        )

        // 変更があれば保存
        if (finalGroups.length !== savedTabs.length) {
          console.log(
            '空グループを自動削除:',
            savedTabs.length - finalGroups.length,
          )
        }

        // ストレージ更新
        await chrome.storage.local.set({ savedTabs: finalGroups })

        // 最後に状態更新（これにより再レンダリングが1回だけになる）
        setSavedTabs(finalGroups)

        return true
      } catch (error) {
        console.error('URL更新エラー:', error)
        return false
      }
    },
    [],
  )

  // URLを削除する関数
  const handleDeleteUrl = useCallback(
    async (groupId: string, url: string) => {
      try {
        const group = savedTabs.find(g => g.id === groupId)
        if (!group) return

        // 削除対象のURL以外のURLを残す
        const updatedUrls = group.urls.filter(item => item.url !== url)

        // グループ内のURLが空になる場合はグループごと削除
        if (updatedUrls.length === 0) {
          await handleDeleteGroup(groupId)
          return
        }

        // URLsを更新
        await handleUpdateUrls(groupId, updatedUrls)
      } catch (error) {
        console.error('URL削除エラー:', error)
      }
    },
    [savedTabs, handleUpdateUrls, handleDeleteGroup],
  )

  // タブを開く関数
  const handleOpenTab = useCallback(async (url: string) => {
    try {
      await chrome.tabs.create({ url, active: true })
    } catch (error) {
      console.error('タブを開く際にエラーが発生しました:', error)
    }
  }, [])

  // 複数タブを開く関数
  const handleOpenAllTabs = useCallback(
    async (urls: { url: string; title: string }[]) => {
      try {
        for (const item of urls) {
          await chrome.tabs.create({ url: item.url, active: false })
        }
      } catch (error) {
        console.error('複数タブを開く際にエラーが発生しました:', error)
      }
    },
    [],
  )

  // カテゴリを削除する関数
  const handleDeleteCategory = useCallback(
    async (groupId: string, categoryName: string) => {
      try {
        const group = savedTabs.find(g => g.id === groupId)
        if (!group) return

        // 該当するカテゴリを持つURLのカテゴリをundefinedに変更
        const updatedUrls = group.urls.map(item => {
          if (item.subCategory === categoryName) {
            return { ...item, subCategory: undefined }
          }
          return item
        })

        // サブカテゴリリストから削除
        const updatedSubCategories = (group.subCategories || []).filter(
          cat => cat !== categoryName,
        )

        // カテゴリキーワードからも削除
        const updatedKeywords = (group.categoryKeywords || []).filter(
          kw => kw.categoryName !== categoryName,
        )

        // グループの更新
        const updatedGroup = {
          ...group,
          urls: updatedUrls,
          subCategories: updatedSubCategories,
          categoryKeywords: updatedKeywords,
          // カテゴリ順序からも削除
          subCategoryOrder: (group.subCategoryOrder || []).filter(
            id => id !== categoryName,
          ),
          subCategoryOrderWithUncategorized: (
            group.subCategoryOrderWithUncategorized || []
          ).filter(id => id !== categoryName),
        }

        // 状態とストレージを更新
        const newSavedTabs = savedTabs.map(g =>
          g.id === groupId ? updatedGroup : g,
        )

        setSavedTabs(newSavedTabs)
        await chrome.storage.local.set({ savedTabs: newSavedTabs })
      } catch (error) {
        console.error('カテゴリ削除エラー:', error)
      }
    },
    [savedTabs],
  )

  // ローディング表示
  if (loading) {
    return <div className='p-4 text-center'>読み込み中...</div>
  }

  // タブが1つもない場合
  if (savedTabs.length === 0) {
    return <div className='p-4 text-center'>保存されたタブがありません</div>
  }

  // コンテンツ表示
  return (
    <div className='space-y-4 p-4'>
      {savedTabs.map(group => (
        <SortableDomainCard
          key={group.id}
          group={group}
          handleDeleteGroup={handleDeleteGroup}
          handleDeleteUrl={handleDeleteUrl}
          handleOpenTab={handleOpenTab}
          handleOpenAllTabs={handleOpenAllTabs}
          handleUpdateUrls={handleUpdateUrls}
          handleDeleteCategory={handleDeleteCategory}
          settings={settings}
          isDraggingOver={false}
          categoryId={group.parentCategoryId}
        />
      ))}
    </div>
  )
}
