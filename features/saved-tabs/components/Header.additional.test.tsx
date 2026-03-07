// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomProject, TabGroup, ViewMode } from '@/types/storage'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('./CategoryModal', () => ({
  CategoryModal: () => <div>CategoryModal</div>,
}))

vi.mock('./ViewModeToggle', () => ({
  ViewModeToggle: () => <button type='button'>ViewModeToggle</button>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}))

import { Header } from './Header'

const createProps = (
  overrides: Partial<React.ComponentProps<typeof Header>> = {},
) => ({
  tabGroups: [
    {
      id: 'group-1',
      domain: 'example.com',
    },
  ] as TabGroup[],
  currentMode: 'domain' as ViewMode,
  onModeChange: vi.fn(),
  searchQuery: '',
  onSearchChange: vi.fn(),
  customProjects: [] as CustomProject[],
  onCreateProject: vi.fn(),
  ...overrides,
})

describe('Header additional', () => {
  beforeEach(() => {
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      runtime: {
        getURL: vi.fn((path: string) => path),
      },
    } as unknown as typeof chrome
    vi.spyOn(window, 'open').mockImplementation(vi.fn() as never)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('urls と urlIds が無いグループでも tabCount を 0 のまま表示する', () => {
    render(<Header {...createProps()} />)

    expect(screen.getByText('タブ:0')).toBeTruthy()
    expect(screen.getByText('ドメイン:1')).toBeTruthy()
  })
})
