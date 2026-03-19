// @covers components/ui/alert.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { AlertCircle, ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './alert'

export default {
  title: 'UI/Alert',
  component: Alert,
  render: args => (
    <Alert {...args}>
      {args.variant === 'destructive' ? (
        <ShieldAlert className='h-4 w-4' />
      ) : (
        <AlertCircle className='h-4 w-4' />
      )}
      <AlertTitle>同期ステータス</AlertTitle>
      <AlertDescription>
        Storybook 上で確認しやすい代表状態をまとめています。
      </AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>

type Story = StoryObj<typeof Alert>

export const StatusNotice: Story = {}

export const DestructiveAlert: Story = {
  args: {
    variant: 'destructive',
  },
}
