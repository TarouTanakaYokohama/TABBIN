// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  setTheme: vi.fn(),
}))

vi.mock('@/components/theme-provider', () => ({
  useTheme: () => ({
    setTheme: mocked.setTheme,
    theme: 'system',
  }),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} type='button'>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

import { ModeToggle } from './mode-toggle'

describe('ModeToggle', () => {
  it('absolute icon の位置基準になる relative ボタンを使う', () => {
    render(<ModeToggle />)

    expect(
      screen.getByRole('button', { name: 'テーマの切り替え' }).className,
    ).toContain('relative')
  })
})
