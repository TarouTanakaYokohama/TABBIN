import type { Meta, StoryObj } from '@storybook/react'
import { type ComponentProps, useState } from 'react'
import { SavedTabsResponsiveLayoutProvider } from '@/features/saved-tabs/contexts/SavedTabsResponsiveLayoutContext'
import { ViewModeToggle } from './ViewModeToggle'

const ViewModeToggleStoryRender = (
  args: ComponentProps<typeof ViewModeToggle>,
) => {
  const [mode, setMode] = useState(args.currentMode)

  return (
    <SavedTabsResponsiveLayoutProvider
      isCompactLayout={args.currentMode === 'custom'}
    >
      <div className='w-72'>
        <ViewModeToggle currentMode={mode} onChange={setMode} />
      </div>
    </SavedTabsResponsiveLayoutProvider>
  )
}

const meta = {
  title: 'Features/SavedTabs/ViewModeToggle',
  component: ViewModeToggle,
  args: {
    onChange: () => undefined,
  },
  render: ViewModeToggleStoryRender,
} satisfies Meta<typeof ViewModeToggle>

type Story = StoryObj<typeof ViewModeToggle>

export const DomainMode: Story = {
  args: {
    currentMode: 'domain',
  },
}

export const CustomMode: Story = {
  args: {
    currentMode: 'custom',
  },
}

export default meta
