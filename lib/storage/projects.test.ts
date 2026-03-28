import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomProject, TabGroup, UrlRecord } from '@/types/storage'

const mocks = vi.hoisted(() => {
  let uuidIndex = 0

  return {
    migrateToUrlsStorage: vi.fn(async () => undefined),
    reset: () => {
      uuidIndex = 0
      mocks.uuid.mockClear()
      mocks.migrateToUrlsStorage.mockClear()
    },
    uuid: vi.fn(() => `uuid-${++uuidIndex}`),
  }
})

vi.mock('uuid', () => ({
  v4: mocks.uuid,
}))

vi.mock('./url-migration', () => ({
  migrateToUrlsStorage: mocks.migrateToUrlsStorage,
}))

interface StorageState {
  customProjectOrder?: string[]
  customProjects?: CustomProject[]
  savedTabs?: TabGroup[]
  urls?: UrlRecord[]
}

const createChromeStorageLocal = (state: StorageState) => ({
  get: vi.fn(async (keys?: string | string[]) => {
    if (!keys) {
      return state
    }

    if (Array.isArray(keys)) {
      return Object.fromEntries(
        keys.map(key => [key, state[key as keyof StorageState]]),
      )
    }

    return {
      [keys]: state[keys as keyof StorageState],
    }
  }),
  set: vi.fn(async (value: Record<string, unknown>) => {
    Object.assign(state, value)
  }),
})

const createProject = (
  overrides: Partial<CustomProject> = {},
): CustomProject => ({
  id: overrides.id ?? 'project-1',
  name: overrides.name ?? 'Project 1',
  projectKeywords: overrides.projectKeywords ?? {
    titleKeywords: [],
    urlKeywords: [],
    domainKeywords: [],
  },
  urlIds: overrides.urlIds ?? [],
  categories: overrides.categories ?? [],
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1,
  urlMetadata: overrides.urlMetadata,
})

const loadModule = async () => {
  vi.resetModules()
  return import('./projects')
}

describe('projects storage', () => {
  beforeEach(() => {
    mocks.reset()
    vi.restoreAllMocks()
  })

  it('saveUrlsToCustomProjects は未分類から一致プロジェクトへURLを移す', async () => {
    const state: StorageState = {
      customProjectOrder: ['matched-project', 'custom-uncategorized'],
      customProjects: [
        createProject({
          id: 'matched-project',
          name: 'Matched',
          projectKeywords: {
            titleKeywords: [],
            urlKeywords: [],
            domainKeywords: ['docs.example.com'],
          },
        }),
        createProject({
          id: 'custom-uncategorized',
          name: '未分類',
          urlIds: ['url-1'],
        }),
      ],
      savedTabs: [],
      urls: [
        {
          id: 'url-1',
          url: 'https://docs.example.com/a',
          title: 'Doc',
          savedAt: 1,
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { saveUrlsToCustomProjects } = await loadModule()

    await saveUrlsToCustomProjects([
      {
        url: 'https://docs.example.com/a',
        title: 'Doc',
      },
    ])

    expect(state.customProjects).toEqual([
      expect.objectContaining({
        id: 'matched-project',
        urlIds: ['url-1'],
      }),
      expect.objectContaining({
        id: 'custom-uncategorized',
        urlIds: [],
      }),
    ])
  })

  it('addUrlToCustomProject は同じURLを他プロジェクトへ重複所属させない', async () => {
    const state: StorageState = {
      customProjects: [
        createProject({
          id: 'source-project',
          name: 'Source',
          urlIds: ['url-1'],
        }),
        createProject({
          id: 'target-project',
          name: 'Target',
        }),
      ],
      savedTabs: [
        {
          id: 'domain-group',
          domain: 'https://docs.example.com',
          urlIds: ['url-1'],
        },
      ],
      urls: [
        {
          id: 'url-1',
          url: 'https://docs.example.com/a',
          title: 'Doc',
          savedAt: 1,
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { addUrlToCustomProject } = await loadModule()

    await addUrlToCustomProject(
      'target-project',
      'https://docs.example.com/a',
      'Doc',
    )

    expect(state.customProjects).toEqual([
      expect.objectContaining({
        id: 'source-project',
        urlIds: [],
      }),
      expect.objectContaining({
        id: 'target-project',
        urlIds: ['url-1'],
      }),
    ])
  })
})
