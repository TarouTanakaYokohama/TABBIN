import { Toaster } from '@/components/ui/sonner'
import { useI18n } from '@/features/i18n/context/I18nProvider'
import { ExtensionPageHeader } from '@/features/navigation/components/ExtensionPageHeader'
import { useAutoDeletePeriod } from '@/features/options/hooks/useAutoDeletePeriod'
import { useSettings } from '@/features/options/hooks/useSettings'
import { AutoDeleteSettingsCard } from '@/features/periodic-execution/components/AutoDeleteSettingsCard'

export const PeriodicExecutionRoute = () => {
  const { t } = useI18n()
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
        <div className='text-foreground text-xl'>{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <>
      <Toaster position='top-right' />
      <div className='min-h-screen px-6 py-8'>
        <ExtensionPageHeader title={t('periodicExecution.title')} />

        <AutoDeleteSettingsCard
          confirmationState={confirmationState}
          hideConfirmation={hideConfirmation}
          pendingAutoDeletePeriod={pendingAutoDeletePeriod}
          selectedAutoDeletePeriod={settings.autoDeletePeriod ?? 'never'}
          onAutoDeletePeriodChange={handleAutoDeletePeriodChange}
          onPrepareAutoDeletePeriod={prepareAutoDeletePeriod}
        />
      </div>
    </>
  )
}
