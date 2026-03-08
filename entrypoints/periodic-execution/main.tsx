import '@/assets/global.css'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { ExtensionPageHeader } from '@/features/navigation/components/ExtensionPageHeader'
import { ExtensionPageShell } from '@/features/navigation/components/ExtensionPageShell'
import { useAutoDeletePeriod } from '@/features/options/hooks/useAutoDeletePeriod'
import { useSettings } from '@/features/options/hooks/useSettings'
import { AutoDeleteSettingsCard } from '@/features/periodic-execution/components/AutoDeleteSettingsCard'

const PeriodicExecutionPage = () => {
  const { settings, setSettings, isLoading } = useSettings()
  const {
    pendingAutoDeletePeriod,
    confirmationState,
    hideConfirmation,
    handleAutoDeletePeriodChange,
    prepareAutoDeletePeriod,
  } = useAutoDeletePeriod(settings, setSettings)

  if (isLoading) {
    return (
      <div className='flex min-h-[300px] items-center justify-center'>
        <div className='text-foreground text-xl'>読み込み中...</div>
      </div>
    )
  }

  return (
    <ExtensionPageShell>
      <Toaster position='top-right' />
      <div className='mx-auto min-h-screen max-w-7xl px-6 py-8'>
        <ExtensionPageHeader
          title='定期実行'
          description='朝のレビューや自動整理など、保存タブに対する定期ジョブをここに集約します。v1 では自動削除設定の移設と、今後の自動化項目の情報設計までを扱います。'
        />

        <div className='grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]'>
          <AutoDeleteSettingsCard
            confirmationState={confirmationState}
            hideConfirmation={hideConfirmation}
            pendingAutoDeletePeriod={pendingAutoDeletePeriod}
            selectedAutoDeletePeriod={settings.autoDeletePeriod ?? 'never'}
            onAutoDeletePeriodChange={handleAutoDeletePeriodChange}
            onPrepareAutoDeletePeriod={prepareAutoDeletePeriod}
          />

          <div className='space-y-6'>
            <Card className='rounded-2xl border-border'>
              <CardHeader>
                <CardTitle>朝8時のAIレビュー</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3 text-sm leading-6'>
                <p className='text-muted-foreground'>
                  毎朝 8 時に、過去 24 時間で追加した URL を AI が確認し、
                  「見た方がよい」「後回しでよい」などを提案する想定です。
                </p>
                <div className='rounded-xl border border-border border-dashed bg-muted/30 p-4'>
                  <p className='font-medium'>v1 では準備中です</p>
                  <p className='mt-1 text-muted-foreground'>
                    実行時刻、対象期間、通知方法、AI
                    モデル選択は次段で追加します。
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className='rounded-2xl border-border'>
              <CardHeader>
                <CardTitle>今後追加する自動整理</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3 text-muted-foreground text-sm leading-6'>
                <p>重複 URL の整理</p>
                <p>長期間未読タブの削除候補提案</p>
                <p>カテゴリ別の再整理提案</p>
                <p>保存タブ数が多すぎる時の通知</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ExtensionPageShell>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app')
  if (!appContainer) {
    throw new Error('Failed to find the app container')
  }

  const root = createRoot(appContainer)
  root.render(
    <ThemeProvider defaultTheme='system' storageKey='tab-manager-theme'>
      <PeriodicExecutionPage />
    </ThemeProvider>,
  )
})

export { PeriodicExecutionPage }
