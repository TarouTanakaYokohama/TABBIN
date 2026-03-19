// @vitest-environment jsdom
import { composeStories } from '@storybook/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as messageStories from '@/components/ai-elements/message.stories'
import * as modeToggleStories from '@/components/mode-toggle.stories'
import * as buttonStories from '@/components/ui/button.stories'
import * as ollamaStories from '@/features/ai-chat/components/OllamaErrorNotice.stories'
import * as headerStories from '@/features/navigation/components/ExtensionPageHeader.stories'
import * as importExportStories from '@/features/options/ImportExportSettings.stories'
import * as viewModeStories from '@/features/saved-tabs/components/ViewModeToggle.stories'
import preview from '../../.storybook/preview'

const { Primary } = composeStories(buttonStories, preview)
const { Conversation } = composeStories(messageStories, preview)
const { Default: ModeToggleDefault } = composeStories(
  modeToggleStories,
  preview,
)
const { Default: ImportExportDefault } = composeStories(
  importExportStories,
  preview,
)
const { WithDescription } = composeStories(headerStories, preview)
const { CustomMode } = composeStories(viewModeStories, preview)
const { ForbiddenOnMac } = composeStories(ollamaStories, preview)

describe('storybook smoke stories', () => {
  it('renders representative stories from each family', () => {
    render(
      <div>
        <Primary />
        <Conversation />
        <ModeToggleDefault />
        <ImportExportDefault />
        <WithDescription />
        <CustomMode />
        <ForbiddenOnMac />
      </div>,
    )

    expect(
      screen.getByRole('button', { name: /テーマの切り替え/i }),
    ).toBeTruthy()
    expect(
      screen.getByText(
        '保存済みタブをドメインごとに 4 グループへ再整理しました。',
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: /設定とタブデータをエクスポート/i,
      }),
    ).toBeTruthy()
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.getByText(/接続先 URL:/)).toBeTruthy()
  })
})
