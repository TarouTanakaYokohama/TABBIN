import { Plus, RotateCcw, X } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { clickBehaviorOptions } from '@/constants/clickBehaviorOptions'
import { colorOptions } from '@/constants/colorOptions'
import { getDefaultColor } from '@/constants/defaultColors'
import { useColorSettings } from '@/features/options/hooks/useColorSettings'
import { useSettings } from '@/features/options/hooks/useSettings'
import { ImportExportSettings } from '@/features/options/ImportExportSettings'
import type { UserSettings } from '@/types/storage'

const createThemeColorChangeHandler =
  (
    key: keyof NonNullable<UserSettings['colors']>,
    handleColorChange: (
      key: keyof NonNullable<UserSettings['colors']>,
      value: string,
    ) => void,
  ) =>
  (event: React.ChangeEvent<HTMLInputElement>) => {
    handleColorChange(key, event.target.value)
  }

export const OptionsRoute = () => {
  const {
    addExcludePattern,
    excludePatternInput,
    handleExcludePatternInputChange,
    settings,
    setSettings,
    isLoading,
    removeExcludePattern,
    updateSetting,
  } = useSettings()

  const { handleColorChange, handleResetColors } = useColorSettings(
    settings,
    setSettings,
  )

  const handleClickBehaviorChange = async (value: string) => {
    await updateSetting('clickBehavior', value as UserSettings['clickBehavior'])
  }

  const handleToggleRemoveAfterOpen = async (checked: boolean) => {
    await updateSetting('removeTabAfterOpen', checked)
  }

  const handleToggleRemoveAfterExternalDrop = async (checked: boolean) => {
    await updateSetting('removeTabAfterExternalDrop', checked)
  }

  const handleToggleExcludePinnedTabs = async (checked: boolean) => {
    await updateSetting('excludePinnedTabs', checked)
  }

  const handleToggleShowSavedTime = async (checked: boolean) => {
    await updateSetting('showSavedTime', checked)
  }

  const handleToggleOpenUrlInBackground = async (checked: boolean) => {
    await updateSetting('openUrlInBackground', checked)
  }

  const handleToggleOpenAllInNewWindow = async (checked: boolean) => {
    await updateSetting('openAllInNewWindow', checked)
  }

  const handleToggleConfirmDeleteEach = async (checked: boolean) => {
    await updateSetting('confirmDeleteEach', checked)
  }

  const handleToggleConfirmDeleteAll = async (checked: boolean) => {
    await updateSetting('confirmDeleteAll', checked)
  }

  const handleExcludePatternKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    await addExcludePattern()
  }

  if (isLoading) {
    return (
      <div className='flex min-h-[300px] items-center justify-center'>
        <div className='text-foreground text-xl'>読み込み中...</div>
      </div>
    )
  }

  return (
    <div className='min-h-0 flex-1 overflow-y-auto bg-background'>
      <div className='mx-auto w-full max-w-5xl px-6 py-8 md:px-10 md:pt-10'>
        <Toaster position='top-right' />

        <header className='mb-8 flex items-center justify-between gap-4'>
          <h1 className='font-bold text-3xl text-foreground'>オプション</h1>
          <div className='flex items-center gap-2'>
            <ModeToggle />
          </div>
        </header>

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
                  className='w-full cursor-pointer bg-background'
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

          <div className='mt-6 mb-4 flex items-center space-x-2'>
            <Checkbox
              id='remove-after-external-drop'
              checked={settings.removeTabAfterExternalDrop}
              onCheckedChange={handleToggleRemoveAfterExternalDrop}
              className='cursor-pointer'
            />
            <Label
              htmlFor='remove-after-external-drop'
              className='cursor-pointer text-foreground'
            >
              別ブラウザへドラッグ&ドロップした後、リストから自動的に削除する
            </Label>
          </div>
          <p className='mt-1 ml-7 text-muted-foreground text-sm'>
            オンにすると、保存したタブを別ブラウザへドラッグ&ドロップした際にリストから削除します。
          </p>

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
            オンにすると、保存したタブをバックグラウンドで開きます。
          </p>

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
              タブ削除前に確認する
            </Label>
          </div>
          <p className='mt-1 ml-7 text-muted-foreground text-sm'>
            オンにすると、タブを削除する前に確認ダイアログを表示します。
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
        </div>

        <div className='mb-8 rounded-lg border border-border bg-card p-6 shadow-md'>
          <h2 className='mb-4 font-semibold text-foreground text-xl'>
            除外設定
          </h2>
          <div className='mb-4'>
            <Label
              htmlFor='excludePatterns'
              className='mb-2 block text-foreground'
            >
              保存・閉じない URL パターン
            </Label>
            <div className='flex gap-2'>
              <Input
                id='excludePatterns'
                value={excludePatternInput}
                onChange={handleExcludePatternInputChange}
                onBlur={() => {
                  void addExcludePattern()
                }}
                onKeyDown={handleExcludePatternKeyDown}
                className='bg-background text-foreground'
                placeholder='例: chrome-extension://'
              />
              <Button
                type='button'
                onClick={() => {
                  void addExcludePattern()
                }}
                variant='secondary'
                aria-label='除外パターンを追加'
              >
                <Plus size={16} />
                追加
              </Button>
            </div>
            <div className='mt-3 flex flex-wrap gap-2 rounded-md border border-border bg-background/40 p-3'>
              {settings.excludePatterns.filter(pattern => pattern.trim())
                .length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                  除外パターンはありません
                </p>
              ) : (
                settings.excludePatterns
                  .filter(pattern => pattern.trim())
                  .map(pattern => (
                    <Badge
                      key={pattern}
                      variant='outline'
                      className='flex max-w-full items-center gap-1 pr-1'
                    >
                      <span className='max-w-[240px] truncate' title={pattern}>
                        {pattern}
                      </span>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        className='h-5 w-5 rounded-full'
                        onClick={() => {
                          void removeExcludePattern(pattern)
                        }}
                        aria-label={`除外パターン ${pattern} を削除`}
                      >
                        <X size={12} />
                      </Button>
                    </Badge>
                  ))
              )}
            </div>
            <p className='mt-1 text-muted-foreground text-sm'>
              これらのパターンに一致するURLは保存されず、タブも閉じられません。
            </p>
          </div>
        </div>

        <div className='mb-8 rounded-lg border border-border bg-card p-6 shadow-md'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='font-semibold text-foreground text-xl'>
              (preview)カラーカスタマイズ
            </h2>
            <Button
              variant='outline'
              size='sm'
              onClick={handleResetColors}
              className='flex cursor-pointer items-center gap-1'
            >
              <RotateCcw size={16} />
              リセット
            </Button>
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {colorOptions.map(({ key, label }) => {
              const handleThemeColorChange = createThemeColorChangeHandler(
                key,
                handleColorChange,
              )

              return (
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
                      onChange={handleThemeColorChange}
                      className='h-8 w-8 shrink-0 cursor-pointer border-0 p-0'
                    />
                    <div className='min-w-0 flex-1'>
                      <Input
                        id={`${key}-hex`}
                        type='text'
                        value={settings.colors?.[key] || getDefaultColor(key)}
                        onChange={handleThemeColorChange}
                        className='w-full bg-background text-foreground'
                        placeholder='例: #FF5733, #3366CC'
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className='mt-4'>
          <Button
            type='button'
            onClick={() =>
              window.open('https://forms.gle/c9gBiF2TmgXaeU7J6', '_blank')
            }
            className='w-full cursor-pointer'
          >
            お問い合わせ
          </Button>
        </div>
        <p className='mt-2 text-muted-foreground text-sm'>
          Google Formsを使用します。
          <br />
          ※画像アップロード可能な設定ですので、Googleアカウントでのログインが必要です。
        </p>

        <div className='mt-8 mb-10 text-center'>
          <Button
            type='button'
            className='w-full cursor-pointer'
            onClick={() =>
              window.open(chrome.runtime.getURL('changelog.html'), '_blank')
            }
          >
            リリースノート
          </Button>
        </div>
      </div>
    </div>
  )
}

export { OptionsRoute as OptionsPage }
