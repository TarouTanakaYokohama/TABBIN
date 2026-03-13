import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadAnalyticsRecords } from './loadAnalyticsRecords'

const mocks = vi.hoisted(() => ({
  buildAiSavedUrlRecords: vi.fn(() => [{ id: 'record-1' }]),
  getCustomProjects: vi.fn(async () => [{ id: 'project-1' }]),
  getParentCategories: vi.fn(async () => [{ id: 'category-1' }]),
  getUrlRecords: vi.fn(async () => [{ id: 'url-1' }]),
}))

vi.mock('@/features/ai-chat/lib/buildAiContext', () => ({
  buildAiSavedUrlRecords: mocks.buildAiSavedUrlRecords,
}))

vi.mock('@/lib/storage/categories', () => ({
  getParentCategories: mocks.getParentCategories,
}))

vi.mock('@/lib/storage/projects', () => ({
  getCustomProjects: mocks.getCustomProjects,
}))

vi.mock('@/lib/storage/urls', () => ({
  getUrlRecords: mocks.getUrlRecords,
}))

describe('loadAnalyticsRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({
            savedTabs: [{ id: 'group-1' }],
          })),
        },
      },
    } as unknown as typeof chrome
  })

  it('保存ストレージから分析レコードを組み立てる', async () => {
    await expect(loadAnalyticsRecords()).resolves.toEqual([{ id: 'record-1' }])

    expect(mocks.buildAiSavedUrlRecords).toHaveBeenCalledWith({
      customProjects: [{ id: 'project-1' }],
      parentCategories: [{ id: 'category-1' }],
      savedTabs: [{ id: 'group-1' }],
      urlRecords: [{ id: 'url-1' }],
    })
  })
})
