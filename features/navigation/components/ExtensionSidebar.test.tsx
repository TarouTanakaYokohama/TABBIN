// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const sidebarContextValue = {
  open: true,
  setOpen: vi.fn(),
  sidebarWidth: 256,
  setSidebarWidth: vi.fn(),
  isMobile: false,
  state: 'expanded' as 'expanded' | 'collapsed',
  toggleSidebar: vi.fn(),
}

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <aside data-testid='sidebar'>{children}</aside>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='sidebar-content'>{children}</div>
  ),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => (
    <footer data-testid='sidebar-footer'>{children}</footer>
  ),
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenuButton: ({
    children,
    asChild,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => (asChild ? children : <div>{children}</div>),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenuSub: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarMenuSubButton: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href?: string
  }) => <a href={href}>{children}</a>,
  SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useSidebar: () => sidebarContextValue,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

import { ExtensionSidebar } from './ExtensionSidebar'

describe('ExtensionSidebar', () => {
  it('タブ一覧を先頭に表示し、オプションをフッター最下部に表示する', () => {
    render(
      <ExtensionSidebar
        state={{
          expandedGroup: 'tab-list',
          item: 'saved-tabs-domain',
        }}
      />,
    )

    const content = screen.getByTestId('sidebar-content')
    const footer = screen.getByTestId('sidebar-footer')

    expect(content.querySelectorAll('section')).toHaveLength(1)
    expect(content.firstChild?.textContent).toContain('タブ一覧')
    expect(content.textContent).toContain('チャット')
    expect(content.textContent).toContain('定期実行')
    expect(footer.textContent).toContain('オプション')
    expect(
      screen.getByRole('link', { name: 'オプション' }).getAttribute('href'),
    ).toBe('options.html')
  })

  it('タブ一覧の親アイコンは現在モードの一覧ページへ飛ぶ', () => {
    const { container } = render(
      <ExtensionSidebar
        state={{
          expandedGroup: 'tab-list',
          item: 'saved-tabs-custom',
        }}
      />,
    )

    const tabListLinks = container.querySelectorAll(
      'a[href^="saved-tabs.html"]',
    )

    expect(tabListLinks[0]?.getAttribute('href')).toBe(
      'saved-tabs.html?mode=custom',
    )
  })

  it('縮小時は専用 icon rail として同一サイズのボタンを表示する', () => {
    sidebarContextValue.sidebarWidth = 48

    const { container } = render(
      <ExtensionSidebar
        state={{
          expandedGroup: 'tab-list',
          item: 'saved-tabs-domain',
        }}
      />,
    )

    const sidebar = within(container)
    const tabListLink = sidebar
      .getAllByRole('link', { name: 'タブ一覧' })
      .at(-1)
    const chatLink = sidebar.getAllByRole('link', { name: 'チャット' }).at(-1)
    const periodicLink = sidebar
      .getAllByRole('link', { name: '定期実行' })
      .at(-1)
    const optionLink = sidebar
      .getAllByRole('link', { name: 'オプション' })
      .at(-1)

    for (const link of [tabListLink, chatLink, periodicLink, optionLink]) {
      expect(link?.className).toContain('size-11')
      expect(link?.className).toContain('items-center')
      expect(link?.className).toContain('justify-center')
    }

    expect(tabListLink?.getAttribute('href')).toBe(
      'saved-tabs.html?mode=domain',
    )
    expect(tabListLink?.getAttribute('aria-current')).toBe('page')
    expect(chatLink?.getAttribute('aria-current')).toBeNull()
    expect(periodicLink?.getAttribute('aria-current')).toBeNull()

    sidebarContextValue.sidebarWidth = 256
  })

  it('縮小時は active 項目をページごとに 1 つだけ切り替える', () => {
    sidebarContextValue.sidebarWidth = 48

    const { container, rerender } = render(
      <ExtensionSidebar
        state={{
          expandedGroup: 'tab-list',
          item: 'ai-chat',
        }}
      />,
    )

    let sidebar = within(container)

    expect(
      sidebar
        .getAllByRole('link', { name: 'チャット' })
        .at(-1)
        ?.getAttribute('aria-current'),
    ).toBe('page')
    expect(
      sidebar
        .getAllByRole('link', { name: 'タブ一覧' })
        .at(-1)
        ?.getAttribute('aria-current'),
    ).toBeNull()

    rerender(
      <ExtensionSidebar
        state={{
          expandedGroup: 'tab-list',
          item: 'periodic-execution',
        }}
      />,
    )

    sidebar = within(container)

    expect(
      sidebar
        .getAllByRole('link', { name: '定期実行' })
        .at(-1)
        ?.getAttribute('aria-current'),
    ).toBe('page')
    expect(
      sidebar
        .getAllByRole('link', { name: 'チャット' })
        .at(-1)
        ?.getAttribute('aria-current'),
    ).toBeNull()

    sidebarContextValue.sidebarWidth = 256
  })
})
