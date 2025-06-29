import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CategoryKeywordModalProps } from '@/types/saved-tabs'
import type { ParentCategory, TabGroup } from '@/types/storage'
import { Edit, Trash, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

// カテゴリ名のバリデーションスキーマ
const categoryNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'カテゴリ名を入力してください' })
  .max(25, { message: 'カテゴリ名は25文字以下にしてください' })

// カテゴリキーワード管理モーダルコンポーネント
export const CategoryKeywordModal = ({
  group,
  isOpen,
  onClose,
  onSave,
  onDeleteCategory,
  parentCategories: initialParentCategories = [], // デフォルト値を空配列に設定
  onUpdateParentCategories,
}: CategoryKeywordModalProps) => {
  const [activeCategory, setActiveCategory] = useState<string>(
    group.subCategories && group.subCategories.length > 0
      ? group.subCategories[0]
      : '',
  )
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [newSubCategory, setNewSubCategory] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const modalContentRef = useRef<HTMLDivElement>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [internalParentCategories, setInternalParentCategories] = useState<
    ParentCategory[]
  >(initialParentCategories)
  const [selectedParentCategory, setSelectedParentCategory] =
    useState<string>('none')

  // エラー状態の追加
  const [subCategoryNameError, setSubCategoryNameError] = useState<
    string | null
  >(null)
  const [categoryRenameError, setCategoryRenameError] = useState<string | null>(
    null,
  )

  // 入力値検証用の共通関数
  const validateCategoryName = (
    name: string,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
  ) => {
    try {
      categoryNameSchema.parse(name)
      setError(null)
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.errors[0]?.message || 'カテゴリ名が無効です')
      }
      return false
    }
  }

  // 初期値の設定
  useEffect(() => {
    if (group.parentCategoryId) {
      setSelectedParentCategory(group.parentCategoryId)
      console.log('親カテゴリの初期値を設定:', group.parentCategoryId)
    }
  }, [group.parentCategoryId])

  const loadParentCategories = async () => {
    if (!isOpen) return

    try {
      console.log('親カテゴリの状態', {
        current: {
          count: internalParentCategories.length,
          categories: internalParentCategories.map((c: ParentCategory) => ({
            id: c.id,
            name: c.name,
          })),
        },
        selectedId: group.parentCategoryId,
      })

      const { parentCategories: stored = [] } =
        await chrome.storage.local.get('parentCategories')
      const storedCategories = stored as ParentCategory[]

      console.log('ストレージのカテゴリ', {
        count: storedCategories.length,
        categories: storedCategories.map(c => ({ id: c.id, name: c.name })),
      })

      // 内部状態を更新
      setInternalParentCategories(storedCategories)

      // 親カテゴリを更新
      if (onUpdateParentCategories) {
        // 常に最新のデータで更新
        await onUpdateParentCategories(storedCategories)
        console.log('親カテゴリを更新しました:', {
          count: storedCategories.length,
          categories: storedCategories.map(c => ({
            id: c.id,
            name: c.name,
            domainCount: c.domains.length,
          })),
        })
      }

      // 親コンポーネントに渡されたデータを確認
      console.log('親カテゴリの状態確認:', {
        propsCategories: initialParentCategories.length,
        storedCategories: storedCategories.length,
        selectedId: group.parentCategoryId,
      })

      // 選択状態の更新 - 親カテゴリを特定
      let newParentId = 'none'

      // group.parentCategoryIdが明示的に設定されている場合はそれを使用
      if (group.parentCategoryId) {
        newParentId = group.parentCategoryId
      }
      // そうでない場合は、ドメインが属している親カテゴリを探す
      else {
        // 各親カテゴリをチェックし、このドメインが含まれているかを確認
        for (const category of storedCategories) {
          // domainsにグループIDが含まれている、またはdomainNamesにドメイン名が含まれている場合
          if (
            category.domains.includes(group.id) ||
            category.domainNames.includes(group.domain)
          ) {
            newParentId = category.id
            console.log(
              `ドメイン「${group.domain}」は親カテゴリ「${category.name}」に属しています`,
            )
            break
          }
        }
      }

      if (selectedParentCategory !== newParentId) {
        setSelectedParentCategory(newParentId)
        console.log('選択状態を更新:', newParentId)
      }

      // 初期状態の確認
      if (storedCategories.length === 0) {
        console.log('親カテゴリが未作成')
      }
    } catch (error) {
      console.error('親カテゴリの読み込みに失敗:', error)
      toast.error('親カテゴリの読み込みに失敗しました。再度お試しください。')
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadParentCategoriesは変更されない
  useEffect(() => {
    // モーダルを開いた時に親カテゴリをロード
    const initializeCategories = async () => {
      if (isOpen) {
        console.log('モーダルを開きました - 親カテゴリを初期化')
        await loadParentCategories()

        // ストレージの変更を監視
        const handleStorageChange = (changes: {
          [key: string]: chrome.storage.StorageChange
        }) => {
          if (changes.parentCategories) {
            console.log('親カテゴリの変更を検出')
            loadParentCategories()
          }
        }

        // ストレージの変更監視を開始
        chrome.storage.onChanged.addListener(handleStorageChange)

        // クリーンアップ
        return () => {
          chrome.storage.onChanged.removeListener(handleStorageChange)
        }
      }
    }

    initializeCategories()
  }, [isOpen]) // isOpenの変更のみを監視

  // アクティブカテゴリが変更されたときのキーワード読み込み
  useEffect(() => {
    if (isOpen && activeCategory) {
      console.log('カテゴリ変更:', activeCategory)
      const categoryKeywords = group.categoryKeywords?.find(
        ck => ck.categoryName === activeCategory,
      )
      const keywords = categoryKeywords?.keywords || []
      console.log('読み込まれたキーワード:', keywords)

      setKeywords(keywords)
      setIsRenaming(false)
      setNewCategoryName('')
    }
  }, [isOpen, activeCategory, group])

  if (!isOpen) return null

  // キーワードを追加した時に重複チェックを追加
  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return

    const trimmedKeyword = newKeyword.trim()
    console.log('追加するキーワード:', trimmedKeyword)
    console.log('既存のキーワード:', keywords)

    // 完全一致する場合のみ重複とみなす（大文字小文字は区別しない）
    const isDuplicate = keywords.some(
      keyword => keyword.toLowerCase() === trimmedKeyword.toLowerCase(),
    )

    if (isDuplicate) {
      toast.error('このキーワードは既に追加されています')
      return
    }

    const updatedKeywords = [...keywords, trimmedKeyword]
    console.log('更新後のキーワード:', updatedKeywords)

    // 状態を更新
    setKeywords(updatedKeywords)
    setNewKeyword('')

    // 即座に保存
    onSave(group.id, activeCategory, updatedKeywords)
  }

  // キーワードを削除した時に関連URLを未分類に戻す処理を追加
  const handleRemoveKeyword = async (keywordToRemove: string) => {
    console.log('削除するキーワード:', keywordToRemove)
    const updatedKeywords = keywords.filter(k => k !== keywordToRemove)
    console.log('削除後のキーワード:', updatedKeywords)

    setKeywords(updatedKeywords)

    // ストレージにキーワードとURLのカテゴリ情報を同時に保存
    try {
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
      const updatedGroups = (savedTabs as TabGroup[]).map(g =>
        g.id === group.id
          ? {
              ...g,
              categoryKeywords: (g.categoryKeywords || []).map(ck =>
                ck.categoryName === activeCategory
                  ? { ...ck, keywords: updatedKeywords }
                  : ck,
              ),
              urls: (g.urls || []).map(item =>
                item.subCategory === activeCategory
                  ? { ...item, subCategory: undefined }
                  : item,
              ),
            }
          : g,
      )
      await chrome.storage.local.set({ savedTabs: updatedGroups })
    } catch (error) {
      console.error('キーワード削除に伴う保存処理に失敗しました:', error)
    }
  }

  // モーダルコンテンツのクリックイベントの伝播を停止
  const handleContentClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
  }

  // 子カテゴリ名の入力ハンドラ
  const handleSubCategoryNameChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value
    setNewSubCategory(value)
    validateCategoryName(value, setSubCategoryNameError)
  }

  // リネーム時の入力ハンドラ
  const handleRenameCategoryNameChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value
    setNewCategoryName(value)
    validateCategoryName(value, setCategoryRenameError)
  }

  // 子カテゴリ追加機能 - 修正版: 重複チェックと処理中フラグを追加
  const handleAddSubCategory = async () => {
    // 空の場合や処理中の場合は何もしない
    if (!newSubCategory.trim() || isProcessing) return

    // 先にバリデーションを実行
    if (!validateCategoryName(newSubCategory.trim(), setSubCategoryNameError)) {
      return
    }

    // 既存のカテゴリと重複していないか確認
    if (group.subCategories?.includes(newSubCategory.trim())) {
      setSubCategoryNameError('このカテゴリ名は既に存在しています')
      toast.error('このカテゴリ名は既に存在しています')
      return
    }

    // 処理中フラグをセット
    setIsProcessing(true)

    try {
      const validName = newSubCategory.trim()

      // 直接chrome.storage.localから保存されたタブを取得
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

      // 重複しないように更新するため、既存のものを探して更新
      const updatedTabs = savedTabs.map((tab: TabGroup) => {
        // IDが一致するタブグループのみ更新
        if (tab.id === group.id) {
          return {
            ...tab,
            subCategories: [...(tab.subCategories || []), validName],
          }
        }
        return tab
      })

      // 更新したタブグループをストレージに保存
      await chrome.storage.local.set({ savedTabs: updatedTabs })

      // カテゴリを追加したら、それをアクティブにする
      setActiveCategory(validName)
      setNewSubCategory('')
      setSubCategoryNameError(null)
      toast.success(`新しいカテゴリ「${validName}」を追加しました`)
    } catch (error) {
      console.error('子カテゴリ追加エラー:', error)
      toast.error('カテゴリの追加に失敗しました')
    } finally {
      // 処理完了後にフラグをリセット
      setIsProcessing(false)
    }
  }

  // カテゴリを削除する関数 - 修正版
  const handleDeleteCategory = async () => {
    if (!activeCategory) return

    console.log('カテゴリ削除開始:', activeCategory)

    // 関数の存在確認を追加
    if (typeof onDeleteCategory !== 'function') {
      console.error('削除関数が定義されていません')
      return
    }

    try {
      const categoryToDelete = activeCategory // 現在のカテゴリを保存
      console.log('削除処理実行:', group.id, categoryToDelete)

      // 削除処理を実行
      await onDeleteCategory(group.id, categoryToDelete)
      console.log('カテゴリ削除成功:', categoryToDelete)

      // 削除後は別のカテゴリを選択
      if (group.subCategories && group.subCategories.length > 1) {
        // 削除したカテゴリ以外のカテゴリを選択
        const updatedSubCategories = group.subCategories.filter(
          (cat: string) => cat !== categoryToDelete,
        )
        if (updatedSubCategories.length > 0) {
          setActiveCategory(updatedSubCategories[0])
        } else {
          setActiveCategory('')
        }
      } else {
        // カテゴリがなくなった場合
        setActiveCategory('')
      }

      // 削除確認モーダルを閉じる
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('カテゴリ削除エラー:', error)
    }
  }

  // カテゴリ選択時に削除確認モーダルをリセット
  useEffect(() => {
    setShowDeleteConfirm(false)
  }, []) // 初期化時のみ実行

  // カテゴリのリネーム処理を開始
  const handleStartRenaming = () => {
    setNewCategoryName(activeCategory)
    setIsRenaming(true)
    // 入力フィールドにフォーカスが当たったら全選択状態にする
    requestAnimationFrame(() => {
      const inputElement = document.querySelector(
        'input[data-rename-input]',
      ) as HTMLInputElement
      if (inputElement) {
        inputElement.focus()
        inputElement.select() // テキスト全体を選択状態に
      }
    })
  }

  // リネームをキャンセル
  const handleCancelRenaming = () => {
    setIsRenaming(false)
    setNewCategoryName('')
  }

  // カテゴリ名の変更を保存
  const handleSaveRenaming = async () => {
    // 変更がない場合や空の場合はリネームモードを終了
    if (!newCategoryName.trim() || newCategoryName.trim() === activeCategory) {
      setIsRenaming(false)
      setNewCategoryName('')
      setCategoryRenameError(null)
      return
    }

    // すでに処理中の場合は何もしない
    if (isProcessing) return

    // 先にバリデーションを実行
    if (!validateCategoryName(newCategoryName.trim(), setCategoryRenameError)) {
      // 入力フィールドにフォーカスを戻す
      requestAnimationFrame(() => {
        const inputElement = document.querySelector(
          'input[data-rename-input]',
        ) as HTMLInputElement
        if (inputElement) inputElement.focus()
      })
      return
    }

    // 既存のカテゴリと重複していないか確認
    if (group.subCategories?.includes(newCategoryName.trim())) {
      setCategoryRenameError('このカテゴリ名は既に存在しています')
      toast.error('このカテゴリ名は既に存在しています')
      // 入力フィールドにフォーカスを戻す
      requestAnimationFrame(() => {
        const inputElement = document.querySelector(
          'input[data-rename-input]',
        ) as HTMLInputElement
        if (inputElement) inputElement.focus()
      })
      return
    }

    setIsProcessing(true)

    try {
      const validName = newCategoryName.trim()

      // 直接chrome.storage.localから保存されたタブを取得
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

      // 対象のグループを見つけて更新
      const updatedTabs = savedTabs.map((tab: TabGroup) => {
        if (tab.id === group.id) {
          // サブカテゴリの更新
          const updatedSubCategories =
            tab.subCategories?.map(cat =>
              cat === activeCategory ? validName : cat,
            ) || []

          // カテゴリキーワードの更新
          const updatedCategoryKeywords =
            tab.categoryKeywords?.map(ck => {
              if (ck.categoryName === activeCategory) {
                return { ...ck, categoryName: validName }
              }
              return ck
            }) || []

          // URLのサブカテゴリも更新
          const updatedUrls = (tab.urls || []).map(url => {
            if (url.subCategory === activeCategory) {
              return { ...url, subCategory: validName }
            }
            return url
          })

          // サブカテゴリの順序も更新
          let updatedSubCategoryOrder = tab.subCategoryOrder || []
          if (updatedSubCategoryOrder.includes(activeCategory)) {
            updatedSubCategoryOrder = updatedSubCategoryOrder.map(cat =>
              cat === activeCategory ? validName : cat,
            )
          }

          // 未分類を含む順序も更新
          let updatedAllOrder = tab.subCategoryOrderWithUncategorized || []
          if (updatedAllOrder.includes(activeCategory)) {
            updatedAllOrder = updatedAllOrder.map(cat =>
              cat === activeCategory ? validName : cat,
            )
          }

          return {
            ...tab,
            subCategories: updatedSubCategories,
            categoryKeywords: updatedCategoryKeywords,
            urls: updatedUrls,
            subCategoryOrder: updatedSubCategoryOrder,
            subCategoryOrderWithUncategorized: updatedAllOrder,
          }
        }
        return tab
      })

      // ストレージに保存
      await chrome.storage.local.set({ savedTabs: updatedTabs })

      // アクティブカテゴリを新しい名前に更新
      setActiveCategory(validName)

      // リネームモードを終了
      setIsRenaming(false)
      setNewCategoryName('')
      setCategoryRenameError(null)

      toast.success(
        `カテゴリ名を「${activeCategory}」から「${validName}」に変更しました`,
      )
    } catch (error) {
      console.error('カテゴリ名の変更中にエラーが発生しました:', error)
      toast.error('カテゴリ名の変更に失敗しました')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-h-[90vh] overflow-y-auto'
        // モーダル全体のクリックイベント伝播を停止
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
          }
        }}
      >
        <DialogHeader className='text-left'>
          <DialogTitle>「{group.domain}」の子カテゴリ管理</DialogTitle>
        </DialogHeader>

        <div
          ref={modalContentRef}
          onClick={handleContentClick}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleContentClick(e)
            }
          }}
          role='presentation'
          className='space-y-4'
        >
          {/* 子カテゴリ追加セクション */}
          <div className='mb-4'>
            <h4 className='mb-2 font-medium text-gray-300 text-md'>
              新しい子カテゴリを追加
            </h4>
            <div className='flex flex-col'>
              <Input
                value={newSubCategory}
                onChange={handleSubCategoryNameChange}
                placeholder='例: ニュース、ブログ、コラム'
                className={`flex-grow rounded border p-2 ${subCategoryNameError ? 'border-red-500' : ''}`}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSubCategory()
                  }
                }}
                onBlur={() => {
                  if (newSubCategory.trim()) {
                    handleAddSubCategory()
                  }
                }}
              />
              {subCategoryNameError && (
                <p className='mt-1 text-red-500 text-xs'>
                  {subCategoryNameError}
                </p>
              )}
            </div>
          </div>

          {/* 既存のカテゴリ管理セクション */}
          {group.subCategories && group.subCategories.length > 0 && (
            <>
              <div className='mb-4'>
                <div className='mb-2 flex items-center justify-between'>
                  <Label htmlFor='category-select'>子カテゴリを選択</Label>

                  <div className='flex gap-2'>
                    {!isRenaming && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='secondary'
                            size='sm'
                            onClick={handleStartRenaming}
                            className='flex cursor-pointer items-center gap-1 rounded px-2 py-1'
                            disabled={!activeCategory}
                          >
                            <Edit size={14} />
                            <span className='hidden lg:inline'>
                              子カテゴリ名を変更
                            </span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side='top' className='block lg:hidden'>
                          子カテゴリ名を変更
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='secondary'
                          size='sm'
                          onClick={() => setShowDeleteConfirm(true)}
                          className='flex cursor-pointer items-center gap-1 rounded px-2 py-1'
                          disabled={!activeCategory}
                        >
                          <Trash2 size={14} />
                          <span className='hidden lg:inline'>
                            選択中の子カテゴリを削除
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side='top' className='block lg:hidden'>
                        選択中の子カテゴリを削除
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* リネームフォーム */}
                {isRenaming && (
                  <div className='mt-2 mb-3 rounded border p-3'>
                    <div className='mb-2 text-gray-300 text-sm'>
                      「{activeCategory}」の新しい名前を入力してください
                      <br />
                      <span className='text-gray-400 text-xs'>
                        入力後、フォーカスを外すかEnterキーで保存されます。キャンセルするにはEscを押してください
                      </span>
                    </div>
                    <Input
                      value={newCategoryName}
                      onChange={handleRenameCategoryNameChange}
                      placeholder='例: ニュース、ブログ、コラム'
                      className={`w-full rounded border p-2 ${categoryRenameError ? 'border-red-500' : ''}`}
                      autoFocus
                      data-rename-input='true'
                      onBlur={handleSaveRenaming}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.currentTarget.blur()
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          handleCancelRenaming()
                        }
                      }}
                    />
                    {categoryRenameError && (
                      <p className='mt-1 text-red-500 text-xs'>
                        {categoryRenameError}
                      </p>
                    )}
                  </div>
                )}

                {/* 削除確認UI */}
                {showDeleteConfirm && (
                  <div className='mt-2 mb-3 rounded border p-3'>
                    <p className='mb-2 text-gray-300'>
                      「{activeCategory}」子カテゴリを削除しますか？
                      <br />
                      <span className='text-xs'>
                        この子カテゴリに属するすべてのタブは未分類になります
                      </span>
                    </p>
                    <div className='flex justify-end gap-2'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setShowDeleteConfirm(false)}
                        className='cursor-pointer rounded px-2 py-1'
                      >
                        キャンセル
                      </Button>
                      <Button
                        variant='destructive'
                        size='sm'
                        onClick={handleDeleteCategory}
                        className='flex cursor-pointer items-center gap-1'
                      >
                        <Trash size={14} />
                        <span className='hidden lg:inline'>削除</span>
                      </Button>
                    </div>
                  </div>
                )}

                <Select
                  value={activeCategory}
                  onValueChange={setActiveCategory}
                  disabled={isRenaming}
                >
                  <SelectTrigger className='w-full cursor-pointer rounded border p-2'>
                    <SelectValue placeholder='管理する子カテゴリを選択' />
                  </SelectTrigger>
                  <SelectContent>
                    {group.subCategories.map(cat => (
                      <SelectItem
                        key={cat}
                        value={cat}
                        className='cursor-pointer'
                      >
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* キーワード設定セクション */}
              <div className='mb-4'>
                <Label
                  htmlFor='keyword-input'
                  className='block text-gray-400 text-sm'
                >
                  「{activeCategory}」子カテゴリのキーワード
                </Label>
                <span className='mb-1 text-gray-500 text-xs'>
                  タイトルにキーワードが含まれていると自動的にこの子カテゴリに分類されます
                </span>

                <div className='my-2 flex'>
                  <Input
                    id='keyword-input'
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    placeholder='例: 技術、新機能、チュートリアル'
                    className='flex-grow rounded border p-2'
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddKeyword()
                      }
                    }}
                    onBlur={() => {
                      if (newKeyword.trim()) {
                        handleAddKeyword()
                      }
                    }}
                    disabled={isRenaming}
                  />
                </div>

                <div className='flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded border p-2'>
                  {keywords.length === 0 ? (
                    <p className='text-gray-500'>キーワードがありません</p>
                  ) : (
                    keywords.map(keyword => (
                      <Badge
                        key={keyword}
                        variant='outline'
                        className='flex items-center gap-1 rounded px-2 py-1'
                      >
                        {keyword}
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleRemoveKeyword(keyword)}
                          className='ml-1 cursor-pointer text-gray-400 hover:text-gray-200'
                          aria-label='キーワードを削除'
                          disabled={isRenaming}
                        >
                          <X size={14} />
                        </Button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
