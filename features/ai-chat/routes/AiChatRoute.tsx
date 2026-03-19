import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SavedTabsChatWidget } from '@/features/ai-chat/components/SavedTabsChatWidget'
import { useSharedAiChatHistory } from '@/features/ai-chat/hooks/useSharedAiChatHistory'
import type { AiChatHistoryItem } from '@/features/ai-chat/types'

const AI_CHAT_HISTORY_BREAKPOINT = 1024

export const AiChatRoute = () => {
  const {
    activeConversation,
    createConversation,
    deleteConversation,
    historyItems,
    isLoading,
    selectConversation,
    updateMessages,
  } = useSharedAiChatHistory()
  const [isHistoryVisible, setIsHistoryVisible] = useState(
    () => window.innerWidth >= AI_CHAT_HISTORY_BREAKPOINT,
  )
  const isCompactViewportRef = useRef(
    window.innerWidth < AI_CHAT_HISTORY_BREAKPOINT,
  )
  const [pendingDeleteHistoryItem, setPendingDeleteHistoryItem] =
    useState<AiChatHistoryItem | null>(null)

  useEffect(() => {
    const handleResize = () => {
      const isCompactViewport = window.innerWidth < AI_CHAT_HISTORY_BREAKPOINT

      if (isCompactViewportRef.current !== isCompactViewport) {
        isCompactViewportRef.current = isCompactViewport
        setIsHistoryVisible(!isCompactViewport)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  if (isLoading || !activeConversation) {
    return (
      <div className='flex min-h-[300px] items-center justify-center'>
        <div className='text-foreground text-xl'>読み込み中...</div>
      </div>
    )
  }

  return (
    <div className='flex h-full min-h-0 min-w-0 overflow-hidden bg-background'>
      {isHistoryVisible ? (
        <aside className='h-full min-h-0 w-[296px] shrink-0 border-border border-r bg-muted/20'>
          <div className='flex h-full flex-col'>
            <div className='flex items-center justify-between px-4 pt-4 pb-3'>
              <div>
                <p className='font-medium text-foreground text-sm'>
                  最近の会話
                </p>
                <p className='text-muted-foreground text-xs'>
                  クリックして続きを開く
                </p>
              </div>
              <div className='rounded-full border border-border bg-background px-2.5 py-1 text-muted-foreground text-xs'>
                {historyItems.length}
              </div>
            </div>

            <ScrollArea className='min-h-0 flex-1'>
              <div className='space-y-1.5 px-3 pb-3'>
                {historyItems.map(historyItem => (
                  <div
                    key={historyItem.id}
                    className={`w-full rounded-2xl border px-3.5 py-3 text-left transition ${
                      historyItem.isActive
                        ? 'border-border bg-background shadow-sm'
                        : 'border-transparent bg-transparent hover:bg-background/80'
                    }`}
                  >
                    <div className='flex items-start gap-2'>
                      <Button
                        className='h-auto min-w-0 flex-1 flex-col items-start justify-start whitespace-normal px-0 text-left hover:bg-transparent'
                        onClick={() => selectConversation(historyItem.id)}
                        type='button'
                        variant='ghost'
                      >
                        <p className='truncate font-medium text-foreground text-sm'>
                          {historyItem.title}
                        </p>
                        <p className='mt-1 line-clamp-2 text-muted-foreground text-xs leading-5'>
                          {historyItem.preview}
                        </p>
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        aria-label={`${historyItem.title}を削除`}
                        className='shrink-0 text-muted-foreground hover:text-destructive'
                        onClick={event => {
                          event.stopPropagation()
                          setPendingDeleteHistoryItem(historyItem)
                        }}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </aside>
      ) : null}

      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
        <main className='min-h-0 flex-1 overflow-hidden bg-muted/10 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5'>
          <div className='mx-auto flex h-full min-h-0 max-w-7xl overflow-hidden'>
            <div className='flex min-h-0 flex-1 overflow-hidden'>
              <SavedTabsChatWidget
                conversationId={activeConversation.id}
                defaultOpen={true}
                historyVariant='sidebar-toggle'
                initialMessages={activeConversation.messages}
                onCreateConversation={createConversation}
                title={activeConversation.title}
                mode='page'
                onMessagesChange={updateMessages}
                onToggleHistory={() => {
                  setIsHistoryVisible(current => !current)
                }}
              />
            </div>
          </div>
        </main>
      </div>

      <Dialog
        open={pendingDeleteHistoryItem !== null}
        onOpenChange={open => {
          if (!open) {
            setPendingDeleteHistoryItem(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>この会話を削除しますか？</DialogTitle>
            <DialogDescription>削除すると元に戻せません。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setPendingDeleteHistoryItem(null)
              }}
            >
              キャンセル
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={() => {
                if (!pendingDeleteHistoryItem) {
                  return
                }

                deleteConversation(pendingDeleteHistoryItem.id)
                setPendingDeleteHistoryItem(null)
              }}
            >
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
