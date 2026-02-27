import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  createParentCategory,
  deleteParentCategory,
  getParentCategories,
} from '@/lib/storage/categories'
import { assignDomainToCategory } from '@/lib/storage/migration'
import type { ParentCategory, TabGroup } from '@/types/storage'

/** カテゴリ名のバリデーションスキーマ */
const categoryNameSchema = z
  .string()
  .min(1, '新規親カテゴリ名を入力してください')
  .max(25, '新規親カテゴリ名は25文字以下にしてください')

/** useCategoryModal フックの引数 */
interface UseCategoryModalParams {
  /** タブグループ一覧 */
  tabGroups: TabGroup[]
}

type DomainCategoryMap = Record<string, { id: string; name: string } | null>

function buildDomainCategoriesMap(
  tabGroups: TabGroup[],
  parentCategories: ParentCategory[],
): DomainCategoryMap {
  const domainCategoriesMap: DomainCategoryMap = {}

  for (const group of tabGroups) {
    const foundCategory = parentCategories.find(category =>
      category.domainNames?.includes(group.domain),
    )
    domainCategoriesMap[group.id] = foundCategory
      ? { id: foundCategory.id, name: foundCategory.name }
      : null
  }

  return domainCategoriesMap
}

function clearCategoryFromDomainMap(
  currentMap: DomainCategoryMap,
  deletedCategoryId: string,
): DomainCategoryMap {
  const updatedMap: DomainCategoryMap = { ...currentMap }
  for (const groupId of Object.keys(updatedMap)) {
    if (updatedMap[groupId]?.id === deletedCategoryId) {
      updatedMap[groupId] = null
    }
  }
  return updatedMap
}

function applyDomainCategoryToggle(
  currentMap: DomainCategoryMap,
  domainId: string,
  selectedCategory: ParentCategory,
  selectedCategoryId: string,
  newChecked: boolean,
): DomainCategoryMap {
  const updated = { ...currentMap }
  if (newChecked) {
    updated[domainId] = {
      id: selectedCategory.id,
      name: selectedCategory.name,
    }
    return updated
  }
  if (updated[domainId]?.id === selectedCategoryId) {
    updated[domainId] = null
  }
  return updated
}

async function applyDomainSelectionChange(params: {
  domainId: string
  newChecked: boolean
  selectedCategoryId: string
  selectedCategory: ParentCategory
  domainCategories: DomainCategoryMap
  groupDomain: string
  setCategories: Dispatch<SetStateAction<ParentCategory[]>>
  setDomainCategories: Dispatch<SetStateAction<DomainCategoryMap>>
}) {
  const {
    domainId,
    newChecked,
    selectedCategoryId,
    selectedCategory,
    domainCategories,
    groupDomain,
    setCategories,
    setDomainCategories,
  } = params

  await assignDomainToCategory(
    domainId,
    newChecked ? selectedCategoryId : 'none',
  )

  const nextDomainCategories = applyDomainCategoryToggle(
    domainCategories,
    domainId,
    selectedCategory,
    selectedCategoryId,
    newChecked,
  )
  const updatedCategories = await getParentCategories()
  setCategories(updatedCategories)
  setDomainCategories(nextDomainCategories)

  toast.success(
    newChecked
      ? `ドメイン ${groupDomain} を「${selectedCategory.name}」に追加しました`
      : `ドメイン ${groupDomain} を「${selectedCategory.name}」から削除しました`,
    { duration: 1500 },
  )
}

/**
 * CategoryModal の状態ロジックを管理するカスタムフック
 * @param params フックの引数
 * @returns カテゴリ作成・選択・削除・ドメイン選択関連の状態と操作
 */
export function useCategoryModal({ tabGroups }: UseCategoryModalParams) {
  // --- 新規カテゴリ名状態 ---
  const [newCategoryName, setNewCategoryName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  // --- カテゴリリスト状態 ---
  const [categories, setCategories] = useState<ParentCategory[]>([])

  // --- 選択中のカテゴリID ---
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )

  // --- ドメイン選択状態 ---
  const [selectedDomains, setSelectedDomains] = useState<
    Record<string, boolean>
  >({})

  // --- ドメインの親カテゴリ情報 ---
  const [domainCategories, setDomainCategories] = useState<
    Record<string, { id: string; name: string } | null>
  >({})

  // --- 処理中状態 ---
  const [isLoading, setIsLoading] = useState(false)

  // --- 削除確認UI状態 ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [categoryToDelete, setCategoryToDelete] =
    useState<ParentCategory | null>(null)

  // --- ドメイン選択状態の更新 ---
  const updateSelectedDomains = useCallback(
    (category: ParentCategory | 'uncategorized') => {
      const newSelectedDomains: Record<string, boolean> = {}

      for (const group of tabGroups) {
        if (category === 'uncategorized') {
          newSelectedDomains[group.id] = !domainCategories[group.id]
        } else {
          const isDomainInCategory = category.domainNames?.includes(
            group.domain,
          )
          newSelectedDomains[group.id] = isDomainInCategory
        }
      }

      setSelectedDomains(newSelectedDomains)
    },
    [tabGroups, domainCategories],
  )

  // --- カテゴリリスト初期ロード ---
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const parentCategories = await getParentCategories()
        setCategories(parentCategories)
        setDomainCategories(
          buildDomainCategoriesMap(tabGroups, parentCategories),
        )

        if (parentCategories.length > 0) {
          setSelectedCategoryId(parentCategories[0].id)
          // updateSelectedDomainsは初期ロード後に別のeffectで実行
        }
      } catch (error) {
        console.error('カテゴリの取得に失敗しました', error)
        toast.error('カテゴリの読み込みに失敗しました')
      }
    }

    loadCategories()
  }, [tabGroups])

  // --- 選択カテゴリ変更時のドメイン選択更新 ---
  useEffect(() => {
    if (!selectedCategoryId) {
      return
    }

    const selectedCategory = categories.find(c => c.id === selectedCategoryId)
    if (selectedCategory) {
      updateSelectedDomains(selectedCategory)
    }
  }, [selectedCategoryId, categories, updateSelectedDomains])

  // --- カテゴリ選択ハンドラ ---
  const handleCategoryChange = useCallback(
    (value: string) => {
      if (value === 'uncategorized') {
        setSelectedCategoryId('uncategorized')
        updateSelectedDomains('uncategorized')
      } else {
        setSelectedCategoryId(value)
        const selectedCategory = categories.find(c => c.id === value)
        if (selectedCategory) {
          updateSelectedDomains(selectedCategory)
        }
      }
    },
    [categories, updateSelectedDomains],
  )

  // --- 新規カテゴリ作成ハンドラ ---
  const handleCreateCategory = useCallback(async () => {
    try {
      categoryNameSchema.parse(newCategoryName)
      setNameError(null)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues[0]?.message || 'カテゴリ名が無効です'
        setNameError(errorMessage)
        toast.error(errorMessage)
        return
      }
    }

    try {
      setIsLoading(true)
      const newCategory = await createParentCategory(newCategoryName)
      setCategories(prev => [...prev, newCategory])
      setSelectedCategoryId(newCategory.id)
      setNewCategoryName('')
      toast.success('カテゴリを作成しました')

      updateSelectedDomains(newCategory)
    } catch (error) {
      console.error('カテゴリの作成に失敗しました', error)

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
  }, [newCategoryName, updateSelectedDomains])

  // --- 入力フィールド変更ハンドラ ---
  const handleCategoryNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setNewCategoryName(value)

      try {
        categoryNameSchema.parse(value)
        setNameError(null)
      } catch (error) {
        if (error instanceof z.ZodError) {
          setNameError(error.issues[0]?.message || 'カテゴリ名が無効です')
        }
      }
    },
    [],
  )

  // --- エンターキーハンドラ ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (newCategoryName.trim() && !nameError && !isLoading) {
          handleCreateCategory()
        }
      }
    },
    [newCategoryName, nameError, isLoading, handleCreateCategory],
  )

  // --- フォーカスアウトハンドラ ---
  const handleBlur = useCallback(() => {
    if (newCategoryName.trim() && !nameError && !isLoading) {
      handleCreateCategory()
    }
  }, [newCategoryName, nameError, isLoading, handleCreateCategory])

  // --- カテゴリ削除ハンドラ ---
  const handleDeleteCategory = useCallback(async () => {
    if (!categoryToDelete) {
      return
    }

    try {
      setIsLoading(true)
      await deleteParentCategory(categoryToDelete.id)

      const updatedCategories = categories.filter(
        c => c.id !== categoryToDelete.id,
      )
      setCategories(updatedCategories)

      const updatedDomainCategories = clearCategoryFromDomainMap(
        domainCategories,
        categoryToDelete.id,
      )
      setDomainCategories(updatedDomainCategories)

      if (selectedCategoryId === categoryToDelete.id) {
        setSelectedCategoryId(
          updatedCategories.length > 0 ? updatedCategories[0].id : null,
        )

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
      setShowDeleteConfirm(false)
    }
  }, [
    categoryToDelete,
    categories,
    domainCategories,
    selectedCategoryId,
    updateSelectedDomains,
  ])

  // --- 削除ボタンクリック ---
  const handleDeleteClick = useCallback(() => {
    const target = categories.find(c => c.id === selectedCategoryId)
    if (!target) {
      toast.error('削除するカテゴリが選択されていません')
      return
    }

    setCategoryToDelete(target)
    setShowDeleteConfirm(true)
  }, [categories, selectedCategoryId])

  // --- ドメイン選択切り替え ---
  const toggleDomainSelection = useCallback(
    (domainId: string) => {
      const previousChecked = selectedDomains[domainId]
      const rollbackSelection = () =>
        setSelectedDomains(prev => ({
          ...prev,
          [domainId]: previousChecked,
        }))
      const newChecked = !previousChecked

      setSelectedDomains(prev => ({
        ...prev,
        [domainId]: newChecked,
      }))

      if (!selectedCategoryId) {
        return
      }

      const group = tabGroups.find(g => g.id === domainId)
      if (!group) {
        rollbackSelection()
        return
      }

      if (selectedCategoryId === 'uncategorized') {
        if (newChecked) {
          rollbackSelection()
          toast.error(
            '未分類カテゴリでは直接操作できません。カテゴリを選択してください。',
          )
        }
        return
      }

      const selectedCategory = categories.find(c => c.id === selectedCategoryId)
      if (!selectedCategory) {
        rollbackSelection()
        return
      }

      setIsLoading(true)
      void applyDomainSelectionChange({
        domainId,
        newChecked,
        selectedCategoryId,
        selectedCategory,
        domainCategories,
        groupDomain: group.domain,
        setCategories,
        setDomainCategories,
      })
        .catch(error => {
          console.error('カテゴリの設定に失敗しました:', error)
          toast.error('カテゴリの設定に失敗しました')
          rollbackSelection()
        })
        .finally(() => {
          setIsLoading(false)
        })
    },
    [
      selectedDomains,
      selectedCategoryId,
      tabGroups,
      domainCategories,
      categories,
    ],
  )

  return {
    /** カテゴリ作成関連 */
    create: {
      newCategoryName,
      nameError,
      handleCategoryNameChange,
      handleKeyDown,
      handleBlur,
      handleCreateCategory,
    },
    /** カテゴリ選択関連 */
    selection: {
      categories,
      selectedCategoryId,
      handleCategoryChange,
    },
    /** 削除関連 */
    deletion: {
      showDeleteConfirm,
      setShowDeleteConfirm,
      categoryToDelete,
      handleDeleteClick,
      handleDeleteCategory,
    },
    /** ドメイン選択関連 */
    domains: {
      selectedDomains,
      domainCategories,
      toggleDomainSelection,
    },
    /** 処理中状態 */
    isLoading,
  }
}
