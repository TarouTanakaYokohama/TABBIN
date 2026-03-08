import '@/assets/global.css'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SavedTabsChatWidget } from '@/features/ai-chat/components/SavedTabsChatWidget'
import {
  buildConversationTitle,
  createConversationRecord,
  loadConversationHistory,
  saveConversationHistory,
} from '@/features/ai-chat/lib/conversation-history'
import type {
  AiChatConversation,
  AiChatConversationMessage,
} from '@/features/ai-chat/types'
import { ExtensionPageHeader } from '@/features/navigation/components/ExtensionPageHeader'
import { ExtensionPageShell } from '@/features/navigation/components/ExtensionPageShell'

interface ConversationHistoryState {
  activeConversationId: string
  conversations: AiChatConversation[]
}

const AiChatPage = () => {
  const [historyState, setHistoryState] =
    useState<ConversationHistoryState | null>(null)

  useEffect(() => {
    let isMounted = true

    void loadConversationHistory().then(nextState => {
      if (isMounted) {
        setHistoryState(nextState)
      }
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
        void saveConversationHistory(nextState)
        return nextState
      })
    },
    [],
  )

  const handleCreateConversation = useCallback(() => {
    const conversation = createConversationRecord()

    persistHistory(current => ({
      activeConversationId: conversation.id,
      conversations: [conversation, ...current.conversations],
    }))
  }, [persistHistory])

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      persistHistory(current => ({
        ...current,
        activeConversationId: conversationId,
      }))
    },
    [persistHistory],
  )

  const handleMessagesChange = useCallback(
    (messages: AiChatConversationMessage[]) => {
      persistHistory(current => ({
        ...current,
        conversations: current.conversations.map(conversation =>
          conversation.id === current.activeConversationId
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
    [persistHistory],
  )

  if (!historyState) {
    return (
      <div className='flex min-h-[300px] items-center justify-center'>
        <div className='text-foreground text-xl'>読み込み中...</div>
      </div>
    )
  }

  const activeConversation =
    historyState.conversations.find(
      conversation => conversation.id === historyState.activeConversationId,
    ) ?? historyState.conversations[0]

  return (
    <ExtensionPageShell>
      <div className='flex min-h-screen flex-col bg-background'>
        <div className='border-border border-b bg-background/95 px-6 py-6 backdrop-blur'>
          <ExtensionPageHeader
            title='AIチャット'
            description='左で会話履歴を切り替え、右で保存タブに基づく AI チャットを続けます。'
          />
        </div>

        <div className='grid min-h-0 flex-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]'>
          <aside className='border-border border-r bg-sidebar/70'>
            <div className='border-border border-b p-4'>
              <Button
                type='button'
                className='w-full cursor-pointer justify-start gap-2'
                onClick={handleCreateConversation}
              >
                <Plus className='size-4' />
                新しい会話
              </Button>
            </div>

            <ScrollArea className='h-[calc(100vh-192px)]'>
              <div className='space-y-2 p-3'>
                {historyState.conversations.map(conversation => {
                  const isActive =
                    conversation.id === historyState.activeConversationId

                  return (
                    <button
                      type='button'
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        isActive
                          ? 'border-primary bg-primary/8'
                          : 'border-transparent bg-background hover:border-border hover:bg-accent/50'
                      }`}
                    >
                      <p className='truncate font-medium text-sm'>
                        {conversation.title}
                      </p>
                      <p className='mt-1 line-clamp-2 text-muted-foreground text-xs'>
                        {conversation.messages.at(-1)?.content ||
                          '新しい会話を始めてください'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </aside>

          <main className='min-h-0 bg-muted/20 p-4 lg:p-6'>
            <div className='mx-auto flex h-full min-h-[calc(100vh-210px)] max-w-5xl'>
              <SavedTabsChatWidget
                key={activeConversation.id}
                defaultOpen={true}
                initialMessages={activeConversation.messages}
                mode='page'
                onCreateConversation={handleCreateConversation}
                onMessagesChange={handleMessagesChange}
              />
            </div>
          </main>
        </div>
      </div>
    </ExtensionPageShell>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app')
  if (!appContainer) {
    throw new Error('Failed to find the app container')
  }

  const root = createRoot(appContainer)
  root.render(
    <ThemeProvider defaultTheme='system' storageKey='tab-manager-theme'>
      <AiChatPage />
    </ThemeProvider>,
  )
})

export { AiChatPage }
