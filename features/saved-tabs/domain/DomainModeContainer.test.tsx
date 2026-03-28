// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ParentCategory, TabGroup, UserSettings } from '@/types/storage'

const domainModeI18nState = vi.hoisted(() => ({
  language: 'ja' as 'en' | 'ja',
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  closestCenter: 'closestCenter',
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  verticalListSortingStrategy: 'verticalListSortingStrategy',
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

vi.mock('@/features/i18n/context/I18nProvider', async () => {
  const { getMessages } = await vi.importActual<
    typeof import('@/features/i18n/messages')
  >('@/features/i18n/messages')

  return {
    useI18n: () => ({
      language: domainModeI18nState.language,
      t: (key: string, fallback?: string, values?: Record<string, string>) => {
        const messages = getMessages(domainModeI18nState.language)
        const template =
          messages[key as keyof typeof messages] ?? fallback ?? key
        return template.replaceAll(
          /\{\{(\w+)\}\}/g,
          (_, token) => values?.[token] ?? '',
        )
      },
    }),
  }
})

vi.mock('@/features/saved-tabs/components/CategoryGroup', () => ({
  CategoryGroup: () => <div>category-group</div>,
}))

vi.mock('@/features/saved-tabs/components/SortableDomainCard', () => ({
  SortableDomainCard: () => <div>sortable-domain-card</div>,
}))

import { DomainModeContainer } from './DomainModeContainer'

const defaultSettings: UserSettings = {
  removeTabAfterOpen: true,
  removeTabAfterExternalDrop: true,
  excludePatterns: [],
  enableCategories: true,
  autoDeletePeriod: 'never',
  showSavedTime: false,
  clickBehavior: 'saveSameDomainTabs',
  excludePinnedTabs: false,
  openUrlInBackground: true,
  openAllInNewWindow: false,
  confirmDeleteAll: false,
  confirmDeleteEach: false,
  colors: {},
}

const createProps = () => ({
  isLoading: false,
  settings: defaultSettings,
  categories: [] as ParentCategory[],
  categorized: {} as Record<string, TabGroup[]>,
  categoryOrderForDisplay: [] as string[],
  tabGroups: [] as TabGroup[],
  isCategoryReorderMode: false,
  searchQuery: '',
  sensors: [],
  handleCategoryDragEnd: vi.fn(),
  handleOpenAllTabs: vi.fn(),
  handleDeleteGroup: vi.fn(),
  handleDeleteGroups: vi.fn(),
  handleDeleteUrl: vi.fn(),
  handleDeleteUrls: vi.fn(),
  handleOpenTab: vi.fn(),
  handleUpdateUrls: vi.fn(),
  handleUpdateDomainsOrder: vi.fn(),
  handleMoveDomainToCategory: vi.fn(),
  handleDeleteCategory: vi.fn(),
  shouldShowUncategorizedSectionHeader: false,
  hasVisibleCategoryGroups: false,
  isUncategorizedReorderMode: false,
  handleCancelUncategorizedReorder: vi.fn(),
  handleConfirmUncategorizedReorder: vi.fn(),
  shouldShowUncategorizedList: false,
  uncategorizedForDisplay: [] as TabGroup[],
  handleUncategorizedDragEnd: vi.fn(),
  hasContentTabGroupsCount: 0,
})

describe('DomainModeContainer', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    domainModeI18nState.language = 'ja'
  })

  it('renders English empty-state copy when the display language is en', () => {
    domainModeI18nState.language = 'en'

    render(<DomainModeContainer {...createProps()} />)

    expect(screen.getByText('No saved tabs')).toBeTruthy()
    expect(
      screen.getByText(
        'Right-click a tab to save it, or click the extension icon.',
      ),
    ).toBeTruthy()
  })

  it('renders a spinner-only loading state', () => {
    render(<DomainModeContainer {...createProps()} isLoading />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText('No saved tabs')).toBeNull()
  })
})
