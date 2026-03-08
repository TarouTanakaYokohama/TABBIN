// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CustomProject,
  ParentCategory,
  TabGroup,
  UrlRecord,
  UserSettings,
} from '@/types/storage'

const mocked = vi.hoisted(() => {
  const customProjects: CustomProject[] = [
    {
      id: 'project-1',
      name: 'Reading List',
      urlIds: ['url-1'],
      categories: [],
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'project-2',
      name: 'Work',
      urlIds: ['url-2'],
      categories: [],
      createdAt: 2,
      updatedAt: 2,
    },
    {
      id: 'project-3',
      name: 'Videos',
      urlIds: ['url-3'],
      categories: [],
      createdAt: 3,
      updatedAt: 3,
    },
  ]

  const projectUrlsById: Record<string, UrlRecord[]> = {
    'project-1': [
      {
        id: 'url-1',
        url: 'https://example.com/reading',
        title: 'Reading article',
        savedAt: 10,
      },
    ],
    'project-2': [
      {
        id: 'url-2',
        url: 'https://example.com/docker-cmd',
        title: 'Container article',
        savedAt: 20,
      },
    ],
    'project-3': [
      {
        id: 'url-3',
        url: 'https://example.com/video',
        title: 'Meeting notes',
        savedAt: 30,
      },
    ],
  }

  const getProjectUrls = vi.fn(async (project: CustomProject) => {
    return projectUrlsById[project.id] ?? []
  })

  const customModeContainerSpy = vi.fn()
  const headerSpy = vi.fn()

  const settings: UserSettings = {
    enableCategories: true,
    openUrlInBackground: false,
    removeTabAfterOpen: false,
    openAllInNewWindow: false,
  } as UserSettings

  const categoryState = {
    categories: [] as ParentCategory[],
    setCategories: vi.fn(),
    categoryOrder: [] as string[],
    isCategoryReorderMode: false,
    tempCategoryOrder: [] as string[],
    handleDeleteCategory: vi.fn(),
    handleCategoryDragEnd: vi.fn(),
    handleConfirmCategoryReorder: vi.fn(),
    handleCancelCategoryReorder: vi.fn(),
    handleUpdateDomainsOrder: vi.fn(),
    handleMoveDomainToCategory: vi.fn(),
  }

  const tabDataState = {
    tabGroups: [] as TabGroup[],
    isLoading: false,
    tabGroupsWithUrls: [] as TabGroup[],
    refreshTabGroupsWithUrls: vi.fn(),
  }

  const projectState = {
    customProjects,
    setCustomProjects: vi.fn(),
    viewMode: 'custom' as const,
    viewModeRef: { current: 'custom' as const },
    syncDomainDataToCustomProjects: vi.fn(),
    handleViewModeChange: vi.fn(),
    handleCreateProject: vi.fn(),
    handleDeleteProject: vi.fn(),
    handleRenameProject: vi.fn(),
    handleAddUrlToProject: vi.fn(),
    handleDeleteUrlFromProject: vi.fn(),
    handleDeleteUrlsFromProject: vi.fn(),
    handleAddCategory: vi.fn(),
    handleDeleteProjectCategory: vi.fn(),
    handleSetUrlCategory: vi.fn(),
    handleUpdateCategoryOrder: vi.fn(),
    handleReorderUrls: vi.fn(),
    handleReorderProjects: vi.fn(),
    handleRenameCategory: vi.fn(),
  }

  return {
    categoryState,
    customModeContainerSpy,
    getProjectUrls,
    headerSpy,
    projectState,
    settings,
    tabDataState,
  }
})

vi.mock('@dnd-kit/core', () => ({
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(items: T[]) => items,
  sortableKeyboardCoordinates: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}))

vi.mock('@/features/saved-tabs/components/Footer', () => ({
  CategoryReorderFooter: () => null,
}))

vi.mock('@/features/saved-tabs/components/Header', () => ({
  Header: ({
    filteredCustomProjects,
    onSearchChange,
    searchQuery,
  }: {
    filteredCustomProjects?: CustomProject[]
    onSearchChange: (value: string) => void
    searchQuery: string
  }) => {
    mocked.headerSpy({ filteredCustomProjects, searchQuery })
    return (
      <label>
        search
        <input
          aria-label='search'
          onChange={event => onSearchChange(event.target.value)}
          value={searchQuery}
        />
      </label>
    )
  },
}))

vi.mock('@/features/saved-tabs/custom/CustomModeContainer', () => ({
  CustomModeContainer: ({ projects }: { projects: CustomProject[] }) => {
    mocked.customModeContainerSpy(projects)
    return (
      <div data-testid='custom-projects'>
        {projects.map(project => (
          <section data-testid={`project-${project.id}`} key={project.id}>
            <div>{`project:${project.name}`}</div>
            {(project.urls || []).map(url => (
              <div key={url.url}>{`url:${url.title}:${url.url}`}</div>
            ))}
          </section>
        ))}
      </div>
    )
  },
}))

vi.mock('@/features/saved-tabs/domain/DomainModeContainer', () => ({
  DomainModeContainer: () => <div>domain-mode</div>,
}))

vi.mock('@/features/saved-tabs/lib/custom-project-move', () => ({
  moveCustomProjectUrlAndSyncState: vi.fn(),
}))

vi.mock('@/features/saved-tabs/lib/tab-operations', () => ({
  handleTabGroupRemoval: vi.fn(),
}))

vi.mock('@/features/saved-tabs/lib/uncategorized-display', () => ({
  shouldShowUncategorizedHeader: vi.fn(() => false),
}))

vi.mock('@/features/saved-tabs/shared/hooks/useSavedTabsCore', () => ({
  useSavedTabsCore: () => ({
    categoryState: mocked.categoryState,
    tabDataState: mocked.tabDataState,
    projectState: mocked.projectState,
  }),
}))

vi.mock('@/features/saved-tabs/shared/services/modeSyncService', () => ({
  syncStorageChanges: vi.fn(),
}))

vi.mock('@/lib/storage/categories', () => ({
  saveParentCategories: vi.fn(),
}))

vi.mock('@/lib/storage/projects', () => ({
  getCustomProjects: vi.fn(async () => mocked.projectState.customProjects),
  getProjectUrls: mocked.getProjectUrls,
  moveUrlBetweenCustomProjects: vi.fn(),
  removeUrlFromAllCustomProjects: vi.fn(),
}))

vi.mock('@/lib/storage/tabs', () => ({
  addSubCategoryToGroup: vi.fn(),
  getTabGroupUrls: vi.fn(async () => []),
  removeUrlFromTabGroup: vi.fn(),
  removeUrlsFromTabGroup: vi.fn(),
}))

import { SavedTabsApp } from './SavedTabsApp'

describe('SavedTabsApp custom search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({ savedTabs: [] })),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        create: vi.fn(),
      },
      windows: {
        create: vi.fn(),
      },
      runtime: {
        getURL: vi.fn(),
      },
    } as unknown as typeof chrome
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('プロジェクト名一致で対象プロジェクトだけを表示する', async () => {
    render(<SavedTabsApp />)

    fireEvent.change(screen.getByLabelText('search'), {
      target: { value: 'Reading' },
    })

    await waitFor(() => {
      expect(screen.getByText('project:Reading List')).toBeTruthy()
    })

    expect(screen.queryByText('project:Work')).toBeNull()
    expect(screen.queryByText('project:Videos')).toBeNull()
  })

  it('URL 一致で対象プロジェクトに絞り込み、一致した URL を表示する', async () => {
    render(<SavedTabsApp />)

    fireEvent.change(screen.getByLabelText('search'), {
      target: { value: 'docker-cmd' },
    })

    await waitFor(() => {
      expect(
        screen.getByText(
          'url:Container article:https://example.com/docker-cmd',
        ),
      ).toBeTruthy()
    })

    expect(screen.getByText('project:Work')).toBeTruthy()
    expect(screen.queryByText('project:Reading List')).toBeNull()
    expect(screen.queryByText('project:Videos')).toBeNull()
  })

  it('タイトル一致で対象プロジェクトに絞り込み、一致したタブを表示する', async () => {
    render(<SavedTabsApp />)

    fireEvent.change(screen.getByLabelText('search'), {
      target: { value: 'Meeting notes' },
    })

    await waitFor(() => {
      expect(
        screen.getByText('url:Meeting notes:https://example.com/video'),
      ).toBeTruthy()
    })

    expect(screen.getByText('project:Videos')).toBeTruthy()
    expect(screen.queryByText('project:Reading List')).toBeNull()
    expect(screen.queryByText('project:Work')).toBeNull()
  })
})
