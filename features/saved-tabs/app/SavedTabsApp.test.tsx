// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CustomProject,
  ParentCategory,
  TabGroup,
  UrlRecord,
  UserSettings,
  ViewMode,
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
  const domainModeContainerSpy = vi.fn()
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
    viewMode: 'custom' as ViewMode,
    viewModeRef: { current: 'custom' as ViewMode },
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
    domainModeContainerSpy,
    getProjectUrls,
    headerSpy,
    projectState,
    settings,
    tabDataState,
  }
})

const savedTabsAppI18nState = vi.hoisted(() => ({
  language: 'ja' as 'en' | 'ja',
}))

vi.mock('@dnd-kit/core', () => ({
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const nextItems = [...items]
    const [moved] = nextItems.splice(from, 1)
    nextItems.splice(to, 0, moved)
    return nextItems
  },
  sortableKeyboardCoordinates: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}))

vi.mock('@/features/i18n/context/I18nProvider', async () => {
  const { getMessages } = await vi.importActual<
    typeof import('@/features/i18n/messages')
  >('@/features/i18n/messages')

  return {
    useI18n: () => ({
      language: savedTabsAppI18nState.language,
      t: (key: string, fallback?: string, values?: Record<string, string>) => {
        const messages = getMessages(savedTabsAppI18nState.language)
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

vi.mock('@/features/saved-tabs/components/Footer', () => ({
  CategoryReorderFooter: () => null,
}))

vi.mock('@/features/saved-tabs/components/Header', () => ({
  Header: ({
    filteredCustomProjects,
    showSidebarTrigger,
    onSearchChange,
    searchQuery,
  }: {
    filteredCustomProjects?: CustomProject[]
    showSidebarTrigger?: boolean
    onSearchChange: (value: string) => void
    searchQuery: string
  }) => {
    mocked.headerSpy({
      filteredCustomProjects,
      searchQuery,
      showSidebarTrigger,
    })
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
  CustomModeContainer: (props: { projects: CustomProject[] }) => {
    const { projects } = props
    mocked.customModeContainerSpy(props)
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
  DomainModeContainer: (props: Record<string, unknown>) => {
    mocked.domainModeContainerSpy(props)
    return <div>domain-mode</div>
  },
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
  removeUrlIdsFromAllCustomProjects: vi.fn(),
  removeUrlsFromAllCustomProjects: vi.fn(),
}))

vi.mock('@/lib/storage/tabs', () => ({
  addSubCategoryToGroup: vi.fn(),
  getTabGroupUrls: vi.fn(async () => []),
  removeUrlFromTabGroup: vi.fn(),
  removeUrlIdsFromTabGroup: vi.fn(),
  removeUrlsFromTabGroup: vi.fn(),
}))

vi.mock('@/lib/storage/urls', () => ({
  getUrlRecords: vi.fn(async () => []),
}))

import { moveCustomProjectUrlAndSyncState } from '@/features/saved-tabs/lib/custom-project-move'
import { handleTabGroupRemoval } from '@/features/saved-tabs/lib/tab-operations'
import { syncStorageChanges } from '@/features/saved-tabs/shared/services/modeSyncService'
import { saveParentCategories } from '@/lib/storage/categories'
import {
  removeUrlFromAllCustomProjects,
  removeUrlIdsFromAllCustomProjects,
  removeUrlsFromAllCustomProjects,
} from '@/lib/storage/projects'
import {
  getTabGroupUrls,
  removeUrlFromTabGroup,
  removeUrlIdsFromTabGroup,
  removeUrlsFromTabGroup,
} from '@/lib/storage/tabs'
import { getUrlRecords } from '@/lib/storage/urls'
import { SavedTabsApp } from './SavedTabsApp'

describe('SavedTabsApp custom search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.settings.enableCategories = true
    mocked.settings.openUrlInBackground = false
    mocked.settings.removeTabAfterOpen = false
    mocked.settings.openAllInNewWindow = false
    mocked.categoryState.categories = []
    mocked.categoryState.categoryOrder = []
    mocked.categoryState.tempCategoryOrder = []
    mocked.projectState.viewMode = 'custom'
    mocked.projectState.viewModeRef = { current: 'custom' }
    mocked.tabDataState.tabGroups = []
    mocked.tabDataState.tabGroupsWithUrls = []
    mocked.tabDataState.isLoading = false
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
    vi.mocked(getUrlRecords).mockResolvedValue([])
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

  it('initialViewMode が custom のときは初回描画で URL を domain に戻さない', () => {
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }
    window.history.replaceState({}, '', '/saved-tabs.html?mode=custom')

    render(<SavedTabsApp initialViewMode='custom' />)

    expect(window.location.search).toBe('?mode=custom')
  })

  it('メインコンテンツ側のヘッダートリガーは表示しない', () => {
    render(<SavedTabsApp />)

    expect(mocked.headerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        showSidebarTrigger: undefined,
      }),
    )
  })

  it('ドメインモードでは親カテゴリ名検索で一致したグループを保持する', async () => {
    const group: TabGroup = {
      id: 'group-1',
      domain: 'example.com',
      urls: [
        {
          id: 'url-1',
          url: 'https://example.com/a',
          title: 'Unrelated title',
        },
      ],
      urlIds: ['url-1'],
    }
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }
    mocked.categoryState.categories = [
      {
        id: 'category-1',
        name: 'Reading',
        domains: ['group-1'],
        domainNames: [],
      },
    ]
    mocked.categoryState.categoryOrder = ['category-1']
    mocked.tabDataState.tabGroups = [group]
    mocked.tabDataState.tabGroupsWithUrls = [group]

    render(<SavedTabsApp initialViewMode='domain' />)

    fireEvent.change(screen.getByLabelText('search'), {
      target: { value: 'Reading' },
    })

    await waitFor(() => {
      expect(mocked.domainModeContainerSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hasContentTabGroupsCount: 1,
        }),
      )
    })
  })

  it('既に ID で紐付いたカテゴリは domainNames 同期で再保存しない', async () => {
    const group: TabGroup = {
      id: 'group-1',
      domain: 'example.com',
      parentCategoryId: 'category-1',
      urls: [
        {
          id: 'url-1',
          url: 'https://example.com/a',
          title: 'A',
        },
      ],
      urlIds: ['url-1'],
    }
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }
    mocked.categoryState.categories = [
      {
        id: 'category-1',
        name: 'Reading',
        domains: ['group-1'],
        domainNames: ['example.com'],
      },
    ]
    mocked.categoryState.categoryOrder = ['category-1']
    mocked.tabDataState.tabGroups = [group]
    mocked.tabDataState.tabGroupsWithUrls = [group]

    const chromeSetMock = vi.fn()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({ savedTabs: [group] })),
          set: chromeSetMock,
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

    render(<SavedTabsApp initialViewMode='domain' />)

    await waitFor(() => {
      expect(mocked.domainModeContainerSpy).toHaveBeenCalled()
    })

    expect(saveParentCategories).not.toHaveBeenCalled()
    expect(chromeSetMock).not.toHaveBeenCalled()
  })

  it('ドメイン全削除ではカスタムプロジェクト同期を URL ごとではなく一括で実行する', async () => {
    const group: TabGroup = {
      id: 'group-1',
      domain: 'example.com',
      urls: [
        { id: 'url-a', url: 'https://example.com/a', title: 'A' },
        { id: 'url-b', url: 'https://example.com/b', title: 'B' },
      ],
      urlIds: ['url-a', 'url-b'],
    }
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }
    mocked.categoryState.categories = [
      {
        id: 'category-1',
        name: 'Category',
        domains: ['group-1'],
        domainNames: ['example.com'],
      },
    ]
    mocked.tabDataState.tabGroups = [group]
    mocked.tabDataState.tabGroupsWithUrls = [group]
    const customProjectsSnapshot: CustomProject[] = [
      {
        id: 'project-1',
        name: 'Project A',
        urlIds: ['url-a', 'url-b'],
        categories: [],
        createdAt: 1,
        updatedAt: 2,
      },
    ]

    const chromeSetMock = vi.fn()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({
            customProjectOrder: ['project-1'],
            customProjects: customProjectsSnapshot,
            savedTabs: [group],
          })),
          set: chromeSetMock,
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

    vi.mocked(getTabGroupUrls).mockResolvedValue([
      { url: 'https://example.com/a', title: 'A', id: 'url-a', savedAt: 1 },
      { url: 'https://example.com/b', title: 'B', id: 'url-b', savedAt: 2 },
    ])

    render(<SavedTabsApp initialViewMode='domain' />)

    const domainProps = mocked.domainModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as {
      handleDeleteGroup: (id: string) => Promise<void>
    }

    await domainProps.handleDeleteGroup('group-1')

    expect(handleTabGroupRemoval).toHaveBeenCalledWith('group-1')
    expect(removeUrlIdsFromAllCustomProjects).toHaveBeenCalledWith([
      'url-a',
      'url-b',
    ])
    expect(toast.info).toHaveBeenCalledWith(
      '削除した2件のタブを保存データに戻せます',
      expect.objectContaining({
        action: expect.objectContaining({
          label: '元に戻す',
        }),
      }),
    )

    const undoOptions = vi.mocked(toast.info).mock.calls.at(-1)?.[1] as
      | {
          action?: {
            onClick?: () => Promise<void>
          }
        }
      | undefined
    await undoOptions?.action?.onClick?.()

    expect(chromeSetMock).toHaveBeenLastCalledWith({
      customProjectOrder: ['project-1'],
      customProjects: customProjectsSnapshot,
      parentCategories: mocked.categoryState.categories,
      savedTabs: [group],
    })
    expect(mocked.projectState.setCustomProjects).toHaveBeenCalledWith(
      customProjectsSnapshot,
    )
    expect(mocked.categoryState.setCategories).toHaveBeenCalledWith(
      mocked.categoryState.categories,
    )
    expect(toast.success).toHaveBeenCalledWith('保存データを復元しました')
    expect(removeUrlsFromAllCustomProjects).not.toHaveBeenCalled()
    expect(removeUrlFromAllCustomProjects).not.toHaveBeenCalled()
  })

  it('ドメイン子カテゴリ一括削除では URL 文字列ではなく URL ID ベースの削除を優先する', async () => {
    const group: TabGroup = {
      id: 'group-1',
      domain: 'example.com',
      urls: [
        {
          id: 'url-a',
          url: 'https://example.com/a',
          title: 'A',
          subCategory: 'news',
        },
        {
          id: 'url-b',
          url: 'https://example.com/b',
          title: 'B',
          subCategory: 'news',
        },
      ],
      urlIds: ['url-a', 'url-b'],
      subCategories: ['news'],
    }
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }
    mocked.categoryState.categories = []
    mocked.tabDataState.tabGroups = [group]
    mocked.tabDataState.tabGroupsWithUrls = [group]

    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({ savedTabs: [group] })),
          set: vi.fn(),
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

    render(<SavedTabsApp initialViewMode='domain' />)

    const domainProps = mocked.domainModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as {
      handleDeleteUrls: (groupId: string, urls: string[]) => Promise<void>
    }

    await domainProps.handleDeleteUrls('group-1', [
      'https://example.com/a',
      'https://example.com/b',
    ])

    expect(removeUrlIdsFromTabGroup).toHaveBeenCalledWith('group-1', [
      'url-a',
      'url-b',
    ])
    expect(toast.info).toHaveBeenCalledWith(
      '削除した2件のタブを保存データに戻せます',
      expect.objectContaining({
        action: expect.objectContaining({
          label: '元に戻す',
        }),
      }),
    )
    expect(mocked.tabDataState.refreshTabGroupsWithUrls).not.toHaveBeenCalled()
  })

  it('ドメイン内の単体タブ削除でも Undo で削除前の保存データを復元できる', async () => {
    const group: TabGroup = {
      id: 'group-1',
      domain: 'example.com',
      urls: [{ id: 'url-a', url: 'https://example.com/a', title: 'A' }],
      urlIds: ['url-a'],
    }
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }
    mocked.tabDataState.tabGroups = [group]
    mocked.tabDataState.tabGroupsWithUrls = [group]
    const customProjectsSnapshot: CustomProject[] = [
      {
        id: 'project-1',
        name: 'Project A',
        urlIds: ['url-a'],
        categories: [],
        createdAt: 1,
        updatedAt: 2,
      },
    ]

    const chromeSetMock = vi.fn()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({
            customProjectOrder: ['project-1'],
            customProjects: customProjectsSnapshot,
            savedTabs: [group],
          })),
          set: chromeSetMock,
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

    render(<SavedTabsApp initialViewMode='domain' />)

    const domainProps = mocked.domainModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as {
      handleDeleteUrl: (groupId: string, url: string) => Promise<void>
    }

    await domainProps.handleDeleteUrl('group-1', 'https://example.com/a')

    expect(removeUrlFromTabGroup).toHaveBeenCalledWith(
      'group-1',
      'https://example.com/a',
    )
    expect(toast.info).toHaveBeenCalledWith(
      '削除した1件のタブを保存データに戻せます',
      expect.objectContaining({
        action: expect.objectContaining({
          label: '元に戻す',
        }),
      }),
    )

    const undoOptions = vi.mocked(toast.info).mock.calls.at(-1)?.[1] as
      | {
          action?: {
            onClick?: () => Promise<void>
          }
        }
      | undefined
    await undoOptions?.action?.onClick?.()

    expect(chromeSetMock).toHaveBeenLastCalledWith({
      customProjectOrder: ['project-1'],
      customProjects: customProjectsSnapshot,
      savedTabs: [group],
    })
    expect(mocked.projectState.setCustomProjects).toHaveBeenCalledWith(
      customProjectsSnapshot,
    )
  })

  it('すべて開く後の自動削除は一致グループを一括更新し、グループごとの削除APIを繰り返さない', async () => {
    mocked.settings.removeTabAfterOpen = true
    mocked.settings.openAllInNewWindow = false
    mocked.settings.openUrlInBackground = false
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }

    const group1: TabGroup = {
      id: 'group-1',
      domain: 'example.com',
      urlIds: ['url-a', 'url-b'],
      urls: [
        { id: 'url-a', url: 'https://example.com/a', title: 'A' },
        { id: 'url-b', url: 'https://example.com/b', title: 'B' },
      ],
      urlSubCategories: {
        'url-a': 'news',
        'url-b': 'docs',
      },
    }
    const group2: TabGroup = {
      id: 'group-2',
      domain: 'other.com',
      urlIds: ['url-c'],
      urls: [{ id: 'url-c', url: 'https://other.com/c', title: 'C' }],
    }

    mocked.tabDataState.tabGroups = [group1, group2]
    mocked.tabDataState.tabGroupsWithUrls = [group1, group2]
    const customProjectsSnapshot: CustomProject[] = [
      {
        id: 'project-1',
        name: 'Project A',
        urlIds: ['url-a', 'url-c'],
        categories: [],
        createdAt: 1,
        updatedAt: 2,
      },
    ]

    const chromeSetMock = vi.fn()
    const chromeTabsCreateMock = vi.fn()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({
            customProjectOrder: ['project-1'],
            customProjects: customProjectsSnapshot,
            savedTabs: [group1, group2],
          })),
          set: chromeSetMock,
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        create: chromeTabsCreateMock,
      },
      windows: {
        create: vi.fn(),
      },
      runtime: {
        getURL: vi.fn(),
      },
    } as unknown as typeof chrome

    vi.mocked(getUrlRecords).mockResolvedValue([
      { id: 'url-a', url: 'https://example.com/a', title: 'A', savedAt: 1 },
      { id: 'url-b', url: 'https://example.com/b', title: 'B', savedAt: 2 },
      { id: 'url-c', url: 'https://other.com/c', title: 'C', savedAt: 3 },
    ] satisfies UrlRecord[])

    render(<SavedTabsApp initialViewMode='domain' />)

    const domainProps = mocked.domainModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as {
      handleOpenAllTabs: (
        urls: Array<{ url: string; title: string }>,
      ) => Promise<void>
    }

    await domainProps.handleOpenAllTabs([
      { url: 'https://example.com/a', title: 'A' },
      { url: 'https://example.com/b', title: 'B' },
    ])

    expect(chromeTabsCreateMock).toHaveBeenCalledTimes(2)
    expect(chromeSetMock).toHaveBeenCalledWith({
      savedTabs: [group2],
    })
    expect(toast.info).toHaveBeenCalledWith(
      '開いた2件のタブを保存データから削除しました',
      expect.objectContaining({
        action: expect.objectContaining({
          label: '元に戻す',
        }),
      }),
    )

    const undoOptions = vi.mocked(toast.info).mock.calls.at(-1)?.[1] as
      | {
          action?: {
            onClick?: () => Promise<void>
          }
        }
      | undefined
    await undoOptions?.action?.onClick?.()

    expect(chromeSetMock).toHaveBeenLastCalledWith({
      customProjectOrder: ['project-1'],
      customProjects: customProjectsSnapshot,
      savedTabs: [group1, group2],
    })
    expect(mocked.projectState.setCustomProjects).toHaveBeenCalledWith(
      customProjectsSnapshot,
    )
    expect(toast.success).toHaveBeenCalledWith('保存データを復元しました')
    expect(removeUrlIdsFromAllCustomProjects).toHaveBeenCalledTimes(1)
    expect(removeUrlIdsFromAllCustomProjects).toHaveBeenCalledWith([
      'url-a',
      'url-b',
    ])
    expect(getTabGroupUrls).not.toHaveBeenCalled()
    expect(removeUrlFromAllCustomProjects).not.toHaveBeenCalled()
  })

  it('custom mode props はURL open/delete/move handlers を実行する', async () => {
    const chromeTabsCreateMock = vi.fn()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({ savedTabs: [] })),
          set: vi.fn(),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        create: chromeTabsCreateMock,
      },
      windows: {
        create: vi.fn(),
      },
      runtime: {
        getURL: vi.fn(),
      },
    } as unknown as typeof chrome
    vi.mocked(getUrlRecords).mockResolvedValue([
      {
        id: 'url-1',
        savedAt: 1,
        title: 'Doc',
        url: 'https://example.com/doc',
      },
    ])
    vi.mocked(moveCustomProjectUrlAndSyncState).mockResolvedValue(undefined)

    render(<SavedTabsApp />)

    const customProps = mocked.customModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as {
      handleDeleteUrl: (projectId: string, url: string) => Promise<void>
      handleMoveUrlBetweenProjects: (
        sourceProjectId: string,
        targetProjectId: string,
        url: string,
      ) => Promise<null>
      handleOpenAllUrls: (
        urls: Array<{ url: string; title: string }>,
      ) => Promise<void>
      handleOpenUrl: (url: string) => Promise<void>
    }

    await customProps.handleOpenUrl('https://example.com/doc')
    await customProps.handleOpenAllUrls([
      {
        title: 'Doc',
        url: 'https://example.com/doc',
      },
    ])
    await customProps.handleDeleteUrl('project-1', 'https://example.com/doc')
    await expect(
      customProps.handleMoveUrlBetweenProjects(
        'project-1',
        'project-2',
        'https://example.com/doc',
      ),
    ).resolves.toBeNull()

    expect(chromeTabsCreateMock).toHaveBeenCalledWith({
      active: false,
      url: 'https://example.com/doc',
    })
    expect(mocked.projectState.handleDeleteUrlFromProject).toHaveBeenCalledWith(
      'project-1',
      'https://example.com/doc',
    )
    expect(moveCustomProjectUrlAndSyncState).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceProjectId: 'project-1',
        targetProjectId: 'project-2',
        url: 'https://example.com/doc',
      }),
    )
  })

  it('custom URL移動エラーは toast error に落として null を返す', async () => {
    vi.mocked(moveCustomProjectUrlAndSyncState).mockRejectedValue(
      new Error('move failed'),
    )

    render(<SavedTabsApp />)

    const customProps = mocked.customModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as {
      handleMoveUrlBetweenProjects: (
        sourceProjectId: string,
        targetProjectId: string,
        url: string,
      ) => Promise<null>
    }

    await expect(
      customProps.handleMoveUrlBetweenProjects(
        'project-1',
        'project-2',
        'https://example.com/doc',
      ),
    ).resolves.toBeNull()
  })

  it('複数ドメイン削除はURL IDと旧URL形式をまとめて同期削除する', async () => {
    const groupWithIds: TabGroup = {
      domain: 'example.com',
      id: 'group-1',
      urlIds: ['url-a'],
    }
    const legacyGroup: TabGroup = {
      domain: 'legacy.example.com',
      id: 'group-2',
      urls: [
        {
          title: 'Legacy',
          url: 'https://legacy.example.com/a',
        },
      ],
    }
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }
    mocked.tabDataState.tabGroups = [groupWithIds, legacyGroup]
    mocked.tabDataState.tabGroupsWithUrls = [groupWithIds, legacyGroup]
    const customProjectsSnapshot: CustomProject[] = [
      {
        id: 'project-1',
        name: 'Project A',
        urlIds: ['url-a'],
        categories: [],
        createdAt: 1,
        updatedAt: 2,
      },
    ]
    const chromeSetMock = vi.fn()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({
            customProjectOrder: ['project-1'],
            customProjects: customProjectsSnapshot,
            savedTabs: [groupWithIds, legacyGroup],
          })),
          set: chromeSetMock,
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
    vi.mocked(getTabGroupUrls).mockResolvedValue([
      {
        id: 'legacy-url',
        savedAt: 1,
        title: 'Legacy',
        url: 'https://legacy.example.com/a',
      },
    ])

    render(<SavedTabsApp initialViewMode='domain' />)

    const domainProps = mocked.domainModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as {
      handleDeleteGroups: (ids: string[]) => Promise<void>
    }

    await domainProps.handleDeleteGroups([])
    await domainProps.handleDeleteGroups(['group-1', 'group-2'])

    expect(handleTabGroupRemoval).toHaveBeenCalledWith('group-1')
    expect(handleTabGroupRemoval).toHaveBeenCalledWith('group-2')
    expect(removeUrlIdsFromAllCustomProjects).toHaveBeenCalledWith(['url-a'])
    expect(removeUrlsFromAllCustomProjects).toHaveBeenCalledWith([
      'https://legacy.example.com/a',
    ])
    expect(chromeSetMock).toHaveBeenCalledWith({
      savedTabs: [],
    })
    expect(toast.info).toHaveBeenCalledWith(
      '削除した2件のタブを保存データに戻せます',
      expect.objectContaining({
        action: expect.objectContaining({
          label: '元に戻す',
        }),
      }),
    )

    const undoOptions = vi.mocked(toast.info).mock.calls.at(-1)?.[1] as
      | {
          action?: {
            onClick?: () => Promise<void>
          }
        }
      | undefined
    await undoOptions?.action?.onClick?.()

    expect(chromeSetMock).toHaveBeenLastCalledWith({
      customProjectOrder: ['project-1'],
      customProjects: customProjectsSnapshot,
      parentCategories: [],
      savedTabs: [groupWithIds, legacyGroup],
    })
  })

  it('URL一括削除はID解決できない場合 URL 文字列削除へフォールバックする', async () => {
    const group: TabGroup = {
      domain: 'example.com',
      id: 'group-1',
      urls: [
        {
          id: 'url-a',
          title: 'A',
          url: 'https://example.com/a',
        },
        {
          title: 'No ID',
          url: 'https://example.com/no-id',
        },
      ],
    }
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }
    mocked.tabDataState.tabGroups = [group]
    mocked.tabDataState.tabGroupsWithUrls = [group]

    render(<SavedTabsApp initialViewMode='domain' />)

    const domainProps = mocked.domainModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as {
      handleDeleteUrls: (groupId: string, urls: string[]) => Promise<void>
    }

    await domainProps.handleDeleteUrls('group-1', [
      'https://example.com/a',
      'https://example.com/no-id',
    ])

    expect(removeUrlsFromTabGroup).toHaveBeenCalledWith('group-1', [
      'https://example.com/a',
      'https://example.com/no-id',
    ])
  })

  it('未分類ドメインの並び替えを確定/キャンセルできる', async () => {
    const group1: TabGroup = {
      domain: 'a.example.com',
      id: 'group-1',
      urlIds: ['url-1'],
    }
    const group2: TabGroup = {
      domain: 'b.example.com',
      id: 'group-2',
      urlIds: ['url-2'],
    }
    mocked.projectState.viewMode = 'domain'
    mocked.projectState.viewModeRef = { current: 'domain' }
    mocked.tabDataState.tabGroups = [group1, group2]
    mocked.tabDataState.tabGroupsWithUrls = [group1, group2]
    const chromeSetMock = vi.fn()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({ savedTabs: [group1, group2] })),
          set: chromeSetMock,
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

    render(<SavedTabsApp initialViewMode='domain' />)

    let domainProps = mocked.domainModeContainerSpy.mock.calls.at(-1)?.[0] as {
      handleCancelUncategorizedReorder: () => void
      handleConfirmUncategorizedReorder: () => Promise<void>
      handleUncategorizedDragEnd: (event: {
        active: { id: string }
        over: { id: string }
      }) => void
    }

    fireEvent.change(screen.getByLabelText('search'), {
      target: { value: '' },
    })

    act(() => {
      domainProps.handleUncategorizedDragEnd({
        active: { id: 'group-1' },
        over: { id: 'group-2' },
      })
    })
    await waitFor(() => {
      expect(
        (
          mocked.domainModeContainerSpy.mock.calls.at(-1)?.[0] as {
            isUncategorizedReorderMode: boolean
          }
        ).isUncategorizedReorderMode,
      ).toBe(true)
    })
    domainProps = mocked.domainModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as typeof domainProps
    await domainProps.handleConfirmUncategorizedReorder()

    expect(chromeSetMock).toHaveBeenCalledWith({
      savedTabs: [group2, group1],
    })
    await waitFor(() => {
      expect(
        (
          mocked.domainModeContainerSpy.mock.calls.at(-1)?.[0] as {
            isUncategorizedReorderMode: boolean
          }
        ).isUncategorizedReorderMode,
      ).toBe(false)
    })
    domainProps = mocked.domainModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as typeof domainProps

    act(() => {
      domainProps.handleUncategorizedDragEnd({
        active: { id: 'group-2' },
        over: { id: 'group-1' },
      })
    })
    await waitFor(() => {
      expect(
        (
          mocked.domainModeContainerSpy.mock.calls.at(-1)?.[0] as {
            isUncategorizedReorderMode: boolean
          }
        ).isUncategorizedReorderMode,
      ).toBe(true)
    })
    domainProps = mocked.domainModeContainerSpy.mock.calls.at(
      -1,
    )?.[0] as typeof domainProps
    domainProps.handleCancelUncategorizedReorder()
  })

  it('storage change listener は mode sync service に委譲し解除される', async () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({ savedTabs: [] })),
          set: vi.fn(),
        },
        onChanged: {
          addListener,
          removeListener,
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

    const { unmount } = render(<SavedTabsApp />)
    const listener = addListener.mock.calls[0]?.[0] as (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => Promise<void>

    await listener({
      savedTabs: {
        newValue: [],
        oldValue: [],
      },
    })
    unmount()

    expect(syncStorageChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: {
          savedTabs: {
            newValue: [],
            oldValue: [],
          },
        },
      }),
    )
    expect(removeListener).toHaveBeenCalledWith(listener)
  })
})
