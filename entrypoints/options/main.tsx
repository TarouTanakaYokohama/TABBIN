import '@/assets/global.css'
// lucide-reactからアイコンをインポート - AlertTriangleを追加
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { z } from 'zod'
import { getUserSettings, saveUserSettings } from '../../utils/storage'
import type { ParentCategory, UserSettings } from '../../utils/storage'
import {
  createParentCategory,
  defaultSettings,
  getParentCategories,
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
// トースト通知用のインポート
import { toast } from 'sonner'

import { ThemeProvider } from '@/components/theme-provider'
import { ImportExportSettings } from '@/features/options/ImportExportSettings'
import { isPeriodShortening } from '@/utils/isPeriodShortening'

import { autoDeleteOptions } from '@/constants/autoDeleteOptions'
// 定数をインポート
import { clickBehaviorOptions } from '@/constants/clickBehaviorOptions'
import { colorOptions } from '@/constants/colorOptions'
import { getDefaultColor } from '@/constants/defaultColors'

// Zodによるカテゴリ名のバリデーションスキーマを定義
const categoryNameSchema = z
  .string()
  .max(25, 'カテゴリ名は25文字以下にしてください')

const OptionsPage = () => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [parentCategories, setParentCategories] = useState<ParentCategory[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState<string | null>(null) // エラーメッセージ用の状態変数
  // 保留中の自動削除期間設定用の状態変数を修正 - 初期値をnullからundefinedに変更
  const [pendingAutoDeletePeriod, setPendingAutoDeletePeriod] = useState<
    string | undefined
  >(undefined)

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

  // クリック挙動オプションは外部ファイルからインポート済み

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
    } catch (error) {
      console.error('固定タブ除外設定の保存エラー:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true) // ローディング開始を明示
      try {
        const userSettings = await getUserSettings()
        setSettings(userSettings)

        const categories = await getParentCategories()
        setParentCategories(categories)
      } catch (error) {
        console.error('設定の読み込みエラー:', error)
        setSettings(defaultSettings) // エラー時はデフォルト設定を適用
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    const storageChangeListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === 'local') {
        if (changes.userSettings) {
          if (changes.userSettings.newValue) {
            // newValue は完全な UserSettings オブジェクトであると期待
            setSettings(changes.userSettings.newValue as UserSettings)
          } else {
            // userSettings がストレージから削除された場合 (newValue が undefined)
            // デフォルト設定に戻す
            setSettings(defaultSettings)
          }
        }
        if (changes.parentCategories) {
          setParentCategories(changes.parentCategories.newValue || [])
        }
      }
    }

    chrome.storage.onChanged.addListener(storageChangeListener)

    // クリーンアップ関数
    return () => {
      chrome.storage.onChanged.removeListener(storageChangeListener)
    }
  }, []) // 依存配列が空なので、このeffectはマウント時とアンマウント時にのみ実行される

  const handleSaveSettings = async () => {
    try {
      // 保存する前に空の行を除外
      const cleanSettings = {
        ...settings,
        excludePatterns: settings.excludePatterns.filter(p => p.trim()),
      }
      await saveUserSettings(cleanSettings)
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

  // カラー設定ハンドラ
  const handleColorChange = async (key: string, value: string) => {
    try {
      const newColors = { ...(settings.colors || {}), [key]: value }
      const newSettings = { ...settings, colors: newColors }
      setSettings(newSettings)
      // ライブプレビュー: 即座にCSS変数を更新
      document.documentElement.style.setProperty(`--${key}`, value)
      await saveUserSettings(newSettings)
    } catch (error) {
      console.error(`カラー ${key} 保存エラー:`, error)
    }
  }
  // カラー設定をリセットするハンドラ
  const handleResetColors = async () => {
    try {
      // 色設定を削除した新しい設定を作成
      const newSettings = { ...settings, colors: {} }
      setSettings(newSettings)

      // CSS変数をリセット（デフォルトテーマに戻す）
      for (const { key } of colorOptions) {
        document.documentElement.style.removeProperty(`--${key}`)
      }

      // ストレージから色設定を削除
      await saveUserSettings(newSettings)

      // テーマをシステムに戻す
      chrome.storage.local.set({ 'tab-manager-theme': 'system' })

      // 成功メッセージを表示
      toast.success('カラー設定をリセットしました')
    } catch (error) {
      console.error('カラーリセットエラー:', error)
      toast.error('カラー設定のリセットに失敗しました')
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

  // 自動削除期間の説明テキストは外部ファイルからインポート済み

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
      <div className='flex min-h-[300px] items-center justify-center'>
        <div className='text-foreground text-xl'>読み込み中...</div>
      </div>
    )
  }

  return (
    <div className='mx-auto min-h-screen bg-background pt-10'>
      {/* Toasterコンポーネントを追加 */}
      <Toaster position='top-right' />

      <header className='mb-8 flex items-center justify-between px-6'>
        <h1 className='font-bold text-3xl text-foreground'>オプション</h1>

        {/* テスト用の30秒設定ボタン - 確認表示するように変更 */}
        <div className='flex items-center gap-2'>
          <ModeToggle />
        </div>
      </header>

      {/* インポート/エクスポート設定セクションを追加 */}
      <div className='mb-8 rounded-lg border border-border bg-card p-6 shadow-md'>
        <h2 className='mb-4 font-semibold text-foreground text-xl'>
          バックアップと復元
        </h2>
        <ImportExportSettings />
      </div>

      <div className='mb-8 rounded-lg border border-border bg-card p-6 shadow-md'>
        <h2 className='mb-4 font-semibold text-foreground text-xl'>
          タブの挙動設定
        </h2>

        {/* クリック挙動設定を追加 */}
        <div className='mb-6'>
          <Label
            htmlFor='click-behavior'
            className='mb-2 block font-medium text-foreground'
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
            className='cursor-pointer text-foreground'
          >
            保存したタブを開いた後、リストから自動的に削除する
          </Label>
        </div>
        <p className='mt-1 ml-7 text-muted-foreground text-sm'>
          オンにすると、保存したタブを開いた後、そのタブは保存リストから自動的に削除されます。
          オフにすると、保存したタブを開いても、リストからは削除されません。
        </p>

        {/* 固定タブを除外するオプションを追加 */}
        <div className='mt-6 mb-4 flex items-center space-x-2'>
          <Checkbox
            id='exclude-pinned-tabs'
            checked={settings.excludePinnedTabs}
            onCheckedChange={handleToggleExcludePinnedTabs}
            className='cursor-pointer'
          />
          <Label
            htmlFor='exclude-pinned-tabs'
            className='cursor-pointer text-foreground'
          >
            固定タブ（ピン留め）を除外する
          </Label>
        </div>
        <p className='mt-1 ml-7 text-muted-foreground text-sm'>
          オンにすると、ピン留めされたタブは保存対象から除外されます。
        </p>

        {/* URLを別タブで開く設定を追加 */}
        <div className='mt-6 mb-4 flex items-center space-x-2'>
          <Checkbox
            id='open-url-in-blank'
            checked={settings.openUrlInBackground}
            onCheckedChange={handleToggleOpenUrlInBackground}
            className='cursor-pointer'
          />
          <Label
            htmlFor='open-url-in-blank'
            className='cursor-pointer text-foreground'
          >
            バックグラウンドタブで開く
          </Label>
        </div>
        <p className='mt-1 ml-7 text-muted-foreground text-sm'>
          オンにすると、URLをバックグラウンドで開きます。
        </p>

        {/* 「すべてのタブを開く」を新しいウィンドウで開く設定を追加 */}
        <div className='mt-6 mb-4 flex items-center space-x-2'>
          <Checkbox
            id='open-all-in-new-window'
            checked={settings.openAllInNewWindow}
            onCheckedChange={handleToggleOpenAllInNewWindow}
            className='cursor-pointer'
          />
          <Label
            htmlFor='open-all-in-new-window'
            className='cursor-pointer text-foreground'
          >
            すべてのタブを新しいウィンドウで開く
          </Label>
        </div>
        <p className='mt-1 ml-7 text-muted-foreground text-sm'>
          オンにすると、「すべて開く」ボタンで新しいウィンドウを作成し、タブを開きます。
        </p>

        {/* 保存日時表示設定を追加 */}
        <div className='mt-6 mb-4 flex items-center space-x-2'>
          <Checkbox
            id='show-saved-time'
            checked={settings.showSavedTime}
            onCheckedChange={handleToggleShowSavedTime}
            className='cursor-pointer'
          />
          <Label
            htmlFor='show-saved-time'
            className='cursor-pointer text-foreground'
          >
            保存日時を表示する
          </Label>
        </div>
        <p className='mt-1 ml-7 text-muted-foreground text-sm'>
          オンにすると、保存タブ一覧に保存された日時が表示されます。
        </p>

        {/* 削除時の確認オプション */}
        <div className='mt-6 mb-4 flex items-center space-x-2'>
          <Checkbox
            id='confirm-delete-each'
            checked={settings.confirmDeleteEach}
            onCheckedChange={handleToggleConfirmDeleteEach}
            className='cursor-pointer'
          />
          <Label
            htmlFor='confirm-delete-each'
            className='cursor-pointer text-foreground'
          >
            URL削除前に確認する
          </Label>
        </div>
        <p className='mt-1 ml-7 text-muted-foreground text-sm'>
          オンにすると、URLを削除する前に確認ダイアログを表示します。
        </p>

        <div className='mt-6 mb-4 flex items-center space-x-2'>
          <Checkbox
            id='confirm-delete-all'
            checked={settings.confirmDeleteAll}
            onCheckedChange={handleToggleConfirmDeleteAll}
            className='cursor-pointer'
          />
          <Label
            htmlFor='confirm-delete-all'
            className='cursor-pointer text-foreground'
          >
            すべて削除前に確認する
          </Label>
        </div>
        <p className='mt-1 ml-7 text-muted-foreground text-sm'>
          オンにすると、カテゴリごとにすべてのタブを削除する前に確認ダイアログを表示します。
        </p>

        {/* 自動削除期間設定を修正 */}
        <div className='mt-6 mb-4'>
          <Label
            htmlFor='auto-delete-period'
            className='mb-2 block font-medium text-foreground'
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
            <div className='mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/30'>
              <div className='flex flex-col gap-3'>
                <div className='flex items-start'>
                  <div className='flex-shrink-0 text-yellow-500'>
                    <AlertTriangle size={24} />{' '}
                    {/* lucide-reactのアイコンに置き換え */}
                  </div>
                  <p className='ml-3 whitespace-pre-line text-foreground text-sm'>
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

          <p className='mt-2 text-muted-foreground text-sm'>
            保存されたタブが指定した期間を超えると自動的に削除されます。
            設定を適用すると、その時点で期限切れのタブは削除されますのでご注意ください。
          </p>
        </div>
      </div>

      <div className='mb-8 rounded-lg border border-border bg-card p-6 shadow-md'>
        <h2 className='mb-4 font-semibold text-foreground text-xl'>除外設定</h2>
        <div className='mb-4'>
          <Label
            htmlFor='excludePatterns'
            className='mb-2 block text-foreground'
          >
            保存・閉じない URL パターン（1行に1つ）
          </Label>
          <Textarea
            id='excludePatterns'
            value={settings.excludePatterns.join('\n')}
            onChange={handleExcludePatternsChange}
            onBlur={handleExcludePatternsBlur}
            onKeyDown={handleKeyDown}
            className='h-32 w-full rounded border border-input bg-background p-2 text-foreground focus:ring-2 focus:ring-ring'
            placeholder='例：&#10;chrome-extension://&#10;chrome://'
          />
          <p className='mt-1 text-muted-foreground text-sm'>
            これらのパターンに一致するURLは保存されず、タブも閉じられません。
          </p>
        </div>
      </div>

      {/* カラーカスタマイズ */}
      <div className='mb-8 rounded-lg border border-border bg-card p-6 shadow-md'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='font-semibold text-foreground text-xl'>
            (preview)カラーカスタマイズ
          </h2>
          <Button
            variant='outline'
            size='sm'
            onClick={handleResetColors}
            className='flex items-center gap-1'
          >
            <RotateCcw size={16} />
            リセット
          </Button>
        </div>
        <div className='grid grid-cols-2 gap-4'>
          {colorOptions.map(({ key, label }) => (
            <div key={key} className='flex flex-col'>
              <Label
                htmlFor={`${key}-picker`}
                className='mb-2 block whitespace-normal break-all text-foreground'
              >
                {label}
              </Label>
              <div className='flex items-center space-x-4'>
                <input
                  id={`${key}-picker`}
                  type='color'
                  value={settings.colors?.[key] || getDefaultColor(key)}
                  onChange={e => handleColorChange(key, e.target.value)}
                  className='h-8 w-8 flex-shrink-0 border-0 p-0'
                />
                <div className='min-w-0 flex-1'>
                  <Input
                    id={`${key}-hex`}
                    type='text'
                    value={settings.colors?.[key] || getDefaultColor(key)}
                    onChange={e => handleColorChange(key, e.target.value)}
                    className='w-full bg-background text-foreground'
                    placeholder='HEX入力 (#FFFFFF)'
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* お問い合わせボタン */}
      <div className='mt-4 text-center'>
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
      <p className='mt-2 px-10 text-muted-foreground text-sm'>
        Google Formsを使用します。
        <br />
        ※画像アップロード可能な設定ですので、Googleアカウントでのログインが必要です。
      </p>
      {/* リリースノートへのリンク */}
      <div className='mt-8 text-center'>
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
