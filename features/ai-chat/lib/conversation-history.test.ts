import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  storageLocal: {
    get: vi.fn(),
    set: vi.fn(),
  },
  warnMissingChromeStorage: vi.fn(),
}))

vi.mock('@/lib/browser/chrome-storage', () => ({
  getChromeStorageLocal: () => mocked.storageLocal,
  warnMissingChromeStorage: mocked.warnMissingChromeStorage,
}))

import {
  buildConversationTitle,
  createConversationRecord,
  loadConversationHistory,
  saveConversationHistory,
} from './conversation-history'

describe('conversation-history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.storageLocal.get.mockResolvedValue({})
    mocked.storageLocal.set.mockResolvedValue(undefined)
  })

  it('最初の user メッセージから会話タイトルを生成する', () => {
    expect(
      buildConversationTitle([
        {
          content: '  毎朝読むべき保存タブを要約して  ',
          id: 'message-1',
          role: 'user',
        },
      ]),
    ).toBe('毎朝読むべき保存タブを要約して')

    expect(
      buildConversationTitle([
        {
          content: '',
          id: 'message-1',
          role: 'assistant',
        },
      ]),
    ).toBe('新しい会話')
  })

  it('履歴が空なら新しい会話を 1 件返す', async () => {
    const history = await loadConversationHistory()

    expect(history.activeConversationId).toBe(history.conversations[0]?.id)
    expect(history.conversations).toHaveLength(1)
    expect(history.conversations[0]?.title).toBe('新しい会話')
  })

  it('履歴を storage に保存する', async () => {
    const conversation = createConversationRecord({
      id: 'conversation-1',
      messages: [
        {
          content: 'いま重要なタブを抽出して',
          id: 'message-1',
          role: 'user',
        },
      ],
    })

    await saveConversationHistory({
      activeConversationId: conversation.id,
      conversations: [conversation],
    })

    expect(mocked.storageLocal.set).toHaveBeenCalledWith({
      activeAiChatConversationId: 'conversation-1',
      aiChatConversations: [conversation],
    })
  })
})
