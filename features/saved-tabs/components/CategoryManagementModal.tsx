import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ParentCategory } from '@/types/storage'
import { Edit, Plus, Trash, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod' // zodをインポート

// カテゴリ名のバリデーションスキーマ
const categoryNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'カテゴリ名を入力してください' })
  .max(25, { message: 'カテゴリ名は25文字以下にしてください' })

// 型定義
interface AvailableDomain {
  id: string
  domain: string
}

// TabGroup型の定義
interface TabGroup {
  id: string
  domain: string
  urls: Array<{ url: string; title: string; subCategory?: string }>
  subCategories?: string[]
}

// 親カテゴリ管理モーダルの型定義
interface CategoryManagementModalProps {
  isOpen: boolean
  onClose: () => void
  category: {
    id: string
    name: string
  }
  domains: TabGroup[]
  onCategoryUpdate?: (categoryId: string, newName: string) => void
}

export const CategoryManagementModal = ({
  isOpen,
  onClose,
  category,
  domains,
  onCategoryUpdate,
}: CategoryManagementModalProps) => {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false) // 保存処理中の状態
  const [availableDomains, setAvailableDomains] = useState<AvailableDomain[]>(
    [],
  )
  const [selectedDomain, setSelectedDomain] = useState('')
  const [localCategoryName, setLocalCategoryName] = useState('')
  const modalContentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [categoryNameError, setCategoryNameError] = useState<string | null>(
    null,
  ) // エラー状態を追加
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 入力値バリデーション関数
  const validateCategoryName = (name: string) => {
    try {
      categoryNameSchema.parse(name)
      setCategoryNameError(null)
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        setCategoryNameError(error.errors[0]?.message || 'カテゴリ名が無効です')
      }
      return false
    }
  }

  // モーダルが開いたときの初期化
  useEffect(() => {
    if (isOpen) {
      setNewCategoryName(category.name)
      setLocalCategoryName(category.name)
      setIsRenaming(false)
      setIsProcessing(false)
      setCategoryNameError(null) // エラー状態をリセット
      loadAvailableDomains()
    }
  }, [isOpen, category])

  // 追加可能なドメイン一覧を取得
  const loadAvailableDomains = async () => {
    try {
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
      const { parentCategories = [] } =
        await chrome.storage.local.get('parentCategories')

      // 現在のカテゴリのドメインを取得
      const targetCategory = parentCategories.find(
        (cat: ParentCategory) => cat.id === category.id,
      )
      const currentDomainIds = targetCategory?.domains || []

      // 他のすべてのドメインを取得
      const otherDomains = (savedTabs as TabGroup[])
        .filter(tab => !currentDomainIds.includes(tab.id))
        .map(tab => ({ id: tab.id, domain: tab.domain }))

      setAvailableDomains(otherDomains)

      if (otherDomains.length > 0) {
        setSelectedDomain(otherDomains[0].id)
      } else {
        setSelectedDomain('')
      }
    } catch (error) {
      console.error('利用可能なドメインの取得に失敗しました:', error)
    }
  }

  // カテゴリのリネーム処理を開始
  const handleStartRenaming = () => {
    setNewCategoryName(localCategoryName)
    setIsRenaming(true)
    setCategoryNameError(null) // エラー状態をリセット
    // 入力フィールドにフォーカス
    // 即座にフォーカスと選択を行う
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    })
  }

  // リネームをキャンセル
  const handleCancelRenaming = () => {
    setIsRenaming(false)
    setNewCategoryName(localCategoryName)
    setCategoryNameError(null) // エラー状態をリセット
  }

  // 入力変更時の処理
  const handleCategoryNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNewCategoryName(value)
    validateCategoryName(value) // リアルタイムバリデーション
  }

  // カテゴリ名の変更処理
  const handleSaveRenaming = async () => {
    console.log('Modal - handleSaveRenaming開始', {
      currentCategory: category,
      localState: {
        isRenaming,
        isProcessing,
        newCategoryName,
        localCategoryName,
      },
      hasUpdateCallback: !!onCategoryUpdate,
    })

    if (
      !newCategoryName.trim() ||
      newCategoryName.trim() === localCategoryName
    ) {
      console.log('Modal - 変更なしまたは空の値のため終了')
      setIsRenaming(false)
      return
    }

    if (isProcessing) {
      console.log('Modal - 処理中のため終了')
      return
    }

    // バリデーション
    if (!validateCategoryName(newCategoryName.trim())) {
      // エラーがある場合、処理を中止
      return
    }

    setIsProcessing(true)
    const trimmedName = newCategoryName.trim()
    console.log('Modal - 処理開始:', {
      categoryId: category.id,
      oldName: category.name,
      newName: trimmedName,
    })

    try {
      // onCategoryUpdateが提供されていない場合はエラー
      if (!onCategoryUpdate) {
        throw new Error('カテゴリ更新機能が利用できません')
      }

      // カテゴリ名の更新処理を実行
      console.log('Modal - onCategoryUpdate呼び出し開始', {
        categoryId: category.id,
        newName: trimmedName,
      })

      try {
        // 保存開始
        setIsSaving(true)

        // カテゴリの更新を試行
        await onCategoryUpdate(category.id, trimmedName)
        console.log('Modal - onCategoryUpdate呼び出し完了')

        // 保存完了
        setIsSaving(false)

        // 保存が完全に反映されるまで確認
        let isUpdateConfirmed = false
        let attempts = 0
        const maxAttempts = 5

        while (!isUpdateConfirmed && attempts < maxAttempts) {
          const { parentCategories = [] } =
            await chrome.storage.local.get('parentCategories')
          const updatedCategory = parentCategories.find(
            (cat: ParentCategory) => cat.id === category.id,
          )

          if (updatedCategory && updatedCategory.name === trimmedName) {
            console.log('Modal - カテゴリ名の更新を確認:', updatedCategory)
            isUpdateConfirmed = true
            break
          }

          console.log(
            `Modal - 更新確認を再試行 (${attempts + 1}/${maxAttempts})`,
          )
          attempts++
        }

        if (!isUpdateConfirmed) {
          throw new Error('カテゴリ名の更新が確認できません')
        }

        // 更新が確認できたらUIを更新
        setLocalCategoryName(trimmedName)
        setIsRenaming(false)
        toast.success(
          `カテゴリ名を「${category.name}」から「${trimmedName}」に変更しました`,
        )

        // トーストメッセージを表示
        console.log('Modal - カテゴリ更新が完了しました')
      } catch (error) {
        console.error('Modal - カテゴリ名の更新に失敗:', error)
        throw error
      } finally {
        // 保存状態をリセット
        setIsSaving(false)
        console.log('Modal - 保存状態をリセット')
      }

      // すべての更新が完了したことを確認してからリロード
      if (trimmedName) {
        console.log('Modal - 最終確認開始')
        const finalCheck = await chrome.storage.local.get('parentCategories')
        const finalCategory = finalCheck.parentCategories?.find(
          (cat: ParentCategory) => cat.id === category.id,
        )

        if (finalCategory?.name !== trimmedName) {
          console.error('Modal - 最終確認でカテゴリ名が一致しません:', {
            expected: trimmedName,
            actual: finalCategory?.name,
          })
          throw new Error('カテゴリ名の更新が完了していません')
        }

        // すべての更新が確認できたら親コンポーネントに通知
        console.log('Modal - カテゴリ更新が完了しました')

        // 親コンポーネント側で状態を更新（onCategoryUpdateが既に呼ばれているため、ここでは何もしない）
        setLocalCategoryName(trimmedName)
        setIsRenaming(false)
      }
    } catch (error) {
      console.error('Modal - カテゴリ名の更新に失敗:', {
        error,
        categoryId: category.id,
        oldName: category.name,
        newName: trimmedName,
        isProcessing,
        stack: error instanceof Error ? error.stack : undefined,
      })
      toast.error('カテゴリ名の更新に失敗しました')
    } finally {
      console.log('Modal - 処理完了', {
        isProcessing,
        newCategoryName,
        localCategoryName,
      })
      setIsProcessing(false)
    }
  }

  // 親カテゴリ削除処理
  const handleDeleteCategory = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      const data = await chrome.storage.local.get('parentCategories')
      const parentCategories: ParentCategory[] = data.parentCategories ?? []
      const updatedCategories = parentCategories.filter(
        cat => cat.id !== category.id,
      )
      await chrome.storage.local.set({ parentCategories: updatedCategories })
      toast.success(`親カテゴリ「${category.name}」を削除しました`)
      onClose()
    } catch (error) {
      console.error('親カテゴリの削除に失敗しました:', error)
      toast.error('親カテゴリの削除に失敗しました')
    } finally {
      setIsProcessing(false)
    }
  }

  // ドメインをカテゴリに追加
  const handleAddDomain = async () => {
    if (!selectedDomain || isProcessing) return

    setIsProcessing(true)

    try {
      // 現在のデータを取得
      const { parentCategories = [] } =
        await chrome.storage.local.get('parentCategories')

      // 対象のカテゴリを検索
      const targetCategory = parentCategories.find(
        (cat: ParentCategory) => cat.id === category.id,
      )
      if (!targetCategory) {
        throw new Error('カテゴリが見つかりません')
      }

      // 選択されたドメインの情報を取得
      const selectedDomainInfo = availableDomains.find(
        d => d.id === selectedDomain,
      )
      if (!selectedDomainInfo) {
        throw new Error('ドメインが見つかりません')
      }

      // 重複チェック
      if (
        targetCategory.domains.includes(selectedDomain) ||
        targetCategory.domainNames.includes(selectedDomainInfo.domain)
      ) {
        throw new Error('このドメインは既にカテゴリに追加されています')
      }

      // カテゴリを更新
      const updatedCategories = parentCategories.map((cat: ParentCategory) => {
        if (cat.id === category.id) {
          return {
            ...cat,
            domains: [...cat.domains, selectedDomain],
            domainNames: [
              ...(cat.domainNames || []),
              selectedDomainInfo.domain,
            ],
          }
        }
        return cat
      })

      // 保存
      await chrome.storage.local.set({ parentCategories: updatedCategories })

      toast.success(
        `ドメイン「${selectedDomainInfo.domain}」をカテゴリ「${category.name}」に追加しました`,
      )

      // 追加したドメインをリストから削除
      const updatedAvailableDomains = availableDomains.filter(
        d => d.id !== selectedDomain,
      )
      setAvailableDomains(updatedAvailableDomains)

      // セレクトボックスをリセット
      if (updatedAvailableDomains.length > 0) {
        setSelectedDomain(updatedAvailableDomains[0].id)
      } else {
        setSelectedDomain('')
      }
    } catch (error) {
      console.error('ドメインの追加に失敗しました:', error)
      toast.error('ドメインの追加に失敗しました')
    } finally {
      setIsProcessing(false)
    }
  }

  // ドメインをカテゴリから削除
  const handleRemoveDomain = async (domainId: string) => {
    if (isProcessing) return

    setIsProcessing(true)

    try {
      // 現在のカテゴリデータを取得
      const { parentCategories = [] } =
        await chrome.storage.local.get('parentCategories')

      // 対象のカテゴリを検索
      const targetCategory = parentCategories.find(
        (cat: ParentCategory) => cat.id === category.id,
      )
      if (!targetCategory) {
        throw new Error('カテゴリが見つかりません')
      }

      // 削除するドメインの情報を取得
      const domainInfo = domains.find(d => d.id === domainId)
      if (!domainInfo) {
        throw new Error('ドメインが見つかりません')
      }

      // カテゴリを更新
      const updatedCategories = parentCategories.map((cat: ParentCategory) => {
        if (cat.id === category.id) {
          return {
            ...cat,
            domains: cat.domains.filter(d => d !== domainId),
            domainNames: (cat.domainNames || []).filter(
              d => d !== domainInfo.domain,
            ),
          }
        }
        return cat
      })

      // 保存
      await chrome.storage.local.set({ parentCategories: updatedCategories })

      // 削除したドメインをセレクトボックスに追加
      setAvailableDomains(prev => [
        ...prev,
        { id: domainInfo.id, domain: domainInfo.domain },
      ])

      toast.success(
        `ドメイン「${domainInfo.domain}」をカテゴリ「${category.name}」から削除しました`,
      )

      // ドメイン一覧を更新
      await loadAvailableDomains()
    } catch (error) {
      console.error('ドメインの削除に失敗しました:', error)
      toast.error('ドメインの削除に失敗しました')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        // 処理中またはリネームモード中は閉じない
        if (isProcessing || isRenaming || isSaving) {
          console.log('Modal - 処理中のためモーダルを閉じません')
          return
        }

        // リロード中は閉じない
        if (document.readyState === 'loading') {
          console.log('Modal - ページリロード中のためモーダルを閉じません')
          return
        }

        onClose()
      }}
    >
      <DialogContent className='max-h-[90vh] overflow-y-auto'>
        <DialogHeader className='text-left'>
          <DialogTitle>「{localCategoryName}」の親カテゴリ管理</DialogTitle>
        </DialogHeader>

        <div ref={modalContentRef} className='space-y-4'>
          {/* カテゴリ名変更セクション */}
          <div className='mb-4'>
            <div className='mb-2 flex items-center justify-between'>
              <Label>親カテゴリ名</Label>
              {!isRenaming && (
                <div className='flex items-center gap-2'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={handleStartRenaming}
                        className='flex cursor-pointer items-center gap-2 rounded px-2 py-1'
                      >
                        <Edit size={14} />
                        <span className='hidden lg:inline'>
                          親カテゴリ名を変更
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='top' className='block lg:hidden'>
                      親カテゴリ名を変更
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={() => setShowDeleteConfirm(true)}
                        className='flex cursor-pointer items-center gap-2 rounded px-2 py-1'
                        disabled={isProcessing}
                      >
                        <Trash2 size={14} />
                        <span className='hidden lg:inline'>
                          親カテゴリを削除
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side='top' className='block lg:hidden'>
                      親カテゴリを削除
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>

            {isRenaming ? (
              <div className='mt-2 w-full rounded border p-3'>
                <div className='mb-2 text-gray-300 text-sm'>
                  「{localCategoryName}」の新しい親カテゴリ名を入力してください
                </div>
                <Input
                  ref={inputRef}
                  value={newCategoryName}
                  onChange={handleCategoryNameChange}
                  placeholder='例: ビジネスツール、技術情報'
                  className={`w-full flex-1 rounded border p-2 ${categoryNameError ? 'border-red-500' : ''}`}
                  autoFocus
                  onBlur={() => {
                    if (isProcessing) {
                      return // 処理中は何もしない
                    }

                    const trimmedName = newCategoryName.trim()
                    if (
                      trimmedName &&
                      trimmedName !== localCategoryName &&
                      !categoryNameError
                    ) {
                      handleSaveRenaming()
                    } else if (categoryNameError) {
                      // エラーがある場合はフォーカスを維持
                      inputRef.current?.focus()
                    } else {
                      handleCancelRenaming()
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const trimmedName = newCategoryName.trim()
                      if (
                        trimmedName &&
                        trimmedName !== localCategoryName &&
                        !categoryNameError &&
                        !isProcessing
                      ) {
                        handleSaveRenaming()
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      handleCancelRenaming()
                    }
                  }}
                />
                {categoryNameError && (
                  <p className='mt-1 text-red-500 text-xs'>
                    {categoryNameError}
                  </p>
                )}
              </div>
            ) : (
              <button
                type='button'
                onClick={handleStartRenaming}
                className='flex w-full cursor-pointer justify-start rounded border bg-secondary/20 p-2'
              >
                {localCategoryName}
              </button>
            )}
          </div>
          {showDeleteConfirm && (
            <div className='mt-1 mb-3 rounded border p-3'>
              <p className='mb-2 text-gray-700 dark:text-gray-300'>
                親カテゴリ「{localCategoryName}
                」を削除しますか？この操作は取り消せません。
                {domains.length ? (
                  <span className='mt-1 block text-xs'>
                    このカテゴリには {domains.length}{' '}
                    件のドメインが関連付けられています。
                    削除すると、ドメインと親カテゴリの関連付けも削除されます。
                  </span>
                ) : null}
              </p>
              <div className='flex justify-end gap-2'>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isProcessing}
                    >
                      キャンセル
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top' className='block lg:hidden'>
                    キャンセル
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={handleDeleteCategory}
                      disabled={isProcessing}
                    >
                      <Trash size={14} />
                      <span className='hidden lg:inline'>削除</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top' className='block lg:hidden'>
                    親カテゴリを削除
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* 登録済みドメイン一覧 */}
          <div className='mb-4'>
            <Label className='mb-2 block'>登録済みドメイン</Label>
            <div className='flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded border p-2'>
              {domains.length === 0 ? (
                <p className='text-gray-500'>
                  登録されているドメインがありません
                </p>
              ) : (
                domains.map(domain => (
                  <Badge
                    key={domain.id}
                    variant='outline'
                    className='flex items-center gap-1 rounded px-2 py-1'
                  >
                    {domain.domain}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleRemoveDomain(domain.id)}
                          className='ml-1 cursor-pointer text-gray-400 hover:text-gray-200'
                          aria-label='ドメインを削除'
                          disabled={isProcessing}
                        >
                          <X size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side='top' className='block lg:hidden'>
                        削除
                      </TooltipContent>
                    </Tooltip>
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* ドメイン追加セクション */}
          <div className='mb-4'>
            <Label className='mb-2 block'>新しいドメインを追加</Label>
            {availableDomains.length > 0 ? (
              <div className='flex gap-2'>
                <Select
                  value={selectedDomain}
                  onValueChange={setSelectedDomain}
                  disabled={isProcessing}
                >
                  <SelectTrigger className='w-full cursor-pointer rounded border p-2'>
                    <SelectValue placeholder='カテゴリに追加するドメインを選択' />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDomains.map(domain => (
                      <SelectItem
                        key={domain.id}
                        value={domain.id}
                        className='cursor-pointer'
                      >
                        {domain.domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='default'
                      size='icon'
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!selectedDomain || isProcessing) return
                        handleAddDomain()
                      }}
                      className='cursor-pointer'
                      disabled={!selectedDomain || isProcessing}
                    >
                      <Plus size={18} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top' className='block lg:hidden'>
                    選択したドメインを親カテゴリに追加
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <p className='text-gray-500'>追加できるドメインがありません。</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
