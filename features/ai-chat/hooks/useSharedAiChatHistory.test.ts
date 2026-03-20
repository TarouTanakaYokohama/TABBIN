// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  loadConversationHistory: vi.fn(),
  saveConversationHistory: vi.fn(),
}))

vi.mock('@/features/i18n/context/I18nProvider', () => ({
  useI18n: () => ({
    language: 'ja',
    t: (key: string) =>
      (
        ({
          'aiChat.history.startPrompt': '新しい会話を始めてください',
          'aiChat.newConversation': '新しい会話',
        }) satisfies Record<string, string>
      )[key] ?? key,
  }),
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

import { useSharedAiChatHistory } from './useSharedAiChatHistory'

describe('useSharedAiChatHistory', () => {
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

  it('新しい会話クリックだけでは保存せず、最初のメッセージで履歴化する', async () => {
    const { result } = renderHook(() => useSharedAiChatHistory())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.createConversation()
    })

    expect(mocked.saveConversationHistory).not.toHaveBeenCalled()
    expect(result.current.activeConversation?.title).toBe('新しい会話')
    expect(result.current.historyItems).toHaveLength(2)
    expect(result.current.historyItems.map(item => item.id)).toEqual([
      'conversation-2',
      'conversation-1',
    ])

    act(() => {
      result.current.updateMessages([
        {
          content: '朝確認したいタブを教えて',
          id: 'message-1',
          role: 'user',
        },
      ])
    })

    await waitFor(() => {
      expect(mocked.saveConversationHistory).toHaveBeenCalledWith({
        activeConversationId: 'new-conversation',
        conversations: [
          expect.objectContaining({
            id: 'new-conversation',
            title: '朝確認したいタブを教えて',
          }),
          expect.objectContaining({ id: 'conversation-2' }),
          expect.objectContaining({ id: 'conversation-1' }),
        ],
      })
    })
  })

  it('履歴選択と既存会話更新を保存する', async () => {
    const { result } = renderHook(() => useSharedAiChatHistory())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.selectConversation('conversation-2')
    })

    await waitFor(() => {
      expect(mocked.saveConversationHistory).toHaveBeenCalledWith({
        activeConversationId: 'conversation-2',
        conversations: expect.arrayContaining([
          expect.objectContaining({ id: 'conversation-1' }),
          expect.objectContaining({ id: 'conversation-2' }),
        ]),
      })
    })
    await waitFor(() => {
      expect(result.current.activeConversation?.id).toBe('conversation-2')
    })

    act(() => {
      result.current.updateMessages([
        {
          content: '保存済みタブの傾向を教えて',
          id: 'message-3',
          role: 'user',
        },
      ])
    })

    await waitFor(() => {
      expect(mocked.saveConversationHistory).toHaveBeenLastCalledWith({
        activeConversationId: 'conversation-2',
        conversations: [
          expect.objectContaining({
            id: 'conversation-2',
            messages: [
              {
                content: '保存済みタブの傾向を教えて',
                id: 'message-3',
                role: 'user',
              },
            ],
            title: '保存済みタブの傾向を教えて',
          }),
          expect.objectContaining({
            id: 'conversation-1',
            title: '最初の会話',
          }),
        ],
      })
    })

    await waitFor(() => {
      expect(result.current.historyItems.map(item => item.id)).toEqual([
        'conversation-2',
        'conversation-1',
      ])
    })
  })

  it('最近の会話を updatedAt の降順で並べる', async () => {
    const { result } = renderHook(() => useSharedAiChatHistory())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.historyItems.map(item => item.id)).toEqual([
      'conversation-2',
      'conversation-1',
    ])

    act(() => {
      result.current.selectConversation('conversation-1')
    })
    await waitFor(() => {
      expect(result.current.activeConversation?.id).toBe('conversation-1')
    })

    act(() => {
      result.current.updateMessages([
        {
          content: 'あとで読み返したいタブを整理して',
          id: 'message-4',
          role: 'user',
        },
      ])
    })

    await waitFor(() => {
      expect(mocked.saveConversationHistory).toHaveBeenLastCalledWith({
        activeConversationId: 'conversation-1',
        conversations: [
          expect.objectContaining({
            id: 'conversation-1',
            title: 'あとで読み返したいタブを整理して',
          }),
          expect.objectContaining({
            id: 'conversation-2',
            title: '別の会話',
          }),
        ],
      })
    })

    expect(result.current.historyItems.map(item => item.id)).toEqual([
      'conversation-1',
      'conversation-2',
    ])
  })

  it('会話を削除すると履歴から外し、アクティブ会話も切り替える', async () => {
    const { result } = renderHook(() => useSharedAiChatHistory())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.selectConversation('conversation-2')
    })
    await waitFor(() => {
      expect(result.current.activeConversation?.id).toBe('conversation-2')
    })

    act(() => {
      result.current.deleteConversation('conversation-2')
    })

    await waitFor(() => {
      expect(mocked.saveConversationHistory).toHaveBeenLastCalledWith({
        activeConversationId: 'conversation-1',
        conversations: [
          expect.objectContaining({
            id: 'conversation-1',
            title: '最初の会話',
          }),
        ],
      })
    })

    await waitFor(() => {
      expect(result.current.historyItems.map(item => item.id)).toEqual([
        'conversation-1',
      ])
      expect(result.current.activeConversation?.id).toBe('conversation-1')
    })
  })

  it('最後の会話を削除すると履歴を空にして新しい会話へ戻す', async () => {
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
      ],
    })

    const { result } = renderHook(() => useSharedAiChatHistory())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.deleteConversation('conversation-1')
    })

    await waitFor(() => {
      expect(mocked.saveConversationHistory).toHaveBeenLastCalledWith({
        activeConversationId: 'new-conversation',
        conversations: [],
      })
    })

    await waitFor(() => {
      expect(result.current.historyItems).toEqual([])
      expect(result.current.activeConversation?.id).toBe('new-conversation')
      expect(result.current.activeConversation?.title).toBe('新しい会話')
    })
  })
})
