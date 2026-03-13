import { describe, expect, it } from 'vitest'
import type { CustomProject } from '@/types/storage'
import {
  findMatchingProjectIdForSavedTab,
  normalizeProjectKeywords,
} from './project-keywords'

const createProject = (
  overrides: Partial<CustomProject> = {},
): CustomProject => ({
  id: overrides.id ?? 'project-1',
  name: overrides.name ?? 'Project 1',
  projectKeywords:
    overrides.projectKeywords ?? normalizeProjectKeywords(undefined),
  categories: overrides.categories ?? [],
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1,
})

describe('project-keywords', () => {
  it('キーワード未設定時は空配列に正規化する', () => {
    expect(normalizeProjectKeywords(undefined)).toEqual({
      titleKeywords: [],
      urlKeywords: [],
      domainKeywords: [],
    })
  })

  it('タイトル部分一致でプロジェクトを選ぶ', () => {
    const projectId = findMatchingProjectIdForSavedTab({
      projects: [
        createProject({
          id: 'project-1',
          projectKeywords: {
            titleKeywords: ['release note'],
            urlKeywords: [],
            domainKeywords: [],
          },
        }),
      ],
      savedTab: {
        title: 'Release Notes for March',
        url: 'https://example.com/docs',
      },
      projectOrder: ['project-1'],
    })

    expect(projectId).toBe('project-1')
  })

  it('URL とドメインの部分一致でプロジェクトを選ぶ', () => {
    const projectId = findMatchingProjectIdForSavedTab({
      projects: [
        createProject({
          id: 'project-1',
          projectKeywords: {
            titleKeywords: [],
            urlKeywords: ['jira'],
            domainKeywords: ['company.com'],
          },
        }),
      ],
      savedTab: {
        title: 'Task',
        url: 'https://app.company.com/jira/ABC-123',
      },
      projectOrder: ['project-1'],
    })

    expect(projectId).toBe('project-1')
  })

  it('複数一致時は表示順の先頭を優先する', () => {
    const projectId = findMatchingProjectIdForSavedTab({
      projects: [
        createProject({
          id: 'project-a',
          projectKeywords: {
            titleKeywords: ['design'],
            urlKeywords: [],
            domainKeywords: [],
          },
        }),
        createProject({
          id: 'project-b',
          projectKeywords: {
            titleKeywords: ['design'],
            urlKeywords: [],
            domainKeywords: [],
          },
        }),
      ],
      savedTab: {
        title: 'Design Review',
        url: 'https://example.com',
      },
      projectOrder: ['project-b', 'project-a'],
    })

    expect(projectId).toBe('project-b')
  })

  it('一致しない場合は undefined を返す', () => {
    const projectId = findMatchingProjectIdForSavedTab({
      projects: [
        createProject({
          projectKeywords: {
            titleKeywords: ['urgent'],
            urlKeywords: ['docs'],
            domainKeywords: ['example.com'],
          },
        }),
      ],
      savedTab: {
        title: 'Weekly report',
        url: 'https://other.test/path',
      },
      projectOrder: ['project-1'],
    })

    expect(projectId).toBeUndefined()
  })
})
