import { useCallback, useEffect, useState } from 'react'
import {
  buildConversationTitle,
  createConversationRecord,
  loadConversationHistory,
  saveConversationHistory,
} from '@/features/ai-chat/lib/conversation-history'
import type {
  AiChatConversation,
  AiChatConversationMessage,
  AiChatHistoryItem,
} from '@/features/ai-chat/types'

interface ConversationHistoryState {
  activeConversationId: string
  conversations: AiChatConversation[]
}

interface UseSharedAiChatHistoryResult {
  activeConversation: AiChatConversation | null
  createConversation: () => void
  deleteConversation: (conversationId: string) => void
  historyItems: AiChatHistoryItem[]
  isLoading: boolean
  selectConversation: (conversationId: string) => void
  updateMessages: (messages: AiChatConversationMessage[]) => void
}

const EMPTY_HISTORY_ITEMS: AiChatHistoryItem[] = []

const sortConversationsByRecent = (
  conversations: AiChatConversation[],
): AiChatConversation[] =>
  [...conversations].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt
    }

    if (right.createdAt !== left.createdAt) {
      return right.createdAt - left.createdAt
    }

    return right.id.localeCompare(left.id)
  })

const getConversationPreview = (
  conversation: AiChatConversation,
): AiChatHistoryItem['preview'] =>
  conversation.messages.at(-1)?.content || '新しい会話を始めてください'

const resolveNextActiveConversationId = ({
  activeConversationId,
  currentActiveConversationId,
  deletedConversationId,
  nextConversations,
  pendingConversationId,
}: {
  activeConversationId: string | null
  currentActiveConversationId: string
  deletedConversationId: string
  nextConversations: AiChatConversation[]
  pendingConversationId: string | null
}): string => {
  if (nextConversations.length === 0) {
    return createConversationRecord().id
  }

  if (
    activeConversationId === deletedConversationId ||
    currentActiveConversationId === deletedConversationId
  ) {
    return nextConversations[0].id
  }

  if (
    pendingConversationId !== null &&
    activeConversationId === pendingConversationId
  ) {
    return pendingConversationId
  }

  return currentActiveConversationId
}

const useSharedAiChatHistory = (): UseSharedAiChatHistoryResult => {
  const [historyState, setHistoryState] =
    useState<ConversationHistoryState | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null)
  const [pendingConversationId, setPendingConversationId] = useState<
    string | null
  >(null)

  useEffect(() => {
    let isMounted = true

    void loadConversationHistory().then(nextState => {
      if (!isMounted) {
        return
      }

      setHistoryState({
        ...nextState,
        conversations: sortConversationsByRecent(nextState.conversations),
      })
      setActiveConversationId(nextState.activeConversationId)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const persistHistory = useCallback(
    (
      update: (current: ConversationHistoryState) => ConversationHistoryState,
    ) => {
      setHistoryState(current => {
        if (!current) {
          return current
        }

        const nextState = update(current)
        const normalizedState = {
          ...nextState,
          conversations: sortConversationsByRecent(nextState.conversations),
        }
        setActiveConversationId(normalizedState.activeConversationId)
        void saveConversationHistory(normalizedState)
        return normalizedState
      })
    },
    [],
  )

  const createConversation = useCallback(() => {
    const conversation = createConversationRecord()
    setPendingConversationId(conversation.id)
    setActiveConversationId(conversation.id)
  }, [])

  const deleteConversation = useCallback(
    (conversationId: string) => {
      setHistoryState(current => {
        if (!current) {
          return current
        }

        const nextConversations = sortConversationsByRecent(
          current.conversations.filter(
            conversation => conversation.id !== conversationId,
          ),
        )

        if (nextConversations.length === current.conversations.length) {
          return current
        }

        const nextActiveConversationId = resolveNextActiveConversationId({
          activeConversationId,
          currentActiveConversationId: current.activeConversationId,
          deletedConversationId: conversationId,
          nextConversations,
          pendingConversationId,
        })

        if (nextConversations.length === 0) {
          setPendingConversationId(nextActiveConversationId)
        }

        const nextState = {
          activeConversationId: nextActiveConversationId,
          conversations: nextConversations,
        }

        setActiveConversationId(nextActiveConversationId)
        void saveConversationHistory(nextState)
        return nextState
      })
    },
    [activeConversationId, pendingConversationId],
  )

  const selectConversation = useCallback(
    (conversationId: string) => {
      setPendingConversationId(null)
      persistHistory(current => {
        if (current.activeConversationId === conversationId) {
          return current
        }

        return {
          ...current,
          activeConversationId: conversationId,
        }
      })
    },
    [persistHistory],
  )

  const updateMessages = useCallback(
    (messages: AiChatConversationMessage[]) => {
      if (!activeConversationId) {
        return
      }

      const hasStartedConversation = messages.some(
        message => message.content.trim().length > 0,
      )

      if (
        pendingConversationId &&
        activeConversationId === pendingConversationId
      ) {
        if (!hasStartedConversation) {
          return
        }

        const conversation = createConversationRecord({
          id: pendingConversationId,
          messages,
        })

        setPendingConversationId(null)
        persistHistory(current => ({
          activeConversationId: conversation.id,
          conversations: [conversation, ...current.conversations],
        }))
        return
      }

      persistHistory(current => ({
        ...current,
        conversations: current.conversations.map(conversation =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                messages,
                title: buildConversationTitle(messages),
                updatedAt: Date.now(),
              }
            : conversation,
        ),
      }))
    },
    [activeConversationId, pendingConversationId, persistHistory],
  )

  if (!historyState) {
    return {
      activeConversation: null,
      createConversation,
      deleteConversation,
      historyItems: EMPTY_HISTORY_ITEMS,
      isLoading: true,
      selectConversation,
      updateMessages,
    }
  }

  const currentConversationId =
    activeConversationId ?? historyState.activeConversationId

  const conversations = sortConversationsByRecent(historyState.conversations)

  const activeConversation =
    pendingConversationId && currentConversationId === pendingConversationId
      ? createConversationRecord({ id: pendingConversationId })
      : (conversations.find(
          conversation => conversation.id === currentConversationId,
        ) ?? conversations[0])

  const historyItems = conversations.map(conversation => ({
    id: conversation.id,
    isActive: conversation.id === currentConversationId,
    preview: getConversationPreview(conversation),
    title: conversation.title,
  }))

  return {
    activeConversation,
    createConversation,
    deleteConversation,
    historyItems,
    isLoading: false,
    selectConversation,
    updateMessages,
  }
}

export { useSharedAiChatHistory }
