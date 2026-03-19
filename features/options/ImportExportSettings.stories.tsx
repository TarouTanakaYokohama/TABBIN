import type { Meta, StoryObj } from '@storybook/react'
import { userEvent, within } from 'storybook/test'
import { ImportExportSettings } from './ImportExportSettings'

const meta = {
  title: 'Features/Options/ImportExportSettings',
  component: ImportExportSettings,
} satisfies Meta<typeof ImportExportSettings>

type Story = StoryObj<typeof ImportExportSettings>

export const Default: Story = {}

export const OpenedImportDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', {
        name: /設定とタブデータをインポート/i,
      }),
    )
  },
}

export default meta
