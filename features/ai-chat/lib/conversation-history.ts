import type {
  AiChatConversation,
  AiChatConversationMessage,
} from '@/features/ai-chat/types'
import { getMessage } from '@/features/i18n/lib/language'
import {
  getChromeStorageLocal,
  warnMissingChromeStorage,
} from '@/lib/browser/chrome-storage'

const AI_CHAT_CONVERSATIONS_KEY = 'aiChatConversations'
const ACTIVE_AI_CHAT_CONVERSATION_ID_KEY = 'activeAiChatConversationId'

interface ConversationHistoryState {
  activeConversationId: string
  conversations: AiChatConversation[]
}

const DEFAULT_CONVERSATION_TITLE = getMessage('ja', 'aiChat.newConversation')

const createConversationId = (): string =>
  `conversation-${Date.now()}-${Math.random().toString(16).slice(2)}`

const buildConversationTitle = (
  messages: AiChatConversationMessage[],
  defaultTitle = DEFAULT_CONVERSATION_TITLE,
): string => {
  const firstUserMessage = messages.find(
    message => message.role === 'user' && message.content.trim().length > 0,
  )

  if (!firstUserMessage) {
    return defaultTitle
  }

  return firstUserMessage.content.trim().slice(0, 40)
}

const createConversationRecord = ({
  defaultTitle = DEFAULT_CONVERSATION_TITLE,
  id = createConversationId(),
  messages = [],
  now = Date.now(),
}: {
  defaultTitle?: string
  id?: string
  messages?: AiChatConversationMessage[]
  now?: number
} = {}): AiChatConversation => ({
  createdAt: now,
  id,
  messages,
  title: buildConversationTitle(messages, defaultTitle),
  updatedAt: now,
})

const createDefaultConversationHistory = (
  defaultTitle = DEFAULT_CONVERSATION_TITLE,
): ConversationHistoryState => {
  const conversation = createConversationRecord({ defaultTitle })

  return {
    activeConversationId: conversation.id,
    conversations: [conversation],
  }
}

const loadConversationHistory = async (
  defaultTitle = DEFAULT_CONVERSATION_TITLE,
): Promise<ConversationHistoryState> => {
  const storageLocal = getChromeStorageLocal()
  if (!storageLocal) {
    warnMissingChromeStorage('AIチャット履歴の読み込み')
    return createDefaultConversationHistory(defaultTitle)
  }

  const stored = await storageLocal.get([
    ACTIVE_AI_CHAT_CONVERSATION_ID_KEY,
    AI_CHAT_CONVERSATIONS_KEY,
  ])

  const conversations = Array.isArray(stored[AI_CHAT_CONVERSATIONS_KEY])
    ? (stored[AI_CHAT_CONVERSATIONS_KEY] as AiChatConversation[])
    : []

  if (conversations.length === 0) {
    return createDefaultConversationHistory(defaultTitle)
  }

  const activeConversationId =
    typeof stored[ACTIVE_AI_CHAT_CONVERSATION_ID_KEY] === 'string' &&
    conversations.some(
      conversation =>
        conversation.id === stored[ACTIVE_AI_CHAT_CONVERSATION_ID_KEY],
    )
      ? (stored[ACTIVE_AI_CHAT_CONVERSATION_ID_KEY] as string)
      : conversations[0].id

  return {
    activeConversationId,
    conversations,
  }
}

const saveConversationHistory = async ({
  activeConversationId,
  conversations,
}: ConversationHistoryState): Promise<void> => {
  const storageLocal = getChromeStorageLocal()
  if (!storageLocal) {
    warnMissingChromeStorage('AIチャット履歴の保存')
    return
  }

  await storageLocal.set({
    [ACTIVE_AI_CHAT_CONVERSATION_ID_KEY]: activeConversationId,
    [AI_CHAT_CONVERSATIONS_KEY]: conversations,
  })
}

export {
  ACTIVE_AI_CHAT_CONVERSATION_ID_KEY,
  AI_CHAT_CONVERSATIONS_KEY,
  buildConversationTitle,
  createConversationRecord,
  loadConversationHistory,
  saveConversationHistory,
}
