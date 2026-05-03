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
    vi.spyOn(Date, 'now').mockReturnValue(1000)
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

  it('getCustomProjects は不正データを除外し不足フィールドを補完して順序で返す', async () => {
    const validWithoutFields = {
      id: 'project-a',
      name: 'Project A',
    } as CustomProject
    const ordered = createProject({
      id: 'project-b',
      name: 'Project B',
      urlIds: ['url-b'],
    })
    const state: StorageState = {
      customProjectOrder: ['project-b'],
      customProjects: [
        validWithoutFields,
        null as unknown as CustomProject,
        { id: 'missing-name' } as CustomProject,
        ordered,
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { getCustomProjects } = await loadModule()

    await expect(getCustomProjects()).resolves.toEqual([
      expect.objectContaining({
        id: 'project-b',
        name: 'Project B',
      }),
      expect.objectContaining({
        categories: [],
        createdAt: 1000,
        id: 'project-a',
        name: 'Project A',
        updatedAt: 1000,
        urlIds: [],
      }),
    ])
    expect(state.customProjects).toHaveLength(2)
  })

  it('getProjectUrls はURL IDがなければ空配列、あればメタデータ付きで返す', async () => {
    const state: StorageState = {
      urls: [
        {
          id: 'url-1',
          savedAt: 1,
          title: 'One',
          url: 'https://example.test/one',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { getProjectUrls } = await loadModule()

    await expect(getProjectUrls(createProject())).resolves.toEqual([])
    await expect(
      getProjectUrls(
        createProject({
          urlIds: ['url-1'],
          urlMetadata: {
            'url-1': {
              category: 'docs',
              notes: 'note',
            },
          },
        }),
      ),
    ).resolves.toEqual([
      {
        category: 'docs',
        id: 'url-1',
        notes: 'note',
        savedAt: 1,
        title: 'One',
        url: 'https://example.test/one',
      },
    ])
  })

  it('getCustomProjects はストレージ取得に失敗したら空配列を返す', async () => {
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => {
            throw new Error('storage unavailable')
          }),
          set: vi.fn(),
        },
      },
    } as unknown as typeof chrome

    const { getCustomProjects } = await loadModule()

    await expect(getCustomProjects()).resolves.toEqual([])
  })

  it('createCustomProject は重複名を拒否し新規プロジェクトを先頭順序に保存する', async () => {
    const state: StorageState = {
      customProjectOrder: ['project-2'],
      customProjects: [
        createProject({ id: 'project-1', name: 'Alpha' }),
        createProject({ id: 'project-2', name: 'Beta' }),
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { createCustomProject } = await loadModule()

    await expect(createCustomProject('alpha')).rejects.toThrow(
      'DUPLICATE_PROJECT_NAME:alpha',
    )
    await expect(createCustomProject('Gamma')).resolves.toEqual(
      expect.objectContaining({
        id: 'uuid-1',
        name: 'Gamma',
        urlIds: [],
      }),
    )
    expect(state.customProjectOrder).toEqual([
      'uuid-1',
      'project-2',
      'project-1',
    ])
  })

  it('getOrCreateUncategorizedProject は未分類を作成して順序末尾に追加する', async () => {
    const state: StorageState = {
      customProjectOrder: ['project-1'],
      customProjects: [createProject()],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { getOrCreateUncategorizedProject } = await loadModule()

    await expect(getOrCreateUncategorizedProject()).resolves.toEqual(
      expect.objectContaining({
        id: 'custom-uncategorized',
        name: '未分類',
      }),
    )
    expect(state.customProjects?.map(project => project.id)).toEqual([
      'project-1',
      'custom-uncategorized',
    ])
    expect(state.customProjectOrder).toEqual([
      'project-1',
      'custom-uncategorized',
    ])
  })

  it('addUrlsToUncategorizedProject は空/重複を除き既存URLを更新して他プロジェクトから移す', async () => {
    const state: StorageState = {
      customProjectOrder: ['source'],
      customProjects: [
        createProject({
          id: 'source',
          urlIds: ['url-1'],
          urlMetadata: {
            'url-1': {
              category: 'docs',
              notes: 'drop',
            },
          },
        }),
      ],
      urls: [
        {
          id: 'url-1',
          savedAt: 1,
          title: 'Old',
          url: 'https://example.test/a',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { addUrlsToUncategorizedProject } = await loadModule()

    await addUrlsToUncategorizedProject([
      { title: 'Updated', url: ' https://example.test/a ' },
      { title: 'Duplicate ignored', url: 'https://example.test/a' },
      { title: 'New', url: 'https://example.test/b' },
      { title: 'Blank ignored', url: ' ' },
    ])

    expect(state.urls).toEqual([
      {
        id: 'url-1',
        savedAt: 1000,
        title: 'Updated',
        url: 'https://example.test/a',
      },
      {
        id: 'uuid-1',
        savedAt: 1000,
        title: 'New',
        url: 'https://example.test/b',
      },
    ])
    expect(state.customProjects).toEqual([
      expect.objectContaining({
        id: 'source',
        urlIds: [],
        urlMetadata: {},
      }),
      expect.objectContaining({
        id: 'custom-uncategorized',
        urlIds: ['url-1', 'uuid-1'],
      }),
    ])
  })

  it('addUrlToCustomProject は新規URLをドメインモードにも追加しメタデータを保存する', async () => {
    const state: StorageState = {
      customProjects: [createProject({ id: 'target' })],
      savedTabs: [],
      urls: [],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { addUrlToCustomProject } = await loadModule()

    await addUrlToCustomProject('target', 'https://docs.example.com/a', 'Doc', {
      category: 'docs',
      notes: 'note',
    })

    expect(state.urls).toEqual([
      {
        id: 'uuid-1',
        savedAt: 1000,
        title: 'Doc',
        url: 'https://docs.example.com/a',
      },
    ])
    expect(state.customProjects).toEqual([
      expect.objectContaining({
        id: 'target',
        urlIds: ['uuid-1'],
        urlMetadata: {
          'uuid-1': {
            category: 'docs',
            notes: 'note',
          },
        },
      }),
    ])
    expect(state.savedTabs).toEqual([
      {
        domain: 'https://docs.example.com',
        id: 'uuid-2',
        savedAt: 1000,
        urlIds: ['uuid-1'],
      },
    ])
  })

  it('removeUrlFromCustomProject はURLとメタデータを消し空のドメイングループも削除する', async () => {
    const state: StorageState = {
      customProjects: [
        createProject({
          id: 'target',
          urlIds: ['url-1'],
          urlMetadata: {
            'url-1': {
              category: 'docs',
              notes: 'remove',
            },
          },
        }),
      ],
      savedTabs: [
        {
          domain: 'https://docs.example.com',
          id: 'group-1',
          urlIds: ['url-1'],
        },
      ],
      urls: [
        {
          id: 'url-1',
          savedAt: 1,
          title: 'Doc',
          url: 'https://docs.example.com/a',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { removeUrlFromCustomProject } = await loadModule()

    await removeUrlFromCustomProject('target', 'https://docs.example.com/a')

    expect(state.customProjects?.[0]).toEqual(
      expect.objectContaining({
        urlIds: [],
        urlMetadata: {},
      }),
    )
    expect(state.savedTabs).toEqual([])
  })

  it('bulk remove APIs はURL/ID指定でプロジェクトとドメインモードを同期削除する', async () => {
    const state: StorageState = {
      customProjects: [
        createProject({
          id: 'target',
          urlIds: ['url-1', 'url-2', 'url-3'],
          urlMetadata: {
            'url-1': { notes: 'one' },
            'url-2': { notes: 'two' },
            'url-3': { notes: 'three' },
          },
        }),
      ],
      savedTabs: [
        {
          domain: 'https://docs.example.com',
          id: 'group-1',
          urlIds: ['url-1', 'url-2', 'url-3'],
        },
      ],
      urls: [
        {
          id: 'url-1',
          savedAt: 1,
          title: 'One',
          url: 'https://docs.example.com/one',
        },
        {
          id: 'url-2',
          savedAt: 2,
          title: 'Two',
          url: 'https://docs.example.com/two',
        },
        {
          id: 'url-3',
          savedAt: 3,
          title: 'Three',
          url: 'https://docs.example.com/three',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const {
      removeUrlIdsFromAllCustomProjects,
      removeUrlsFromAllCustomProjects,
      removeUrlsFromCustomProject,
    } = await loadModule()

    await removeUrlsFromCustomProject('target', [
      'https://docs.example.com/one',
    ])
    await removeUrlsFromAllCustomProjects(['https://docs.example.com/two'])
    await removeUrlIdsFromAllCustomProjects(['url-3'])

    expect(state.customProjects?.[0]).toEqual(
      expect.objectContaining({
        urlIds: [],
        urlMetadata: {},
      }),
    )
    expect(state.savedTabs).toEqual([
      {
        domain: 'https://docs.example.com',
        id: 'group-1',
        urlIds: ['url-2', 'url-3'],
      },
    ])
  })

  it('deleteCustomProject はURLとメモを未分類へ移して順序から削除する', async () => {
    const state: StorageState = {
      customProjectOrder: ['delete-me', 'custom-uncategorized'],
      customProjects: [
        createProject({
          id: 'delete-me',
          urlIds: ['url-1', 'url-2'],
          urlMetadata: {
            'url-1': { notes: 'keep note' },
            'url-2': { category: 'drop-category-only' },
          },
        }),
        createProject({
          id: 'custom-uncategorized',
          name: '未分類',
          urlIds: ['url-2'],
        }),
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { deleteCustomProject } = await loadModule()

    await deleteCustomProject('delete-me')

    expect(state.customProjects).toEqual([
      expect.objectContaining({
        id: 'custom-uncategorized',
        urlIds: ['url-2', 'url-1'],
        urlMetadata: {
          'url-1': {
            notes: 'keep note',
          },
        },
      }),
    ])
    expect(state.customProjectOrder).toEqual(['custom-uncategorized'])
  })

  it('カテゴリ/並び順/名称/キーワード API は対象プロジェクトだけを更新する', async () => {
    const state: StorageState = {
      customProjects: [
        createProject({
          id: 'target',
          categories: ['old', 'keep'],
          categoryOrder: ['old', 'keep'],
          urlIds: ['url-1', 'url-2'],
          urlMetadata: {
            'url-1': { category: 'old' },
            'url-2': { category: 'keep' },
          },
        }),
        createProject({ id: 'other', name: 'Other' }),
      ],
      urls: [
        {
          id: 'url-1',
          savedAt: 1,
          title: 'One',
          url: 'https://example.test/one',
        },
        {
          id: 'url-2',
          savedAt: 2,
          title: 'Two',
          url: 'https://example.test/two',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const {
      addCategoryToProject,
      removeCategoryFromProject,
      renameCategoryInProject,
      reorderProjectUrls,
      setUrlCategory,
      updateCategoryOrder,
      updateCustomProjectName,
      updateProjectKeywords,
      updateProjectOrder,
    } = await loadModule()

    await addCategoryToProject('target', 'new')
    await addCategoryToProject('target', 'new')
    await setUrlCategory('target', 'https://example.test/two', 'new')
    await renameCategoryInProject('target', 'old', 'renamed')
    await removeCategoryFromProject('target', 'keep')
    await updateCategoryOrder('target', ['new', 'renamed'])
    await reorderProjectUrls('target', [
      { title: 'Two', url: 'https://example.test/two' },
      { title: 'One', url: 'https://example.test/one' },
    ])
    await updateCustomProjectName('target', 'Renamed Project')
    await updateProjectKeywords('target', {
      domainKeywords: ['example.test'],
      titleKeywords: ['One'],
      urlKeywords: ['two'],
    })
    await updateProjectOrder(['target', 'other'])

    expect(state.customProjects?.[0]).toEqual(
      expect.objectContaining({
        categoryOrder: ['new', 'renamed'],
        categories: ['renamed', 'new'],
        name: 'Renamed Project',
        projectKeywords: {
          domainKeywords: ['example.test'],
          titleKeywords: ['One'],
          urlKeywords: ['two'],
        },
        urlIds: ['url-2', 'url-1'],
        urlMetadata: {
          'url-1': {
            category: 'renamed',
          },
          'url-2': {
            category: 'new',
          },
        },
      }),
    )
    expect(state.customProjectOrder).toEqual(['target', 'other'])
  })

  it('moveUrlBetweenCustomProjects はURLとメモを移動しエラー条件を扱う', async () => {
    const state: StorageState = {
      customProjects: [
        createProject({
          id: 'source',
          urlIds: ['url-1'],
          urlMetadata: {
            'url-1': {
              category: 'source-category',
              notes: 'move note',
            },
          },
        }),
        createProject({
          id: 'target',
          urlIds: [],
        }),
      ],
      urls: [
        {
          id: 'url-1',
          savedAt: 1,
          title: 'Move',
          url: 'https://example.test/move',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const { moveUrlBetweenCustomProjects } = await loadModule()

    await moveUrlBetweenCustomProjects(
      'source',
      'target',
      'https://example.test/move',
    )
    await moveUrlBetweenCustomProjects(
      'target',
      'target',
      'https://example.test/move',
    )

    expect(state.customProjects).toEqual([
      expect.objectContaining({
        id: 'source',
        urlIds: [],
        urlMetadata: {},
      }),
      expect.objectContaining({
        id: 'target',
        urlIds: ['url-1'],
        urlMetadata: {
          'url-1': {
            notes: 'move note',
          },
        },
      }),
    ])
    await expect(
      moveUrlBetweenCustomProjects(
        'source',
        'target',
        'https://example.test/missing',
      ),
    ).rejects.toThrow('URL not found in source project')
  })

  it('moveUrlBetweenCustomProjects は存在しないプロジェクト・重複先を拒否する', async () => {
    const state: StorageState = {
      customProjects: [
        createProject({
          categories: ['keep'],
          id: 'source',
          urlIds: ['url-1'],
        }),
        createProject({
          id: 'target',
          urlIds: ['url-1'],
        }),
      ],
      urls: [
        {
          id: 'url-1',
          savedAt: 1,
          title: 'Move',
          url: 'https://example.test/move',
        },
      ],
    }
    globalThis.chrome = {
      storage: {
        local: createChromeStorageLocal(state),
      },
    } as unknown as typeof chrome

    const {
      moveUrlBetweenCustomProjects,
      renameCategoryInProject,
      updateProjectKeywords,
      updateProjectOrder,
    } = await loadModule()

    await expect(
      moveUrlBetweenCustomProjects(
        'missing',
        'target',
        'https://example.test/move',
      ),
    ).rejects.toThrow('Source or target project not found')
    await expect(
      moveUrlBetweenCustomProjects(
        'source',
        'target',
        'https://example.test/move',
      ),
    ).rejects.toThrow('URL already exists in target project')
    await expect(
      renameCategoryInProject('missing', 'old', 'new'),
    ).rejects.toThrow('Project with ID missing not found')
    await expect(
      renameCategoryInProject('source', 'old', 'keep'),
    ).rejects.toThrow('Category name keep already exists in project source')
    await expect(
      updateProjectKeywords('missing', {
        titleKeywords: [],
        urlKeywords: [],
        domainKeywords: [],
      }),
    ).rejects.toThrow('Project with ID missing not found')

    const setMock = vi.mocked(chrome.storage.local.set)
    setMock.mockRejectedValueOnce(new Error('write failed'))
    await expect(updateProjectOrder(['source'])).rejects.toThrow('write failed')
  })
})
