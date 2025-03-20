import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod' // zodをインポート
import type { ParentCategory, TabGroup } from '../../../utils/storage'
import {
  assignDomainToCategory,
  createParentCategory,
  deleteParentCategory,
  getParentCategories,
} from '../../../utils/storage'

// カテゴリ名のバリデーションスキーマ
const categoryNameSchema = z
  .string()
  .min(1, 'カテゴリ名を入力してください')
  .max(25, 'カテゴリ名は25文字以下にしてください')

interface CategoryModalProps {
  onClose: () => void
  tabGroups: TabGroup[]
}

export const CategoryModal = ({ onClose, tabGroups }: CategoryModalProps) => {
  // 新規カテゴリ名の状態
  const [newCategoryName, setNewCategoryName] = useState('')
  // 入力エラー状態を追加
  const [nameError, setNameError] = useState<string | null>(null)

  // カテゴリリストの状態
  const [categories, setCategories] = useState<ParentCategory[]>([])

  // 選択中のカテゴリID
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )

  // 選択中のドメインIDsのマップ (key: domainId, value: selected)
  const [selectedDomains, setSelectedDomains] = useState<
    Record<string, boolean>
  >({})

  // ドメインの親カテゴリ情報を保持するステート
  const [domainCategories, setDomainCategories] = useState<
    Record<string, { id: string; name: string } | null>
  >({})

  // 処理中状態
  const [isLoading, setIsLoading] = useState(false)

  // 削除確認ダイアログの状態
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] =
    useState<ParentCategory | null>(null)

  // カテゴリリストを初期ロード
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const parentCategories = await getParentCategories()
        setCategories(parentCategories)

        // 各ドメインがどのカテゴリに属しているか計算
        const domainCategoriesMap: Record<
          string,
          { id: string; name: string } | null
        > = {}

        // 各ドメインについて所属カテゴリをマップ
        for (const group of tabGroups) {
          let foundCategory = null

          // このドメインが属するカテゴリを探す
          for (const category of parentCategories) {
            if (category.domainNames?.includes(group.domain)) {
              foundCategory = {
                id: category.id,
                name: category.name,
              }
              break
            }
          }

          domainCategoriesMap[group.id] = foundCategory
        }

        setDomainCategories(domainCategoriesMap)

        // 最初のカテゴリを選択状態にする（もしあれば）
        if (parentCategories.length > 0) {
          setSelectedCategoryId(parentCategories[0].id)

          // 選択したカテゴリに紐づいているドメインをチェック状態にする
          updateSelectedDomains(parentCategories[0])
        }
      } catch (error) {
        console.error('カテゴリの取得に失敗しました', error)
        toast.error('カテゴリの読み込みに失敗しました')
      }
    }

    loadCategories()
  }, [tabGroups])

  // 選択したカテゴリが変わった時にドメインの選択状態を更新
  useEffect(() => {
    if (!selectedCategoryId) return

    const selectedCategory = categories.find(c => c.id === selectedCategoryId)
    if (selectedCategory) {
      updateSelectedDomains(selectedCategory)
    }
  }, [selectedCategoryId, categories])

  // 指定したカテゴリに基づいてドメイン選択状態を更新
  const updateSelectedDomains = (
    category: ParentCategory | 'uncategorized',
  ) => {
    const newSelectedDomains: Record<string, boolean> = {}

    // 全てのタブグループについて処理
    for (const group of tabGroups) {
      if (category === 'uncategorized') {
        // 未分類カテゴリの場合、どのカテゴリにも属していないドメインのみを選択
        newSelectedDomains[group.id] = !domainCategories[group.id]
      } else {
        // 通常のカテゴリの場合、このドメインが選択カテゴリに関連付けられているか
        const isDomainInCategory =
          category.domainNames?.includes(group.domain) || false
        newSelectedDomains[group.id] = isDomainInCategory
      }
    }

    setSelectedDomains(newSelectedDomains)
  }

  // カテゴリ選択ハンドラ
  const handleCategoryChange = (value: string) => {
    if (value === 'uncategorized') {
      setSelectedCategoryId('uncategorized')
      // 未分類のドメインを表示するよう選択状態を更新
      updateSelectedDomains('uncategorized')
    } else {
      setSelectedCategoryId(value)
      const selectedCategory = categories.find(c => c.id === value)
      if (selectedCategory) {
        updateSelectedDomains(selectedCategory)
      }
    }
  }

  // 新規カテゴリ作成ハンドラ
  const handleCreateCategory = async () => {
    // 入力値のバリデーション
    try {
      categoryNameSchema.parse(newCategoryName)
      // バリデーション成功時はエラーをリセット
      setNameError(null)
    } catch (error) {
      if (error instanceof z.ZodError) {
        // zodエラーメッセージを抽出して表示
        const errorMessage = error.errors[0]?.message || 'カテゴリ名が無効です'
        setNameError(errorMessage)
        toast.error(errorMessage)
        return
      }
    }

    try {
      setIsLoading(true)
      const newCategory = await createParentCategory(newCategoryName)
      setCategories([...categories, newCategory])
      setSelectedCategoryId(newCategory.id)
      setNewCategoryName('')
      toast.success('カテゴリを作成しました')

      // 空の状態で選択状態を初期化
      updateSelectedDomains(newCategory)
    } catch (error) {
      console.error('カテゴリの作成に失敗しました', error)

      // 重複エラーの特別な処理
      if (
        error instanceof Error &&
        error.message.startsWith('DUPLICATE_CATEGORY_NAME:')
      ) {
        toast.error(`カテゴリ名「${newCategoryName}」は既に存在します`)
      } else {
        toast.error('カテゴリの作成に失敗しました')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 入力フィールドの変更ハンドラー
  const handleCategoryNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNewCategoryName(value)

    // 入力時にリアルタイムでバリデーション
    try {
      categoryNameSchema.parse(value)
      setNameError(null)
    } catch (error) {
      if (error instanceof z.ZodError) {
        setNameError(error.errors[0]?.message || 'カテゴリ名が無効です')
      }
    }
  }

  // カテゴリ保存ハンドラ
  const handleSaveCategory = async () => {
    if (!selectedCategoryId) {
      toast.error('カテゴリを選択してください')
      return
    }

    try {
      setIsLoading(true)

      // 選択されたカテゴリと選択状態のドメインを取得
      const selectedCategory = categories.find(c => c.id === selectedCategoryId)
      if (!selectedCategory) return

      // 各ドメインについてカテゴリへの割り当て状態を更新 (mapからfor...ofに変更)
      const promises = []
      for (const group of tabGroups) {
        const isSelected = selectedDomains[group.id] || false

        // カテゴリに割り当てるか解除するか
        const promise = assignDomainToCategory(
          group.id,
          isSelected ? selectedCategoryId : 'none',
        )
        promises.push(promise)
      }

      await Promise.all(promises)

      // 親カテゴリリストを再取得して最新状態を反映
      const updatedCategories = await getParentCategories()
      setCategories(updatedCategories)

      // ドメインのカテゴリ情報も更新
      const updatedDomainCategories = { ...domainCategories }
      for (const group of tabGroups) {
        const isSelected = selectedDomains[group.id] || false

        if (isSelected && selectedCategory) {
          updatedDomainCategories[group.id] = {
            id: selectedCategory.id,
            name: selectedCategory.name,
          }
        } else if (
          !isSelected &&
          updatedDomainCategories[group.id]?.id === selectedCategoryId
        ) {
          updatedDomainCategories[group.id] = null
        }
      }

      setDomainCategories(updatedDomainCategories)

      toast.success('カテゴリ設定を保存しました')
    } catch (error) {
      console.error('カテゴリの保存に失敗しました', error)
      toast.error('カテゴリ設定の保存に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // カテゴリ削除ハンドラ
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return

    try {
      setIsLoading(true)
      await deleteParentCategory(categoryToDelete.id)

      // カテゴリリストから削除されたカテゴリを除外
      const updatedCategories = categories.filter(
        c => c.id !== categoryToDelete.id,
      )
      setCategories(updatedCategories)

      // ドメインカテゴリ情報を更新
      const updatedDomainCategories = { ...domainCategories }
      for (const groupId in updatedDomainCategories) {
        if (updatedDomainCategories[groupId]?.id === categoryToDelete.id) {
          updatedDomainCategories[groupId] = null
        }
      }
      setDomainCategories(updatedDomainCategories)

      // 選択中のカテゴリが削除された場合、選択をリセット
      if (selectedCategoryId === categoryToDelete.id) {
        setSelectedCategoryId(
          updatedCategories.length > 0 ? updatedCategories[0].id : null,
        )

        // 選択カテゴリが変わったので、ドメイン選択状態も更新
        if (updatedCategories.length > 0) {
          updateSelectedDomains(updatedCategories[0])
        } else {
          setSelectedDomains({})
        }
      }

      toast.success(`カテゴリ「${categoryToDelete.name}」を削除しました`)
      setCategoryToDelete(null)
    } catch (error) {
      console.error('カテゴリの削除に失敗しました:', error)
      toast.error('カテゴリの削除に失敗しました')
    } finally {
      setIsLoading(false)
      setDeleteConfirmOpen(false)
    }
  }

  // 削除ボタンクリック時のハンドラ
  const handleDeleteClick = () => {
    const categoryToDelete = categories.find(c => c.id === selectedCategoryId)
    if (!categoryToDelete) {
      toast.error('削除するカテゴリが選択されていません')
      return
    }

    setCategoryToDelete(categoryToDelete)
    setDeleteConfirmOpen(true)
  }

  // ドメイン選択状態の切り替えハンドラ（チェックボックス変更時に保存）
  const toggleDomainSelection = async (domainId: string) => {
    try {
      // チェックボックスの新しい状態を計算（反転）
      const newChecked = !selectedDomains[domainId]

      // UI状態を即時更新してレスポンスを良くする
      setSelectedDomains(prev => ({
        ...prev,
        [domainId]: newChecked,
      }))

      // 選択されたカテゴリを取得
      if (!selectedCategoryId) return

      // 対象のグループを見つける
      const group = tabGroups.find(g => g.id === domainId)
      if (!group) return

      // 未分類カテゴリの特別処理
      if (selectedCategoryId === 'uncategorized') {
        if (newChecked) {
          // 未分類から何かカテゴリに移動するケースは現時点では許可しない
          setSelectedDomains(prev => ({
            ...prev,
            [domainId]: false,
          }))
          toast.error(
            '未分類カテゴリでは直接操作できません。カテゴリを選択してください。',
          )
        }
        return
      }

      setIsLoading(true)

      // このドメインとカテゴリの関連付けを保存
      await assignDomainToCategory(
        domainId,
        newChecked ? selectedCategoryId : 'none',
      )

      // ドメインのカテゴリ情報も更新
      const updatedDomainCategories = { ...domainCategories }
      const selectedCategory = categories.find(c => c.id === selectedCategoryId)

      if (!selectedCategory) return

      if (newChecked) {
        // カテゴリに追加
        updatedDomainCategories[domainId] = {
          id: selectedCategory.id,
          name: selectedCategory.name,
        }
      } else if (updatedDomainCategories[domainId]?.id === selectedCategoryId) {
        // カテゴリから削除
        updatedDomainCategories[domainId] = null
      }

      // 親カテゴリリストを再取得して最新状態を反映
      const updatedCategories = await getParentCategories()
      setCategories(updatedCategories)
      setDomainCategories(updatedDomainCategories)

      // 静かに成功通知を表示
      toast.success(
        newChecked
          ? `ドメイン ${group.domain} を「${selectedCategory.name}」に追加しました`
          : `ドメイン ${group.domain} を「${selectedCategory.name}」から削除しました`,
        { duration: 1500 },
      )

      // 未分類表示の更新のため、カテゴリが "uncategorized" だった場合に再ロード
      if (selectedCategoryId === 'uncategorized') {
        updateSelectedDomains('uncategorized')
      }
    } catch (error) {
      console.error('カテゴリの設定に失敗しました:', error)
      toast.error('カテゴリの設定に失敗しました')

      // エラーが発生した場合、UI状態を元に戻す
      setSelectedDomains(prev => ({
        ...prev,
        [domainId]: !selectedDomains[domainId],
      }))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Dialog open={true} onOpenChange={() => onClose()}>
        <DialogContent className='sm:max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden'>
          <DialogHeader>
            <DialogTitle>親カテゴリ管理</DialogTitle>
          </DialogHeader>

          <div className='grid gap-4 py-4 overflow-y-auto pr-1'>
            {/* 新規カテゴリ作成エリア */}
            <div className='flex items-end gap-2'>
              <div className='flex-1'>
                <Label htmlFor='newCategory'>新規親カテゴリ名</Label>
                <Input
                  id='newCategory'
                  value={newCategoryName}
                  onChange={handleCategoryNameChange}
                  placeholder='新しい親カテゴリ名を入力 (25文字以内)'
                  className={nameError ? 'border-red-500' : ''}
                />
                {nameError && (
                  <p className='text-red-500 text-xs mt-1'>{nameError}</p>
                )}
              </div>
              <Button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim() || !!nameError || isLoading}
              >
                作成
              </Button>
            </div>

            {/* カテゴリ選択エリア */}
            <div>
              <div className='flex items-center justify-between mb-2'>
                <Label htmlFor='categorySelect'>親カテゴリ選択</Label>
                {categories.length > 0 &&
                  selectedCategoryId &&
                  selectedCategoryId !== 'uncategorized' && (
                    <Button
                      variant='secondary'
                      size='sm'
                      onClick={handleDeleteClick}
                      disabled={isLoading}
                    >
                      <Trash2 size={16} className='mr-1' />
                      削除
                    </Button>
                  )}
              </div>
              <Select
                value={selectedCategoryId || ''}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className='w-full' id='categorySelect'>
                  <SelectValue placeholder='親カテゴリを選択' />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ドメイン選択エリア */}
            <div>
              <Label>
                ドメイン選択
                {selectedCategoryId === 'uncategorized' &&
                  '（未割り当てドメインのみ表示）'}
              </Label>
              <ScrollArea className='h-[calc(70vh-150px)] border rounded p-2'>
                {tabGroups.length > 0 ? (
                  // 未分類とカテゴリ分類済みでソート
                  [...tabGroups]
                    .sort((a, b) => {
                      // domainCategoriesがnullかどうかでソート（nullが先=未分類が先）
                      const aHasCategory = !!domainCategories[a.id]
                      const bHasCategory = !!domainCategories[b.id]

                      if (!aHasCategory && bHasCategory) return -1 // aが未分類ならaを前に
                      if (aHasCategory && !bHasCategory) return 1 // bが未分類ならbを前に

                      // 両方同じカテゴリ状態の場合はドメイン名でソート
                      return a.domain.localeCompare(b.domain)
                    })
                    .map(group => {
                      const belongsToCategory = domainCategories[group.id]
                      const isInCurrentCategory =
                        selectedCategoryId &&
                        selectedCategoryId !== 'uncategorized' &&
                        belongsToCategory?.id === selectedCategoryId
                      const isUncategorized = !belongsToCategory

                      // 未分類カテゴリ選択時に未分類以外のドメインを非表示にする
                      if (
                        selectedCategoryId === 'uncategorized' &&
                        belongsToCategory
                      ) {
                        return null
                      }

                      return (
                        <div
                          key={group.id}
                          className={`flex items-center space-x-2 py-2 border-b last:border-0 ${
                            isInCurrentCategory ? 'bg-primary/10' : ''
                          } ${isUncategorized ? 'bg-muted/50' : ''}`}
                        >
                          <Checkbox
                            id={`domain-${group.id}`}
                            checked={selectedDomains[group.id] || false}
                            onCheckedChange={() =>
                              toggleDomainSelection(group.id)
                            }
                            // 未分類カテゴリでも操作可能にする（但し警告メッセージが表示される）
                            disabled={isLoading || !selectedCategoryId}
                          />
                          <div className='flex-1'>
                            <Label
                              htmlFor={`domain-${group.id}`}
                              className='flex-1 cursor-pointer'
                            >
                              {group.domain}
                            </Label>
                            {belongsToCategory && (
                              <button
                                type='button'
                                className='text-xs text-muted-foreground flex items-center mt-1 cursor-pointer w-full text-left bg-transparent border-0 p-0 hover:text-foreground'
                                onClick={() => toggleDomainSelection(group.id)}
                                disabled={isLoading || !selectedCategoryId}
                                aria-label={`${selectedCategoryId === belongsToCategory.id ? '現在選択中のカテゴリ' : '所属カテゴリ'}: ${belongsToCategory.name}`}
                              >
                                <span className='inline-block w-2 h-2 rounded-full bg-primary mr-1' />
                                <span>
                                  {selectedCategoryId === belongsToCategory.id
                                    ? '現在選択中のカテゴリ: '
                                    : '所属カテゴリ: '}
                                  {belongsToCategory.name}
                                </span>
                              </button>
                            )}

                            {!belongsToCategory && (
                              <button
                                type='button'
                                className='text-xs text-muted-foreground flex items-center mt-1 cursor-pointer w-full text-left bg-transparent border-0 p-0 hover:text-foreground'
                                onClick={() => toggleDomainSelection(group.id)}
                                disabled={isLoading || !selectedCategoryId}
                                aria-label='未分類のドメイン'
                              >
                                <span className='inline-block w-2 h-2 rounded-full bg-muted-foreground mr-1' />
                                <span>未分類</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                    .filter(Boolean) // nullをフィルタリング
                ) : (
                  <div className='text-center py-8 text-muted-foreground'>
                    保存されたドメインがありません
                  </div>
                )}
                {/* 未分類カテゴリで表示するものがない場合のメッセージ */}
                {selectedCategoryId === 'uncategorized' &&
                  tabGroups.every(group => domainCategories[group.id]) && (
                    <div className='text-center py-8 text-muted-foreground'>
                      すべてのドメインがカテゴリに分類されています
                    </div>
                  )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>カテゴリを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              カテゴリ「{categoryToDelete?.name}
              」を削除します。この操作は取り消せません。
              {categoryToDelete?.domainNames?.length ? (
                <p className='mt-2'>
                  このカテゴリには {categoryToDelete.domainNames.length}{' '}
                  件のドメインが関連付けられています。
                  削除すると、これらのドメインとカテゴリの関連付けも解除されます。
                </p>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                handleDeleteCategory()
              }}
              disabled={isLoading}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
