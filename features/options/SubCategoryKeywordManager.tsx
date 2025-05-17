import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'

export const SubCategoryKeywordManager = ({
  tabGroup,
}: { tabGroup: TabGroup }) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [newSubCategory, setNewSubCategory] = useState('')

  // リネームモード用の状態を追加
  const [isRenamingSubCategory, setIsRenamingSubCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // タブグループを更新するヘルパー関数
  const updateTabGroup = async (updatedTabGroup: TabGroup) => {
    try {
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
      const updatedTabs = savedTabs.map((tab: TabGroup) =>
        tab.id === updatedTabGroup.id ? updatedTabGroup : tab,
      )
      await chrome.storage.local.set({ savedTabs: updatedTabs })
      return true
    } catch (error) {
      console.error('タブグループ更新エラー:', error)
      return false
    }
  }

  const handleCategorySelect = (categoryName: string) => {
    // リネームモード中なら終了
    if (isRenamingSubCategory) {
      setIsRenamingSubCategory(false)
    }
    setActiveCategory(categoryName)
    const categoryKeywords = tabGroup.categoryKeywords?.find(
      ck => ck.categoryName === categoryName,
    )
    setKeywords(categoryKeywords?.keywords || [])
  }

  // キーワード追加関数に重複チェックを追加
  const handleAddKeyword = () => {
    if (newKeyword.trim() && activeCategory) {
      // 重複チェックを追加
      if (
        keywords.some(
          keyword => keyword.toLowerCase() === newKeyword.trim().toLowerCase(),
        )
      ) {
        alert('このキーワードは既に追加されています')
        return
      }

      const updatedKeywords = [...keywords, newKeyword.trim()]
      setKeywords(updatedKeywords)
      setCategoryKeywords(tabGroup.id, activeCategory, updatedKeywords)
        .then(() => setNewKeyword(''))
        .catch(err => console.error('キーワード保存エラー:', err))
    }
  }

  // キーワードを削除した時に自動保存する処理を修正
  const handleRemoveKeyword = async (keywordToRemove: string) => {
    if (activeCategory) {
      try {
        // キーワードをフィルタリング
        const updatedKeywords = keywords.filter(k => k !== keywordToRemove)

        // UI状態を先に更新
        setKeywords(updatedKeywords)

        // ストレージに保存
        await setCategoryKeywords(tabGroup.id, activeCategory, updatedKeywords)

        console.log(`キーワード "${keywordToRemove}" を削除しました`)
      } catch (error) {
        console.error('キーワード削除エラー:', error)

        // エラー時はキーワードリストを再取得して状態を元に戻す
        const categoryKeywords = tabGroup.categoryKeywords?.find(
          ck => ck.categoryName === activeCategory,
        )
        setKeywords(categoryKeywords?.keywords || [])

        // エラーを表示
        alert('キーワードの削除に失敗しました。再度お試しください。')
      }
    }
  }

  // 新しい子カテゴリを追加
  const handleAddSubCategory = async () => {
    if (newSubCategory.trim()) {
      const categoryName = newSubCategory.trim()

      // 既存の子カテゴリと重複していないか確認
      if (tabGroup.subCategories?.includes(categoryName)) {
        alert('この子カテゴリは既に存在します')
        return
      }

      // 子カテゴリを追加
      const updatedTabGroup = {
        ...tabGroup,
        subCategories: [...(tabGroup.subCategories || []), categoryName],
        categoryKeywords: [
          ...(tabGroup.categoryKeywords || []),
          { categoryName, keywords: [] },
        ],
      }

      const success = await updateTabGroup(updatedTabGroup)
      if (success) {
        setNewSubCategory('')
        setActiveCategory(categoryName) // 新しいカテゴリを選択状態に
        setKeywords([])
      }
    }
  }

  // 子カテゴリ削除関数を完全に書き換え - saved-tabs/main.tsxのパターンに基づく
  const handleRemoveSubCategory = async (categoryToRemove: string) => {
    console.log(`子カテゴリの削除を開始: "${categoryToRemove}"`)

    try {
      // 確認ダイアログを一時的にスキップ (問題特定のため)
      // if (confirm(`子カテゴリ "${categoryToRemove}" を削除してもよろしいですか？`)) {

      // 選択中のカテゴリを削除する場合は選択を解除
      if (activeCategory === categoryToRemove) {
        setActiveCategory(null)
        setKeywords([])
      }

      // saved-tabs/main.tsxのパターンに基づく直接的な実装
      console.log('削除するカテゴリ:', categoryToRemove)
      console.log('タブグループID:', tabGroup.id)

      // タブの情報を取得
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
      console.log('取得したsavedTabs:', savedTabs)

      // 対象のタブグループを探す
      const groupToUpdate = savedTabs.find(
        (g: TabGroup) => g.id === tabGroup.id,
      )
      console.log('更新対象のグループ:', groupToUpdate)

      if (!groupToUpdate) {
        console.error('タブグループが見つかりません')
        return
      }

      // 子カテゴリリストと関連キーワードからカテゴリを削除
      const updatedSubCategories = (groupToUpdate.subCategories || []).filter(
        (cat: string) => cat !== categoryToRemove,
      )

      const updatedCategoryKeywords = (
        groupToUpdate.categoryKeywords || []
      ).filter(
        (ck: { categoryName: string }) => ck.categoryName !== categoryToRemove,
      )

      console.log('更新後のサブカテゴリ:', updatedSubCategories)
      console.log('更新後のキーワード設定:', updatedCategoryKeywords)

      // グループを更新
      const updatedGroup = {
        ...groupToUpdate,
        subCategories: updatedSubCategories,
        categoryKeywords: updatedCategoryKeywords,
      }

      // 保存
      const updatedTabs = savedTabs.map((g: TabGroup) =>
        g.id === tabGroup.id ? updatedGroup : g,
      )

      // ストレージに保存
      await chrome.storage.local.set({ savedTabs: updatedTabs })
      console.log('ストレージに保存完了')

      alert(`カテゴリ "${categoryToRemove}" を削除しました`)
      // }
    } catch (error) {
      console.error('子カテゴリ削除エラー:', error)
      alert(`カテゴリの削除中にエラーが発生しました: ${error}`)
    }
  }

  // リネームモードを開始する関数
  const startRenameMode = () => {
    if (!activeCategory) return

    setIsRenamingSubCategory(true)
    setNewCategoryName(activeCategory)

    // 入力フィールドにフォーカスを当てる（遅延実行）
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus()
        renameInputRef.current.select()
      }
    }, 50)
  }

  // リネームを完了する関数
  const completeRename = async () => {
    if (!isRenamingSubCategory || !activeCategory || !newCategoryName.trim()) {
      setIsRenamingSubCategory(false)
      return
    }

    // 名前が変わっていない場合は何もしない
    if (newCategoryName.trim() === activeCategory) {
      setIsRenamingSubCategory(false)
      return
    }

    // 既存のカテゴリ名と重複していないか確認
    if (tabGroup.subCategories?.includes(newCategoryName.trim())) {
      alert('このカテゴリ名は既に存在しています')
      setNewCategoryName(activeCategory) // 元の名前に戻す
      return
    }

    try {
      await handleRenameCategory(activeCategory, newCategoryName.trim())

      // リネームが成功したら、アクティブカテゴリを新しい名前に更新
      setActiveCategory(newCategoryName.trim())
      setIsRenamingSubCategory(false)
    } catch (error) {
      console.error('カテゴリ名変更エラー:', error)
      alert('カテゴリ名の変更に失敗しました')
    }
  }

  // カテゴリ名変更の処理関数
  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!oldName || !newName || oldName === newName) return

    console.log(`カテゴリ名を変更: ${oldName} → ${newName}`)

    // ストレージからタブグループを取得
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

    const updatedTabs = savedTabs.map((tab: TabGroup) => {
      if (tab.id === tabGroup.id) {
        // 1. subCategories配列を更新
        const updatedSubCategories =
          tab.subCategories?.map(cat => (cat === oldName ? newName : cat)) || []

        // 2. categoryKeywords内の該当カテゴリを更新
        const updatedCategoryKeywords =
          tab.categoryKeywords?.map(ck => {
            if (ck.categoryName === oldName) {
              return { ...ck, categoryName: newName }
            }
            return ck
          }) || []

        // 3. 各URLのサブカテゴリ参照を更新
        const updatedUrls = tab.urls.map(url => {
          if (url.subCategory === oldName) {
            return { ...url, subCategory: newName }
          }
          return url
        })

        // 4. カテゴリ順序配列があれば更新
        const updatedSubCategoryOrder =
          tab.subCategoryOrder?.map(cat => (cat === oldName ? newName : cat)) ||
          []

        const updatedSubCategoryOrderWithUncategorized =
          tab.subCategoryOrderWithUncategorized?.map(cat =>
            cat === oldName ? newName : cat,
          ) || []

        return {
          ...tab,
          subCategories: updatedSubCategories,
          categoryKeywords: updatedCategoryKeywords,
          urls: updatedUrls,
          subCategoryOrder: updatedSubCategoryOrder,
          subCategoryOrderWithUncategorized:
            updatedSubCategoryOrderWithUncategorized,
        }
      }
      return tab
    })

    // 更新したタブをストレージに保存
    await chrome.storage.local.set({ savedTabs: updatedTabs })
    console.log(`カテゴリ名の変更を完了: ${oldName} → ${newName}`)
  }

  // キャンセル時の処理
  const cancelRename = () => {
    setIsRenamingSubCategory(false)
    setNewCategoryName(activeCategory || '')
  }

  if (!tabGroup.subCategories || tabGroup.subCategories.length === 0) {
    return (
      <div className='mt-4 border-border border-t pt-4'>
        <p className='mb-3 text-muted-foreground'>
          このドメインには子カテゴリがありません。
        </p>
        <div className='mb-4'>
          <Label
            htmlFor='new-subcategory'
            className='mb-1 block font-medium text-foreground text-sm'
          >
            新しい子カテゴリを追加
          </Label>
          <Input
            id='new-subcategory'
            type='text'
            value={newSubCategory}
            onChange={e => setNewSubCategory(e.target.value)}
            onBlur={handleAddSubCategory}
            placeholder='子カテゴリ名（入力後にフォーカスを外すと保存）'
            className='w-full rounded border border-border bg-input p-2 text-foreground focus:ring-2 focus:ring-ring'
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddSubCategory()
              }
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className='mt-4 border-border border-t pt-4'>
      <h4 className='mb-2 font-medium text-foreground text-md'>
        子カテゴリキーワード管理
      </h4>

      {/* 新しい子カテゴリの追加フォーム */}
      <div className='mb-4'>
        <Label
          htmlFor='new-subcategory'
          className='mb-1 block font-medium text-foreground text-sm'
        >
          新しい子カテゴリを追加
        </Label>
        <Input
          id='new-subcategory'
          type='text'
          value={newSubCategory}
          onChange={e => setNewSubCategory(e.target.value)}
          onBlur={handleAddSubCategory}
          placeholder='子カテゴリ名（入力後にフォーカスを外すと保存）'
          className='w-full rounded border border-border bg-input p-2 text-foreground focus:ring-2 focus:ring-ring'
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddSubCategory()
            }
          }}
        />
      </div>

      {/* 子カテゴリボタン一覧 - レスポンシブ対応を改善 */}
      <div className='mb-3 flex flex-wrap gap-2'>
        {tabGroup.subCategories.map(category => (
          <div key={category} className='flex max-w-full items-center'>
            <Button
              type='button'
              onClick={() => handleCategorySelect(category)}
              variant={activeCategory === category ? 'secondary' : 'outline'}
              size='sm'
              className={`max-w-[180px] cursor-pointer truncate rounded-r-none ${
                activeCategory === category
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-muted text-foreground hover:bg-secondary/80'
              }`}
              title={category} // 長い名前の場合はホバーでフル表示
            >
              {category}
            </Button>
            <Button
              type='button'
              onClick={() => handleRemoveSubCategory(category)}
              variant='outline'
              size='sm'
              className='flex-shrink-0 cursor-pointer rounded-l-none'
              title='カテゴリを削除'
              aria-label={`カテゴリ ${category} を削除`}
            >
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>

      {activeCategory && (
        <div className='mt-2'>
          {/* カテゴリリネーム機能 - レスポンシブ対応を改善 */}
          {isRenamingSubCategory ? (
            <div className='relative mb-4'>
              <Label
                htmlFor='rename-category'
                className='mb-1 block text-foreground text-sm'
              >
                カテゴリ名を変更
              </Label>
              <div className='flex'>
                <Input
                  id='rename-category'
                  ref={renameInputRef}
                  type='text'
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      completeRename()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelRename()
                    }
                  }}
                  className='flex-grow rounded-l border border-border bg-input p-2 text-foreground'
                />
                <div className='flex flex-shrink-0'>
                  <Button
                    type='button'
                    onClick={completeRename}
                    variant='secondary'
                    size='icon'
                    className='rounded-none bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    title='変更を保存'
                  >
                    <Check size={16} />
                  </Button>
                  <Button
                    type='button'
                    onClick={cancelRename}
                    variant='ghost'
                    size='icon'
                    className='rounded-l-none'
                    title='キャンセル'
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>
              <div className='mt-1 text-muted-foreground text-xs'>
                Enter で確定、Escape でキャンセル
              </div>
            </div>
          ) : (
            <div className='mb-3 flex items-center justify-between'>
              <div className='flex items-center gap-2 overflow-hidden'>
                <h4
                  className='max-w-[200px] truncate font-medium text-foreground'
                  title={activeCategory}
                >
                  「{activeCategory}」カテゴリのキーワード
                </h4>
                <Button
                  type='button'
                  onClick={startRenameMode}
                  variant='outline'
                  size='sm'
                  className='flex-shrink-0 bg-muted text-foreground text-xs hover:bg-muted/70'
                  title='カテゴリ名を変更'
                >
                  リネーム
                </Button>
              </div>
            </div>
          )}

          <div className='mb-2'>
            <Label
              htmlFor={`keyword-input-${activeCategory}`}
              className='mb-1 block text-foreground text-sm'
            >
              キーワード
              <span className='ml-2 text-muted-foreground text-xs'>
                （タイトルにキーワードが含まれていると自動的にこのカテゴリに分類されます）
              </span>
            </Label>
            {/* キーワード追加フォーム */}
            <div className='flex'>
              <Input
                id={`keyword-input-${activeCategory}`}
                type='text'
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                placeholder='新しいキーワードを入力'
                className='flex-grow rounded-l border border-border bg-input p-2 text-foreground focus:ring-2 focus:ring-ring'
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddKeyword()
                  }
                }}
              />
              <Button
                type='button'
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim()}
                variant='secondary'
                className={`flex-shrink-0 cursor-pointer rounded-l-none ${
                  !newKeyword.trim()
                    ? 'cursor-not-allowed bg-secondary/50 text-muted-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
                aria-label='キーワードを追加'
              >
                <Plus size={18} />
              </Button>
            </div>
          </div>

          {/* キーワード表示を改善 */}
          <div className='mt-2 flex flex-wrap gap-2'>
            {keywords.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                キーワードがありません
              </p>
            ) : (
              keywords.map(keyword => (
                <div
                  key={keyword}
                  className='flex max-w-full items-center rounded bg-muted px-2 py-1 text-foreground text-sm'
                  title={keyword}
                >
                  <span className='max-w-[150px] truncate'>{keyword}</span>
                  <Button
                    type='button'
                    onClick={() => handleRemoveKeyword(keyword)}
                    variant='ghost'
                    size='sm'
                    className='ml-1 flex-shrink-0 cursor-pointer p-0 text-muted-foreground hover:bg-transparent hover:text-foreground'
                    aria-label={`キーワード ${keyword} を削除`}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
