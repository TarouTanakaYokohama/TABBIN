// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  loadConversationHistory: vi.fn(),
  saveConversationHistory: vi.fn(),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/features/ai-chat/lib/conversation-history', () => ({
  buildConversationTitle: (
    messages: Array<{ content: string; role: 'assistant' | 'user' }>,
  ) => messages[0]?.content || '新しい会話',
  createConversationRecord: ({
    id = 'new-conversation',
    messages = [],
    now = 10,
  }: {
    id?: string
    messages?: Array<{
      content: string
      id: string
      role: 'assistant' | 'user'
    }>
    now?: number
  } = {}) => ({
    createdAt: now,
    id,
    messages,
    title: messages[0]?.content || '新しい会話',
    updatedAt: now,
  }),
  loadConversationHistory: mocked.loadConversationHistory,
  saveConversationHistory: mocked.saveConversationHistory,
}))

vi.mock('@/features/ai-chat/components/SavedTabsChatWidget', () => ({
  SavedTabsChatWidget: ({
    initialMessages = [],
    onCreateConversation,
    onMessagesChange,
  }: {
    initialMessages?: Array<{ content: string }>
    onCreateConversation?: () => void
    onMessagesChange?: (
      messages: Array<{
        content: string
        id: string
        role: 'assistant' | 'user'
      }>,
    ) => void
  }) => (
    <div>
      <div>{`active-messages:${initialMessages.map(message => message.content).join('|')}`}</div>
      <button onClick={() => onCreateConversation?.()} type='button'>
        create-conversation
      </button>
      <button
        onClick={() =>
          onMessagesChange?.([
            {
              content: '朝確認したいタブを教えて',
              id: 'message-1',
              role: 'user',
            },
          ])
        }
        type='button'
      >
        update-messages
      </button>
    </div>
  ),
}))

import { AiChatPage } from './main'

describe('AiChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.loadConversationHistory.mockResolvedValue({
      activeConversationId: 'conversation-1',
      conversations: [
        {
          createdAt: 1,
          id: 'conversation-1',
          messages: [
            {
              content: '最初の会話',
              id: 'message-1',
              role: 'user',
            },
          ],
          title: '最初の会話',
          updatedAt: 1,
        },
        {
          createdAt: 2,
          id: 'conversation-2',
          messages: [
            {
              content: '別の会話',
              id: 'message-2',
              role: 'user',
            },
          ],
          title: '別の会話',
          updatedAt: 2,
        },
      ],
    })
    mocked.saveConversationHistory.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('会話履歴と現在の会話を表示する', async () => {
    render(createElement(AiChatPage))

    expect(await screen.findByText('AIチャット')).toBeTruthy()
    expect(screen.getByRole('button', { name: /最初の会話/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /別の会話/ })).toBeTruthy()
    expect(screen.getByText('active-messages:最初の会話')).toBeTruthy()
  })

  it('履歴の切り替えと会話更新を保存する', async () => {
    render(createElement(AiChatPage))

    await screen.findByRole('button', { name: /最初の会話/ })

    fireEvent.click(screen.getByRole('button', { name: /別の会話/ }))
    expect(screen.getByText('active-messages:別の会話')).toBeTruthy()

    fireEvent.click(screen.getByText('update-messages'))

    await waitFor(() => {
      expect(mocked.saveConversationHistory).toHaveBeenCalledWith({
        activeConversationId: 'conversation-2',
        conversations: [
          {
            createdAt: 1,
            id: 'conversation-1',
            messages: [
              {
                content: '最初の会話',
                id: 'message-1',
                role: 'user',
              },
            ],
            title: '最初の会話',
            updatedAt: 1,
          },
          {
            createdAt: 2,
            id: 'conversation-2',
            messages: [
              {
                content: '朝確認したいタブを教えて',
                id: 'message-1',
                role: 'user',
              },
            ],
            title: '朝確認したいタブを教えて',
            updatedAt: expect.any(Number),
          },
        ],
      })
    })
  })
})
