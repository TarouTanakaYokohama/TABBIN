import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { autoDeleteOptions } from '@/constants/autoDeleteOptions'

interface ConfirmationState {
  isVisible: boolean
  message: string
  onConfirm: () => void
}

interface AutoDeleteSettingsCardProps {
  confirmationState: ConfirmationState
  hideConfirmation: () => void
  pendingAutoDeletePeriod: string | null | undefined
  selectedAutoDeletePeriod: string
  onAutoDeletePeriodChange: (value: string) => void
  onPrepareAutoDeletePeriod: () => void
}

export const AutoDeleteSettingsCard = ({
  confirmationState,
  hideConfirmation,
  pendingAutoDeletePeriod,
  selectedAutoDeletePeriod,
  onAutoDeletePeriodChange,
  onPrepareAutoDeletePeriod,
}: AutoDeleteSettingsCardProps) => {
  return (
    <section className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
      <div className='mb-5'>
        <h2 className='font-semibold text-xl'>自動削除</h2>
        <p className='mt-2 text-muted-foreground text-sm leading-6'>
          古い保存タブを自動整理する設定です。
        </p>
      </div>

      <div className='mt-6 mb-4'>
        <Label
          htmlFor='auto-delete-period'
          className='mb-2 block font-medium text-foreground'
        >
          タブの自動削除期間
        </Label>
        <div className='flex items-center gap-2'>
          <Select
            value={pendingAutoDeletePeriod ?? selectedAutoDeletePeriod}
            onValueChange={onAutoDeletePeriodChange}
          >
            <SelectTrigger
              id='auto-delete-period'
              className='w-full cursor-pointer'
            >
              <SelectValue placeholder='自動削除期間を選択' />
            </SelectTrigger>
            <SelectContent
              onPointerDownOutside={event => {
                event.preventDefault()
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

          <Button
            type='button'
            variant='outline'
            onClick={onPrepareAutoDeletePeriod}
            className='cursor-pointer'
          >
            設定する
          </Button>
        </div>

        {confirmationState.isVisible && (
          <div className='mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/30'>
            <div className='flex flex-col gap-3'>
              <div className='flex items-start'>
                <div className='shrink-0 text-yellow-500'>
                  <AlertTriangle size={24} />
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
                <Button
                  type='button'
                  variant='default'
                  onClick={confirmationState.onConfirm}
                >
                  確定
                </Button>
              </div>
            </div>
          </div>
        )}

        <p className='mt-2 text-muted-foreground text-sm'>
          保存されたタブが指定した期間を超えると自動的に削除されます。
          設定を適用すると、その時点で期限切れのタブは削除されます。
        </p>
      </div>
    </section>
  )
}
