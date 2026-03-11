// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/features/saved-tabs/routes/SavedTabsRoute', () => ({
  SavedTabsRoute: ({ search }: { search?: string }) => (
    <div>{`saved-tabs-route:${search ?? ''}`}</div>
  ),
}))

vi.mock('@/features/ai-chat/routes/AiChatRoute', () => ({
  AiChatRoute: () => <div>ai-chat-route</div>,
}))

vi.mock('@/features/periodic-execution/routes/PeriodicExecutionRoute', () => ({
  PeriodicExecutionRoute: () => <div>periodic-execution-route</div>,
}))

import { AppRouter } from './AppRouter'

describe('AppRouter', () => {
  it('ルートパスは saved-tabs に redirect する', () => {
    render(<AppRouter initialEntries={['/']} />)

    expect(screen.getByText('saved-tabs-route:?mode=domain')).toBeTruthy()
  })

  it('サイドバークリックで SPA 遷移する', () => {
    render(<AppRouter initialEntries={['/saved-tabs?mode=domain']} />)

    const periodicLink = screen.getAllByRole('link', {
      name: '定期実行',
    })[0]
    if (!periodicLink) {
      throw new Error('定期実行リンクが見つかりません')
    }

    fireEvent.click(periodicLink)

    expect(screen.getByText('periodic-execution-route')).toBeTruthy()
  })

  it('router context では内部リンクが app.html ではなく route を指す', () => {
    render(<AppRouter initialEntries={['/saved-tabs?mode=custom']} />)

    expect(
      screen
        .getAllByRole('link', { name: 'チャット' })[0]
        ?.getAttribute('href'),
    ).toBe('/ai-chat')
    expect(
      screen
        .getAllByRole('link', { name: 'カスタムモード' })[0]
        ?.getAttribute('href'),
    ).toBe('/saved-tabs?mode=custom')
  })
})
