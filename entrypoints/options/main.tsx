import '@/assets/global.css'
// lucide-reactからアイコンをインポート - AlertTriangleを追加
import { AlertTriangle, Check, Edit, Plus, Trash, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { z } from 'zod'
import { getUserSettings, saveUserSettings } from '../../utils/storage'
import type {
  ParentCategory,
  TabGroup,
  UserSettings,
} from '../../utils/storage'
import {
  createParentCategory,
  defaultSettings,
  getParentCategories,
  saveParentCategories,
  setCategoryKeywords,
} from '../../utils/storage'

// UIコンポーネントのインポート
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox' // Switchの代わりにCheckboxをインポート
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area' // ScrollAreaを追加
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
// トースト通知用のインポート
import { toast } from 'sonner'

import { ImportExportSettings } from '@/features/options/ImportExportSettings'
import { SubCategoryKeywordManager } from '@/features/options/SubCategoryKeywordManager'
import { isPeriodShortening } from '@/utils/isPeriodShortening'

// Zodによるカテゴリ名のバリデーションスキーマを定義
const categoryNameSchema = z
  .string()
  .max(25, 'カテゴリ名は25文字以下にしてください')

const OptionsPage = () => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [parentCategories, setParentCategories] = useState<ParentCategory[]>([])
  const [savedTabs, setSavedTabs] = useState<TabGroup[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState<string | null>(null) // エラーメッセージ用の状態変数
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  )
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  // 保留中の自動削除期間設定用の状態変数を修正 - 初期値をnullからundefinedに変更
  const [pendingAutoDeletePeriod, setPendingAutoDeletePeriod] = useState<
    string | undefined
  >(undefined)
  const [editingCategoryError, setEditingCategoryError] = useState<
    string | null
  >(null) // エディットモード用エラー状態

  // 確認ステップの状態を追加
  const [confirmationState, setConfirmationState] = useState<{
    isVisible: boolean
    message: string
    onConfirm: () => void
    pendingAction: string
  }>({
    isVisible: false,
    message: '',
    onConfirm: () => {},
    pendingAction: '',
  })

  // クリック挙動オプション定義
  const clickBehaviorOptions = [
    { value: 'saveCurrentTab', label: '現在のタブを保存' },
    { value: 'saveWindowTabs', label: 'ウィンドウのすべてのタブを保存' },
    {
      value: 'saveSameDomainTabs',
      label: '現在開いているドメインのタブをすべて保存',
    },
    {
      value: 'saveAllWindowsTabs',
      label: '他のウィンドウを含めすべてのタブを保存',
    },
  ]

  // クリック挙動設定変更ハンドラ
  const handleClickBehaviorChange = async (value: string) => {
    try {
      const newSettings = {
        ...settings,
        clickBehavior: value as UserSettings['clickBehavior'],
      }

      // 状態を更新
      setSettings(newSettings)

      // 設定を保存
      await saveUserSettings(newSettings)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('クリック挙動設定の保存エラー:', error)
    }
  }

  // 固定タブ除外設定の切り替えハンドラを追加
  const handleToggleExcludePinnedTabs = async (checked: boolean) => {
    try {
      // 新しい設定を作成
      const newSettings = {
        ...settings,
        excludePinnedTabs: checked,
      }

      // 状態を更新
      setSettings(newSettings)

      // 保存
      await saveUserSettings(newSettings)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('固定タブ除外設定の保存エラー:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const userSettings = await getUserSettings()
        setSettings(userSettings)

        const categories = await getParentCategories()
        setParentCategories(categories)

        const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
        setSavedTabs(savedTabs)
      } catch (error) {
        console.error('設定の読み込みエラー:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // ストレージが変更されたときに再読み込み
    chrome.storage.onChanged.addListener(changes => {
      if (changes.userSettings) {
        setSettings(prev => ({ ...prev, ...changes.userSettings.newValue }))
      }
      if (changes.parentCategories) {
        setParentCategories(changes.parentCategories.newValue || [])
      }
      if (changes.savedTabs) {
        setSavedTabs(changes.savedTabs.newValue || [])
      }
    })
  }, [])

  const handleSaveSettings = async () => {
    try {
      // 保存する前に空の行を除外
      const cleanSettings = {
        ...settings,
        excludePatterns: settings.excludePatterns.filter(p => p.trim()),
      }
      await saveUserSettings(cleanSettings)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('設定の保存エラー:', error)
    }
  }

  // Checkbox用にハンドラを修正 - 非同期関数に変更
  const handleToggleRemoveAfterOpen = async (checked: boolean) => {
    try {
      // 新しい設定を作成
      const newSettings = {
        ...settings,
        removeTabAfterOpen: checked,
      }

      // 状態を更新
      setSettings(newSettings)

      // 空の行を除外して保存
      const cleanSettings = {
        ...newSettings,
        excludePatterns: newSettings.excludePatterns.filter(p => p.trim()),
      }

      // 直接保存
      await saveUserSettings(cleanSettings)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('設定の保存エラー:', error)
    }
  }

  // 保存日時表示設定の切り替えハンドラを追加
  const handleToggleShowSavedTime = async (checked: boolean) => {
    try {
      // 新しい設定を作成
      const newSettings = {
        ...settings,
        showSavedTime: checked,
      }

      // 状態を更新
      setSettings(newSettings)

      // 保存
      await saveUserSettings(newSettings)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('保存日時表示設定の保存エラー:', error)
    }
  }

  // URLを別タブで開く設定の切り替えハンドラを追加
  const handleToggleOpenUrlInBackground = async (checked: boolean) => {
    try {
      const newSettings = {
        ...settings,
        openUrlInBackground: checked,
      }
      setSettings(newSettings)
      await saveUserSettings(newSettings)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('URLを別タブで開く設定の保存エラー:', error)
    }
  }

  // 「すべてのタブを開く」を新しいウィンドウで開く設定の切り替えハンドラを追加
  const handleToggleOpenAllInNewWindow = async (checked: boolean) => {
    try {
      const newSettings = { ...settings, openAllInNewWindow: checked }
      setSettings(newSettings)
      await saveUserSettings(newSettings)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error(
        '「すべてのタブを開く」を新しいウィンドウで開く設定の保存エラー:',
        error,
      )
    }
  }

  // 追加: URL削除前確認設定の切替ハンドラ
  const handleToggleConfirmDeleteEach = async (checked: boolean) => {
    try {
      const newSettings = { ...settings, confirmDeleteEach: checked }
      setSettings(newSettings)
      await saveUserSettings(newSettings)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('URL削除前確認設定の保存エラー:', error)
    }
  }

  // 追加: すべて削除前確認設定の切替ハンドラ
  const handleToggleConfirmDeleteAll = async (checked: boolean) => {
    try {
      const newSettings = { ...settings, confirmDeleteAll: checked }
      setSettings(newSettings)
      await saveUserSettings(newSettings)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('すべて削除前確認設定の保存エラー:', error)
    }
  }

  const handleExcludePatternsChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    // 空の行も含めて全ての行を保持
    const patterns = e.target.value.split('\n')
    setSettings(prev => ({
      ...prev,
      excludePatterns: patterns,
    }))
  }

  // テキストエリアからフォーカスが外れたときに保存
  const handleExcludePatternsBlur = () => {
    handleSaveSettings()
  }

  // カテゴリ名のバリデーションと設定を行う関数
  const validateAndSetCategoryName = (value: string) => {
    try {
      categoryNameSchema.parse(value)
      setNewCategoryName(value)
      setCategoryError(null)
    } catch (error) {
      if (error instanceof z.ZodError) {
        setCategoryError(error.errors[0].message)
        // 入力値はエラーがあっても保持する（UIフィードバック用）
        setNewCategoryName(value)
      }
    }
  }

  // 新しいカテゴリを追加
  const handleAddCategory = async () => {
    if (newCategoryName.trim()) {
      // バリデーションチェック
      try {
        categoryNameSchema.parse(newCategoryName.trim())
      } catch (error) {
        if (error instanceof z.ZodError) {
          setCategoryError(error.errors[0].message)
          setTimeout(() => setCategoryError(null), 3000)
          return
        }
      }

      // 重複をチェック
      const isDuplicate = parentCategories.some(
        cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase(),
      )

      if (isDuplicate) {
        setCategoryError('同じ名前のカテゴリがすでに存在します。')
        setTimeout(() => setCategoryError(null), 3000) // 3秒後にエラーメッセージを消す
        return
      }

      try {
        await createParentCategory(newCategoryName.trim())
        setNewCategoryName('')
        setCategoryError(null)
      } catch (error) {
        console.error('カテゴリ追加エラー:', error)
        setCategoryError('カテゴリの追加に失敗しました。')
        setTimeout(() => setCategoryError(null), 3000)
      }
    }
  }

  // Enterキーを押したときのハンドラ
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    // テキストエリアの場合は元の処理を維持
    if (e.currentTarget.tagName.toLowerCase() === 'textarea') {
      if (e.key === 'Enter') {
        e.stopPropagation()
      }
    }
    // カテゴリ入力の場合
    else if (e.key === 'Enter') {
      e.preventDefault()
      // エラーがなければ追加を実行
      if (!categoryError) {
        handleAddCategory()
      }
    }
  }

  // 編集中のカテゴリ名のバリデーション関数
  const validateAndSetEditingCategoryName = (value: string) => {
    try {
      categoryNameSchema.parse(value)
      setEditingCategoryName(value)
      setEditingCategoryError(null)
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEditingCategoryError(error.errors[0].message)
        // 入力値はエラーがあっても保持する（UIフィードバック用）
        setEditingCategoryName(value)
      }
    }
  }

  // カテゴリ名の編集を開始
  const startEditingCategory = (category: ParentCategory) => {
    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
    setEditingCategoryError(null) // エラー状態をリセット

    // 編集モードに入った直後に実行される
    setTimeout(() => {
      editInputRef.current?.focus()
    }, 0)
  }

  // カテゴリ名の編集を保存
  const saveEditingCategory = async () => {
    if (editingCategoryId && editingCategoryName.trim()) {
      // バリデーションチェック
      try {
        categoryNameSchema.parse(editingCategoryName.trim())
      } catch (error) {
        if (error instanceof z.ZodError) {
          setEditingCategoryError(error.errors[0].message)
          return // エラーがあれば保存しない
        }
      }

      const updatedCategories = parentCategories.map(cat =>
        cat.id === editingCategoryId
          ? { ...cat, name: editingCategoryName.trim() }
          : cat,
      )

      try {
        await saveParentCategories(updatedCategories)
        setEditingCategoryId(null)
        setEditingCategoryName('')
        setEditingCategoryError(null)

        // 保存成功通知
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
      } catch (error) {
        console.error('カテゴリ編集エラー:', error)
        alert('カテゴリの保存に失敗しました')
      }
    } else {
      // 空の場合は編集をキャンセル
      setEditingCategoryId(null)
      setEditingCategoryError(null)
    }
  }

  // ドメインをカテゴリに割り当て関数を改善
  const assignDomainToCategory = async (
    domainId: string,
    categoryId: string | 'none',
  ) => {
    console.log(`ドメイン割り当て: ID=${domainId}, カテゴリ=${categoryId}`)

    try {
      // 即時のUI更新のための処理
      // 1. UIの状態を先に更新して即時反映
      const uiUpdatedCategories = parentCategories.map(category => ({
        ...category,
        domains: category.domains.filter(id => id !== domainId),
      }))

      if (categoryId !== 'none') {
        const categoryIndex = uiUpdatedCategories.findIndex(
          cat => cat.id === categoryId,
        )
        if (categoryIndex !== -1) {
          uiUpdatedCategories[categoryIndex] = {
            ...uiUpdatedCategories[categoryIndex],
            domains: [...uiUpdatedCategories[categoryIndex].domains, domainId],
          }
        }
      }

      // UIの表示を即時更新
      setParentCategories(uiUpdatedCategories)

      // Tab.parentCategoryIdも即時更新
      const uiUpdatedTabs = savedTabs.map(tab =>
        tab.id === domainId
          ? {
              ...tab,
              parentCategoryId: categoryId !== 'none' ? categoryId : undefined,
            }
          : tab,
      )
      setSavedTabs(uiUpdatedTabs)

      // 2. バックグラウンドでストレージ保存を実行
      // セレクトボックスのクローズを待つためにわずかな遅延を入れる
      setTimeout(async () => {
        try {
          // ストレージへの保存
          await saveParentCategories(uiUpdatedCategories)
          await chrome.storage.local.set({ savedTabs: uiUpdatedTabs })
          console.log(
            `ドメイン ${domainId} のカテゴリを ${categoryId} に変更完了`,
          )
        } catch (storageError) {
          console.error('ストレージ保存エラー:', storageError)
          alert('変更の保存中にエラーが発生しました。')
        }
      }, 50) // 50ミリ秒の最小限の遅延
    } catch (error) {
      console.error('ドメイン割り当てエラー:', error)
      alert('ドメインの割り当てに失敗しました。')
    }
  }

  // 単純なカテゴリ削除関数 - 確認ダイアログなし
  const forceDeleteCategory = async (categoryId: string) => {
    try {
      console.log('強制削除を実行:', categoryId)

      // chrome.storage.localから直接取得
      const { parentCategories: storedCategories = [] } =
        await chrome.storage.local.get('parentCategories')

      // カテゴリを削除
      const newCategories = storedCategories.filter(
        (cat: ParentCategory) => cat.id !== categoryId,
      )

      console.log('削除前カテゴリ数:', storedCategories.length)
      console.log('削除後カテゴリ数:', newCategories.length)

      // ストレージに直接保存
      await chrome.storage.local.set({ parentCategories: newCategories })

      // タブの参照も更新
      const { savedTabs: storedTabs = [] } =
        await chrome.storage.local.get('savedTabs')
      const newTabs = storedTabs.map((tab: TabGroup) =>
        tab.parentCategoryId === categoryId
          ? { ...tab, parentCategoryId: undefined }
          : tab,
      )

      await chrome.storage.local.set({ savedTabs: newTabs })

      // React状態を更新
      setParentCategories(newCategories)
      setSavedTabs(newTabs)

      // 成功メッセージ
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)

      return true
    } catch (error) {
      console.error('強制削除エラー:', error)
      return false
    }
  }

  // 自動削除期間の説明テキスト
  const autoDeleteOptions = [
    { value: 'never', label: '自動削除しない' },
    { value: '1hour', label: '1時間' },
    { value: '1day', label: '1日' },
    { value: '7days', label: '7日' },
    { value: '14days', label: '14日' },
    { value: '30days', label: '30日' },
    { value: '180days', label: '6ヶ月' },
    { value: '365days', label: '1年' },
  ]

  // 自動削除期間選択時の処理
  const handleAutoDeletePeriodChange = (value: string) => {
    console.log(`自動削除期間を選択: ${value}`)
    // 選択した値を一時保存
    setPendingAutoDeletePeriod(value)

    // 確認表示を非表示にする
    hideConfirmation()
  }

  // 確認表示を隠す
  const hideConfirmation = () => {
    setConfirmationState(prev => ({
      ...prev,
      isVisible: false,
    }))
  }

  // 確認表示を表示する
  const showConfirmation = (
    message: string,
    onConfirm: () => void,
    pendingAction: string,
  ) => {
    setConfirmationState({
      isVisible: true,
      message,
      onConfirm,
      pendingAction,
    })
  }

  // 自動削除期間を確定して保存する処理の前に確認を表示
  const prepareAutoDeletePeriod = () => {
    console.log('自動削除期間設定ボタンが押されました')

    // 保留中の設定がなければ、現在の設定値を使用
    const periodToApply = pendingAutoDeletePeriod ?? settings.autoDeletePeriod

    if (!periodToApply) return

    // 「自動削除しない」の場合は確認なしで直接適用
    if (periodToApply === 'never') {
      applyAutoDeletePeriod()
      return
    }

    // 選択した期間のラベルを取得
    const selectedOption = autoDeleteOptions.find(
      opt => opt.value === periodToApply,
    )
    const periodLabel = selectedOption ? selectedOption.label : periodToApply

    // 警告メッセージを作成
    const currentPeriod = settings.autoDeletePeriod || 'never'
    const isShortening = isPeriodShortening(currentPeriod, periodToApply)
    const warningMessage = isShortening
      ? '警告: 現在よりも短い期間に設定するため、一部のタブがすぐに削除される可能性があります！'
      : '注意: 設定した期間より古いタブはすぐに削除される可能性があります。'

    // 確認メッセージを表示
    const message = `自動削除期間を「${periodLabel}」に設定します。\n\n${warningMessage}\n\n続行しますか？`

    // 確認を表示
    showConfirmation(message, applyAutoDeletePeriod, periodToApply)
  }

  // 実際の適用処理（確認後に実行）
  const applyAutoDeletePeriod = () => {
    const periodToApply = pendingAutoDeletePeriod ?? settings.autoDeletePeriod

    if (!periodToApply) return

    try {
      console.log(`自動削除期間を設定: ${periodToApply}`)

      const newSettings = {
        ...settings,
        autoDeletePeriod: periodToApply,
      }

      // ストレージに直接保存
      chrome.storage.local.set({ userSettings: newSettings }, () => {
        console.log('設定を保存しました:', newSettings)

        // UI状態を更新
        setSettings(newSettings)
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)

        // トースト通知を表示
        if (periodToApply === 'never') {
          toast.success('自動削除を無効にしました')
        } else {
          const selectedOption = autoDeleteOptions.find(
            opt => opt.value === periodToApply,
          )
          const periodLabel = selectedOption
            ? selectedOption.label
            : periodToApply
          toast.success(`自動削除期間を「${periodLabel}」に設定しました`)
        }

        // バックグラウンドに通知
        const needsTimestampUpdate =
          periodToApply === '30sec' || periodToApply === '1min'
        chrome.runtime.sendMessage(
          {
            action: 'checkExpiredTabs',
            updateTimestamps: needsTimestampUpdate,
            period: periodToApply,
            forceReload: true,
          },
          response => console.log('応答:', response),
        )
      })

      // 確認を非表示
      hideConfirmation()

      // 保留中の設定をクリア
      setPendingAutoDeletePeriod(undefined)
    } catch (error) {
      console.error('自動削除期間の保存エラー:', error)
      // エラー時のトースト通知
      toast.error('設定の保存に失敗しました')
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[300px]'>
        <div className='text-xl text-foreground'>読み込み中...</div>
      </div>
    )
  }

  return (
    <div className='mx-auto pt-10 bg-background min-h-screen'>
      {/* Toasterコンポーネントを追加 */}
      <Toaster position='top-right' />

      <header className='flex justify-between items-center mb-8 px-6'>
        <h1 className='text-3xl font-bold text-foreground'>オプション</h1>

        {/* テスト用の30秒設定ボタン - 確認表示するように変更 */}
        <div className='flex gap-2 items-center'>
          <ModeToggle />
        </div>
      </header>

      {/* インポート/エクスポート設定セクションを追加 */}
      <div className='bg-card rounded-lg shadow-md p-6 mb-8 border border-border'>
        <h2 className='text-xl font-semibold text-foreground mb-4'>
          バックアップと復元
        </h2>
        <ImportExportSettings />
      </div>

      <div className='bg-card rounded-lg shadow-md p-6 mb-8 border border-border'>
        <h2 className='text-xl font-semibold text-foreground mb-4'>
          タブの挙動設定
        </h2>

        {/* クリック挙動設定を追加 */}
        <div className='mb-6'>
          <Label
            htmlFor='click-behavior'
            className='block text-foreground font-medium mb-2'
          >
            拡張機能ボタンをクリックした時の挙動
          </Label>
          <div className='space-y-2'>
            <Select
              value={settings.clickBehavior || 'saveWindowTabs'}
              onValueChange={handleClickBehaviorChange}
            >
              <SelectTrigger
                id='click-behavior'
                className='w-full bg-background'
              >
                <SelectValue placeholder='クリック時の挙動を選択' />
              </SelectTrigger>
              <SelectContent>
                {clickBehaviorOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className='text-sm text-muted-foreground mt-2'>
            拡張機能のアイコンをクリックした時の動作を設定します。
          </p>
        </div>

        <div className='mb-4 flex items-center space-x-2'>
          <Checkbox
            id='remove-after-open'
            checked={settings.removeTabAfterOpen}
            onCheckedChange={handleToggleRemoveAfterOpen}
            className='cursor-pointer'
          />
          <Label
            htmlFor='remove-after-open'
            className='text-foreground cursor-pointer'
          >
            保存したタブを開いた後、リストから自動的に削除する
          </Label>
        </div>
        <p className='text-sm text-muted-foreground mt-1 ml-7'>
          オンにすると、保存したタブを開いた後、そのタブは保存リストから自動的に削除されます。
          オフにすると、保存したタブを開いても、リストからは削除されません。
        </p>

        {/* 固定タブを除外するオプションを追加 */}
        <div className='mb-4 mt-6 flex items-center space-x-2'>
          <Checkbox
            id='exclude-pinned-tabs'
            checked={settings.excludePinnedTabs}
            onCheckedChange={handleToggleExcludePinnedTabs}
            className='cursor-pointer'
          />
          <Label
            htmlFor='exclude-pinned-tabs'
            className='text-foreground cursor-pointer'
          >
            固定タブ（ピン留め）を除外する
          </Label>
        </div>
        <p className='text-sm text-muted-foreground mt-1 ml-7'>
          オンにすると、ピン留めされたタブは保存対象から除外されます。
        </p>

        {/* URLを別タブで開く設定を追加 */}
        <div className='mb-4 mt-6 flex items-center space-x-2'>
          <Checkbox
            id='open-url-in-blank'
            checked={settings.openUrlInBackground}
            onCheckedChange={handleToggleOpenUrlInBackground}
            className='cursor-pointer'
          />
          <Label
            htmlFor='open-url-in-blank'
            className='text-foreground cursor-pointer'
          >
            バックグラウンドタブで開く
          </Label>
        </div>
        <p className='text-sm text-muted-foreground mt-1 ml-7'>
          オンにすると、URLをバックグラウンドで開きます。
        </p>

        {/* 「すべてのタブを開く」を新しいウィンドウで開く設定を追加 */}
        <div className='mb-4 mt-6 flex items-center space-x-2'>
          <Checkbox
            id='open-all-in-new-window'
            checked={settings.openAllInNewWindow}
            onCheckedChange={handleToggleOpenAllInNewWindow}
            className='cursor-pointer'
          />
          <Label
            htmlFor='open-all-in-new-window'
            className='text-foreground cursor-pointer'
          >
            すべてのタブを新しいウィンドウで開く
          </Label>
        </div>
        <p className='text-sm text-muted-foreground mt-1 ml-7'>
          オンにすると、「すべて開く」ボタンで新しいウィンドウを作成し、タブを開きます。
        </p>

        {/* 保存日時表示設定を追加 */}
        <div className='mb-4 mt-6 flex items-center space-x-2'>
          <Checkbox
            id='show-saved-time'
            checked={settings.showSavedTime}
            onCheckedChange={handleToggleShowSavedTime}
            className='cursor-pointer'
          />
          <Label
            htmlFor='show-saved-time'
            className='text-foreground cursor-pointer'
          >
            保存日時を表示する
          </Label>
        </div>
        <p className='text-sm text-muted-foreground mt-1 ml-7'>
          オンにすると、保存タブ一覧に保存された日時が表示されます。
        </p>

        {/* 削除時の確認オプション */}
        <div className='mb-4 mt-6 flex items-center space-x-2'>
          <Checkbox
            id='confirm-delete-each'
            checked={settings.confirmDeleteEach}
            onCheckedChange={handleToggleConfirmDeleteEach}
            className='cursor-pointer'
          />
          <Label
            htmlFor='confirm-delete-each'
            className='text-foreground cursor-pointer'
          >
            URL削除前に確認する
          </Label>
        </div>
        <p className='text-sm text-muted-foreground mt-1 ml-7'>
          オンにすると、URLを削除する前に確認ダイアログを表示します。
        </p>

        <div className='mb-4 mt-6 flex items-center space-x-2'>
          <Checkbox
            id='confirm-delete-all'
            checked={settings.confirmDeleteAll}
            onCheckedChange={handleToggleConfirmDeleteAll}
            className='cursor-pointer'
          />
          <Label
            htmlFor='confirm-delete-all'
            className='text-foreground cursor-pointer'
          >
            すべて削除前に確認する
          </Label>
        </div>
        <p className='text-sm text-muted-foreground mt-1 ml-7'>
          オンにすると、カテゴリごとにすべてのタブを削除する前に確認ダイアログを表示します。
        </p>

        {/* 自動削除期間設定を修正 */}
        <div className='mt-6 mb-4'>
          <Label
            htmlFor='auto-delete-period'
            className='block text-foreground font-medium mb-2'
          >
            タブの自動削除期間
          </Label>
          <div className='flex items-center gap-2'>
            <Select
              value={
                pendingAutoDeletePeriod ?? settings.autoDeletePeriod ?? 'never'
              }
              onValueChange={handleAutoDeletePeriodChange}
            >
              <SelectTrigger id='auto-delete-period' className='w-full'>
                <SelectValue placeholder='自動削除しない' />
              </SelectTrigger>
              <SelectContent
                onPointerDownOutside={e => {
                  e.preventDefault()
                }}
                className='p-0'
              >
                <ScrollArea className='h-[120px]'>
                  <div className='p-1'>
                    {autoDeleteOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </div>
                </ScrollArea>
              </SelectContent>
            </Select>

            {/* 確認表示を追加 */}
            <Button
              type='button'
              variant='outline'
              onClick={prepareAutoDeletePeriod}
            >
              設定する
            </Button>
          </div>

          {/* 確認表示 */}
          {confirmationState.isVisible && (
            <div className='mt-3 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md'>
              <div className='flex flex-col gap-3'>
                <div className='flex items-start'>
                  <div className='flex-shrink-0 text-yellow-500'>
                    <AlertTriangle size={24} />{' '}
                    {/* lucide-reactのアイコンに置き換え */}
                  </div>
                  <p className='ml-3 text-sm text-foreground whitespace-pre-line'>
                    {confirmationState.message}
                  </p>
                </div>

                <div className='flex justify-end gap-2'>
                  <Button
                    type='button'
                    variant='ghost'
                    onClick={hideConfirmation}
                  >
                    キャンセル
                  </Button>
                  <Button type='button' onClick={confirmationState.onConfirm}>
                    確定
                  </Button>
                </div>
              </div>
            </div>
          )}

          <p className='text-sm text-muted-foreground mt-2'>
            保存されたタブが指定した期間を超えると自動的に削除されます。
            設定を適用すると、その時点で期限切れのタブは削除されますのでご注意ください。
          </p>
        </div>
      </div>

      <div className='bg-card rounded-lg shadow-md p-6 mb-8 border border-border'>
        <h2 className='text-xl font-semibold text-foreground mb-4'>除外設定</h2>
        <div className='mb-4'>
          <Label
            htmlFor='excludePatterns'
            className='block text-foreground mb-2'
          >
            保存・閉じない URL パターン（1行に1つ）
          </Label>
          <Textarea
            id='excludePatterns'
            value={settings.excludePatterns.join('\n')}
            onChange={handleExcludePatternsChange}
            onBlur={handleExcludePatternsBlur}
            onKeyDown={handleKeyDown}
            className='w-full h-32 p-2 border border-input bg-background text-foreground rounded focus:ring-2 focus:ring-ring'
            placeholder='例：&#10;chrome-extension://&#10;chrome://'
          />
          <p className='text-sm text-muted-foreground mt-1'>
            これらのパターンに一致するURLは保存されず、タブも閉じられません。
          </p>
        </div>
      </div>
      {/* お問い合わせボタン */}
      <div className='text-center mt-4'>
        <Button
          type='button'
          variant='outline'
          onClick={() =>
            window.open('https://forms.gle/c9gBiF2TmgXaeU7J6', '_blank')
          }
        >
          お問い合わせ
        </Button>
      </div>
      <p className='mt-2 text-sm text-muted-foreground px-10'>
        Google Formsを使用します。
        <br />
        ※画像アップロード可能な設定ですので、Googleアカウントでのログインが必要です
      </p>
      {/* リリースノートへのリンク */}
      <div className='text-center mt-8'>
        <Button
          type='button'
          variant='outline'
          onClick={() =>
            window.open(chrome.runtime.getURL('changelog.html'), '_blank')
          }
        >
          リリースノート
        </Button>
      </div>
    </div>
  )
}

// Reactコンポーネントをレンダリング
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('options-app')
  if (!appContainer) throw new Error('Failed to find the options app container')

  const root = createRoot(appContainer)
  root.render(
    <ThemeProvider defaultTheme='system' storageKey='tab-manager-theme'>
      <OptionsPage />
    </ThemeProvider>,
  )
})
