// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  createRoot: vi.fn(),
  renderRoot: vi.fn(),
}))

vi.mock('react-dom/client', () => ({
  createRoot: mocked.createRoot,
}))

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/features/ai-chat/components/SavedTabsChatWidget', () => ({
  SavedTabsChatWidget: () => createElement('div', null, 'SavedTabsChatWidget'),
}))

vi.mock('@/features/ai-chat/lib/conversation-history', () => ({
  buildConversationTitle: vi.fn(),
  createConversationRecord: () => ({
    createdAt: 1,
    id: 'conversation-1',
    messages: [],
    title: '新しい会話',
    updatedAt: 1,
  }),
  loadConversationHistory: vi.fn().mockResolvedValue({
    activeConversationId: 'conversation-1',
    conversations: [
      {
        createdAt: 1,
        id: 'conversation-1',
        messages: [],
        title: '新しい会話',
        updatedAt: 1,
      },
    ],
  }),
  saveConversationHistory: vi.fn(),
}))

const importModule = async () => {
  vi.resetModules()
  mocked.createRoot.mockReturnValue({
    render: mocked.renderRoot,
  })
  return import('./main')
}

describe('ai-chat bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AiChatPage を描画できる', async () => {
    const { AiChatPage } = await importModule()

    render(createElement(AiChatPage))

    expect(await screen.findByText('AIチャット')).toBeTruthy()
    expect(screen.getByText('SavedTabsChatWidget')).toBeTruthy()
  })

  it('DOMContentLoaded で app 要素へ render する', async () => {
    let domReadyHandler: EventListener | undefined

    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      callback: EventListenerOrEventListenerObject | null,
    ) => {
      if (type === 'DOMContentLoaded' && typeof callback === 'function') {
        domReadyHandler = callback
      }
    }) as typeof document.addEventListener)

    await importModule()
    document.body.innerHTML = '<div id="app"></div>'
    domReadyHandler?.(new Event('DOMContentLoaded'))

    expect(mocked.createRoot).toHaveBeenCalledWith(
      document.getElementById('app'),
    )
    expect(mocked.renderRoot).toHaveBeenCalledTimes(1)
  })
})
