import { useEffect, useState } from 'react'
import { z } from 'zod/v3'
import {
  getChromeStorageOnChanged,
  warnMissingChromeStorage,
} from '@/lib/browser/chrome-storage'
import {
  createParentCategory,
  getParentCategories,
} from '@/lib/storage/categories'
import type { ParentCategory } from '@/types/storage'

// Zodによるカテゴリ名のバリデーションスキーマを定義
const categoryNameSchema = z
  .string()
  .max(25, 'カテゴリ名は25文字以下にしてください')

export const useCategories = () => {
  const [parentCategories, setParentCategories] = useState<ParentCategory[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState<string | null>(null) // エラーメッセージ用の状態変数

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await getParentCategories()
        setParentCategories(categories)
      } catch (error) {
        console.error('カテゴリの読み込みエラー:', error)
      }
    }

    loadCategories()

    const storageChangeListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === 'local') {
        if (changes.parentCategories) {
          const nextParentCategories = Array.isArray(
            changes.parentCategories.newValue,
          )
            ? (changes.parentCategories.newValue as ParentCategory[])
            : []
          setParentCategories(nextParentCategories)
        }
      }
    }

    const storageOnChanged = getChromeStorageOnChanged()
    if (!storageOnChanged) {
      warnMissingChromeStorage('カテゴリ変更監視')
      return
    }

    storageOnChanged.addListener(storageChangeListener)

    return () => {
      storageOnChanged.removeListener(storageChangeListener)
    }
  }, [])

  // 新しいカテゴリを追加
  const handleAddCategory = async () => {
    if (newCategoryName.trim()) {
      // バリデーションチェック
      const validationResult = categoryNameSchema.safeParse(
        newCategoryName.trim(),
      )
      if (!validationResult.success) {
        setCategoryError(validationResult.error.errors[0].message)
        setTimeout(() => setCategoryError(null), 3000)
        return false
      }

      // 重複をチェック
      const isDuplicate = parentCategories.some(
        cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase(),
      )

      if (isDuplicate) {
        setCategoryError('同じ名前のカテゴリがすでに存在します。')
        setTimeout(() => setCategoryError(null), 3000) // 3秒後にエラーメッセージを消す
        return false
      }

      try {
        await createParentCategory(newCategoryName.trim())
        setNewCategoryName('')
        setCategoryError(null)
        return true
      } catch (error) {
        console.error('カテゴリ追加エラー:', error)
        setCategoryError('カテゴリの追加に失敗しました。')
        setTimeout(() => setCategoryError(null), 3000)
        return false
      }
    }
    return false
  }

  // Enterキーを押したときのハンドラ
  const handleCategoryKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // エラーがなければ追加を実行
      if (!categoryError) {
        handleAddCategory()
      }
    }
  }

  return {
    parentCategories,
    newCategoryName,
    setNewCategoryName,
    categoryError,
    setCategoryError,
    handleAddCategory,
    handleCategoryKeyDown,
  }
}
