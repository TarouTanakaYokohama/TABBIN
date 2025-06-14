import '@/assets/global.css'
import type { UserSettings } from '@/types/storage'
// lucide-reactからアイコンをインポート - AlertTriangleを追加
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { createRoot } from 'react-dom/client'

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

import { ThemeProvider } from '@/components/theme-provider'
import { ImportExportSettings } from '@/features/options/ImportExportSettings'

import { autoDeleteOptions } from '@/constants/autoDeleteOptions'
// 定数をインポート
import { clickBehaviorOptions } from '@/constants/clickBehaviorOptions'
import { colorOptions } from '@/constants/colorOptions'
import { getDefaultColor } from '@/constants/defaultColors'

// Hooksのインポート
import {
  useAutoDeletePeriod,
  useCategories,
  useColorSettings,
  useSettings,
} from '@/features/options/hooks'

const OptionsPage = () => {
  // カスタムhooksを使用
  const {
    settings,
    setSettings,
    isLoading,
    updateSetting,
    handleExcludePatternsChange,
    handleExcludePatternsBlur,
  } = useSettings()

  // 色設定hooks
  const { handleColorChange, handleResetColors } = useColorSettings(
    settings,
    setSettings,
  )

  // カテゴリ管理hooks
  const { handleCategoryKeyDown } = useCategories()

  // 自動削除期間管理hooks
  const {
    pendingAutoDeletePeriod,
    confirmationState,
    hideConfirmation,
    handleAutoDeletePeriodChange,
    prepareAutoDeletePeriod,
  } = useAutoDeletePeriod(settings, setSettings)

  // クリック挙動設定変更ハンドラ
  const handleClickBehaviorChange = async (value: string) => {
    await updateSetting('clickBehavior', value as UserSettings['clickBehavior'])
  }

  // Checkbox用のハンドラを簡略化
  const handleToggleRemoveAfterOpen = async (checked: boolean) => {
    await updateSetting('removeTabAfterOpen', checked)
  }

  // 固定タブ除外設定のハンドラ
  const handleToggleExcludePinnedTabs = async (checked: boolean) => {
    await updateSetting('excludePinnedTabs', checked)
  }

  // 保存日時表示設定のハンドラ
  const handleToggleShowSavedTime = async (checked: boolean) => {
    await updateSetting('showSavedTime', checked)
  }

  // URLを別タブで開く設定のハンドラ
  const handleToggleOpenUrlInBackground = async (checked: boolean) => {
    await updateSetting('openUrlInBackground', checked)
  }

  // 「すべてのタブを開く」を新しいウィンドウで開く設定のハンドラ
  const handleToggleOpenAllInNewWindow = async (checked: boolean) => {
    await updateSetting('openAllInNewWindow', checked)
  }

  // URL削除前確認設定のハンドラ
  const handleToggleConfirmDeleteEach = async (checked: boolean) => {
    await updateSetting('confirmDeleteEach', checked)
  }

  // すべて削除前確認設定のハンドラ
  const handleToggleConfirmDeleteAll = async (checked: boolean) => {
    await updateSetting('confirmDeleteAll', checked)
  }

  // テキストエリアとEnterキーの処理
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
      handleCategoryKeyDown(e)
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
    <div className='mx-auto min-h-screen bg-background px-10 pt-10'>
      {/* Toasterコンポーネントを追加 */}
      <Toaster position='top-right' />

      <header className='mb-8 flex items-center justify-between'>
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
                <SelectValue placeholder='クリック時の挙動を選択してください' />
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
                <SelectValue placeholder='自動削除期間を選択' />
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
                    placeholder='例: #FF5733, #3366CC'
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* お問い合わせボタン */}
      <div className='mt-4'>
        <Button
          type='button'
          onClick={() =>
            window.open('https://forms.gle/c9gBiF2TmgXaeU7J6', '_blank')
          }
          className='w-full'
        >
          お問い合わせ
        </Button>
      </div>
      <p className='mt-2 text-muted-foreground text-sm'>
        Google Formsを使用します。
        <br />
        ※画像アップロード可能な設定ですので、Googleアカウントでのログインが必要です。
      </p>
      {/* リリースノートへのリンク */}
      <div className='mt-8 mb-10 text-center'>
        <Button
          type='button'
          className='w-full'
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
