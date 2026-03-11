// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  selectConversation: vi.fn(),
  toggleHistory: vi.fn(),
  updateMessages: vi.fn(),
  useSharedAiChatHistory: vi.fn(),
}))

vi.mock('@/features/ai-chat/hooks/useSharedAiChatHistory', () => ({
  useSharedAiChatHistory: mocked.useSharedAiChatHistory,
}))

vi.mock('@/features/ai-chat/components/SavedTabsChatWidget', () => ({
  SavedTabsChatWidget: ({
    historyVariant,
    onToggleHistory,
    title,
  }: {
    historyVariant?: string
    onToggleHistory?: () => void
    title?: string
  }) => (
    <div data-testid='saved-tabs-chat-widget'>
      <div>{`history-variant:${historyVariant ?? 'none'}`}</div>
      <div>{`active-title:${title ?? ''}`}</div>
      <button onClick={() => onToggleHistory?.()} type='button'>
        toggle-history
      </button>
    </div>
  ),
}))

import { AiChatRoute } from './AiChatRoute'

describe('AiChatRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.useSharedAiChatHistory.mockReturnValue({
      activeConversation: {
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
      createConversation: mocked.createConversation,
      deleteConversation: mocked.deleteConversation,
      historyItems: [
        {
          id: 'conversation-1',
          isActive: true,
          preview: '最初の会話',
          title: '最初の会話',
        },
        {
          id: 'conversation-2',
          isActive: false,
          preview: '別の会話',
          title: '別の会話',
        },
      ],
      isLoading: false,
      selectConversation: mocked.selectConversation,
      updateMessages: mocked.updateMessages,
    })
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('広い画面では左履歴を表示し、widget に sidebar-toggle を渡す', () => {
    render(createElement(AiChatRoute))

    expect(screen.getByText('最近の会話')).toBeTruthy()
    expect(screen.getAllByText('最初の会話').length).toBeGreaterThan(0)
    expect(screen.getByText('history-variant:sidebar-toggle')).toBeTruthy()
  })

  it('狭い画面では左履歴を完全非表示にしてチャットを残り幅へ広げる', () => {
    window.innerWidth = 800

    render(createElement(AiChatRoute))

    expect(screen.queryByText('最近の会話')).toBeNull()

    const widgetShell = screen.getByTestId(
      'saved-tabs-chat-widget',
    ).parentElement
    expect(widgetShell?.className.includes('min-h-0')).toBe(true)
    expect(widgetShell?.className.includes('flex-1')).toBe(true)
    expect(widgetShell?.className.includes('overflow-hidden')).toBe(true)
  })

  it('狭い画面でも履歴ボタンで左履歴を再表示できる', () => {
    window.innerWidth = 800

    render(createElement(AiChatRoute))

    fireEvent.click(screen.getByText('toggle-history'))

    expect(screen.getByText('最近の会話')).toBeTruthy()
  })

  it('履歴削除ボタンから確認モーダルを開き、削除を実行できる', () => {
    render(createElement(AiChatRoute))

    fireEvent.click(
      screen.getByRole('button', {
        name: '最初の会話を削除',
      }),
    )

    expect(screen.getByText('この会話を削除しますか？')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '削除' }))

    expect(mocked.deleteConversation).toHaveBeenCalledWith('conversation-1')
  })
})
