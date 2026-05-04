// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomProject, UserSettings } from '@/types/storage'
import { useProjectManagement } from './useProjectManagement'

const projectManagementMocks = vi.hoisted(() => ({
  addCategoryToProject: vi.fn(),
  addUrlToCustomProject: vi.fn(),
  createCustomProject: vi.fn(),
  deleteCustomProject: vi.fn(),
  getCustomProjects: vi.fn(),
  removeCategoryFromProject: vi.fn(),
  removeUrlFromCustomProject: vi.fn(),
  removeUrlsFromCustomProject: vi.fn(),
  renameCategoryInProject: vi.fn(),
  reorderProjectUrls: vi.fn(),
  setUrlCategory: vi.fn(),
  updateCategoryOrder: vi.fn(),
  updateCustomProjectName: vi.fn(),
  updateProjectKeywords: vi.fn(),
  updateProjectOrder: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/features/i18n/context/I18nProvider', async () => {
  const { getMessages } = await vi.importActual<
    typeof import('@/features/i18n/messages')
  >('@/features/i18n/messages')

  return {
    useI18n: () => ({
      language: 'ja',
      t: (key: string, fallback?: string, values?: Record<string, string>) => {
        const messages = getMessages('ja')
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

vi.mock('@/lib/storage/projects', () => projectManagementMocks)

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

const projectSnapshot: CustomProject[] = [
  {
    id: 'project-1',
    name: 'Project A',
    urlIds: ['url-a', 'url-b'],
    categories: [],
    createdAt: 1,
    updatedAt: 2,
  },
]

const updatedProjects: CustomProject[] = [
  {
    ...projectSnapshot[0],
    urlIds: ['url-b'],
    updatedAt: 3,
  },
]

describe('useProjectManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projectManagementMocks.getCustomProjects.mockResolvedValue(projectSnapshot)

    const chromeSetMock = vi.fn()
    const chromeGlobal = globalThis as unknown as { chrome: typeof chrome }
    chromeGlobal.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({
            customProjectOrder: ['project-1'],
            customProjects: projectSnapshot,
          })),
          set: chromeSetMock,
        },
      },
    } as unknown as typeof chrome
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('カスタムモードの単体タブ削除を Undo で復元できる', async () => {
    projectManagementMocks.getCustomProjects
      .mockResolvedValueOnce(projectSnapshot)
      .mockResolvedValueOnce(updatedProjects)

    const { result } = renderHook(() =>
      useProjectManagement([], defaultSettings, 'custom'),
    )

    await waitFor(() => {
      expect(result.current.customProjects).toEqual(projectSnapshot)
    })

    await act(async () => {
      await result.current.handleDeleteUrlFromProject(
        'project-1',
        'https://example.com/a',
      )
    })

    expect(
      projectManagementMocks.removeUrlFromCustomProject,
    ).toHaveBeenCalledWith('project-1', 'https://example.com/a')
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

    await act(async () => {
      await undoOptions?.action?.onClick?.()
    })

    expect(chrome.storage.local.set).toHaveBeenLastCalledWith({
      customProjectOrder: ['project-1'],
      customProjects: projectSnapshot,
    })
    expect(result.current.customProjects).toEqual(projectSnapshot)
  })

  it('カスタムモードの一括タブ削除を Undo で復元できる', async () => {
    projectManagementMocks.getCustomProjects
      .mockResolvedValueOnce(projectSnapshot)
      .mockResolvedValueOnce([])

    const { result } = renderHook(() =>
      useProjectManagement([], defaultSettings, 'custom'),
    )

    await waitFor(() => {
      expect(result.current.customProjects).toEqual(projectSnapshot)
    })

    await act(async () => {
      await result.current.handleDeleteUrlsFromProject('project-1', [
        'https://example.com/a',
        'https://example.com/b',
      ])
    })

    expect(
      projectManagementMocks.removeUrlsFromCustomProject,
    ).toHaveBeenCalledWith('project-1', [
      'https://example.com/a',
      'https://example.com/b',
    ])
    expect(toast.info).toHaveBeenCalledWith(
      '削除した2件のタブを保存データに戻せます',
      expect.objectContaining({
        action: expect.objectContaining({
          label: '元に戻す',
        }),
      }),
    )
  })
})
