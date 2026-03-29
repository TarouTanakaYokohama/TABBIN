import { v4 as uuidv4 } from 'uuid'
import type {
  CustomProject,
  ProjectKeywordSettings,
  TabGroup,
  UrlRecord,
} from '@/types/storage'
import {
  findMatchingProjectIdForSavedTab,
  normalizeProjectKeywords,
} from './project-keywords'
import { migrateToUrlsStorage } from './url-migration'
import {
  createOrUpdateUrlRecord,
  getUrlRecords,
  getUrlRecordsByIds,
  saveUrlRecords,
} from './urls'

const CUSTOM_UNCATEGORIZED_PROJECT_ID = 'custom-uncategorized'
const CUSTOM_UNCATEGORIZED_PROJECT_NAME = '未分類'

interface SavedTabItem {
  url: string
  title: string
}

/**
 * CustomProjectからURLデータを取得する（新旧形式対応）
 */
const getProjectUrls = async (
  project: CustomProject,
): Promise<
  Array<
    UrlRecord & {
      notes?: string
      category?: string
    }
  >
> => {
  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()

  // 新形式のみサポート: URLIDsから参照して取得
  if (project.urlIds && project.urlIds.length > 0) {
    const urlRecords = await getUrlRecordsByIds(project.urlIds)
    return urlRecords.map(record => ({
      ...record,
      notes: project.urlMetadata?.[record.id]?.notes,
      category: project.urlMetadata?.[record.id]?.category,
    }))
  }
  return []
} // カスタムプロジェクト一覧を取得する関数
const getCustomProjects = async (): Promise<CustomProject[]> => {
  try {
    // マイグレーションを実行（未実行の場合）
    await migrateToUrlsStorage()

    // プロジェクトとプロジェクト順序を同時に取得
    const data = await chrome.storage.local.get<{
      customProjects?: CustomProject[]
      customProjectOrder?: string[]
    }>(['customProjects', 'customProjectOrder'])
    const customProjects = data.customProjects || []
    const projectOrder = data.customProjectOrder || []
    console.log(
      `ストレージから取得したカスタムプロジェクト: ${customProjects.length}個`,
    )

    // 不正なプロジェクトデータをフィルタリング
    const validProjects = customProjects
      .filter(
        (project: unknown) =>
          project &&
          typeof project === 'object' &&
          project !== null &&
          'id' in project &&
          'name' in project,
      )
      .map((project: CustomProject) => {
        // 新形式のURLIDsが存在しない場合は初期化
        if (!(project.urlIds && Array.isArray(project.urlIds))) {
          project.urlIds = []
        }
        project.projectKeywords = normalizeProjectKeywords(
          project.projectKeywords,
        )

        // 必須フィールドの確認と修正
        if (!(project.categories && Array.isArray(project.categories))) {
          project.categories = []
        }
        if (!project.updatedAt) {
          project.updatedAt = Date.now()
        }
        if (!project.createdAt) {
          project.createdAt = Date.now()
        }
        return project
      })
    if (validProjects.length !== customProjects.length) {
      console.warn(
        `不正なプロジェクトデータが検出されました: ${customProjects.length - validProjects.length}個を修復`,
      )
      // 修復したデータを自動保存
      await chrome.storage.local.set({
        customProjects: validProjects,
      })
    }

    // 順序が保存されている場合、その順序でソート
    if (projectOrder.length > 0) {
      return [...validProjects].sort((a, b) => {
        const indexA = projectOrder.indexOf(a.id)
        const indexB = projectOrder.indexOf(b.id)
        // 順序にないプロジェクトは最後に
        if (indexA === -1) {
          return 1
        }
        if (indexB === -1) {
          return -1
        }
        return indexA - indexB
      })
    }
    return validProjects
  } catch (error) {
    console.error('カスタムプロジェクト取得エラー:', error)
    return []
  }
} // カスタムプロジェクト一覧を保存する関数
const saveCustomProjects = async (projects: CustomProject[]): Promise<void> => {
  try {
    await chrome.storage.local.set({
      customProjects: projects,
    })
    console.log(`${projects.length}個のカスタムプロジェクトを保存しました`)
  } catch (error) {
    console.error('カスタムプロジェクト保存エラー:', error)
    throw error
  }
} // 新しいカスタムプロジェクトを作成する関数
const createCustomProject = async (name: string): Promise<CustomProject> => {
  const projects = await getCustomProjects()

  // 重複チェック
  if (
    projects.some(project => project.name.toLowerCase() === name.toLowerCase())
  ) {
    throw new Error(`DUPLICATE_PROJECT_NAME:${name}`)
  }
  const newProject: CustomProject = {
    id: uuidv4(),
    name,
    projectKeywords: normalizeProjectKeywords(undefined),
    urlIds: [],
    // 新形式のURL IDリスト
    categories: [],
    // 空のカテゴリリストで初期化
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await saveCustomProjects([...projects, newProject])

  // 新規プロジェクトを常に先頭に配置し、既存順序は維持する
  const { customProjectOrder = [] } =
    await chrome.storage.local.get('customProjectOrder')
  const currentIdsInDisplayOrder = projects.map(project => project.id)
  const normalizedOrder = Array.isArray(customProjectOrder)
    ? customProjectOrder.filter(
        (id): id is string =>
          typeof id === 'string' && currentIdsInDisplayOrder.includes(id),
      )
    : []
  const missingIds = currentIdsInDisplayOrder.filter(
    id => !normalizedOrder.includes(id),
  )
  const nextOrder = [newProject.id, ...normalizedOrder, ...missingIds]
  await chrome.storage.local.set({
    customProjectOrder: nextOrder,
  })

  return newProject
}

const appendUncategorizedProjectToOrder = async (): Promise<void> => {
  const { customProjectOrder = [] } =
    await chrome.storage.local.get('customProjectOrder')
  if (!Array.isArray(customProjectOrder)) {
    return
  }
  if (customProjectOrder.includes(CUSTOM_UNCATEGORIZED_PROJECT_ID)) {
    return
  }
  await chrome.storage.local.set({
    customProjectOrder: [
      ...customProjectOrder,
      CUSTOM_UNCATEGORIZED_PROJECT_ID,
    ],
  })
}

const buildUncategorizedProject = (): CustomProject => ({
  id: CUSTOM_UNCATEGORIZED_PROJECT_ID,
  name: CUSTOM_UNCATEGORIZED_PROJECT_NAME,
  projectKeywords: normalizeProjectKeywords(undefined),
  urlIds: [],
  categories: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

const getOrCreateUncategorizedProject = async (): Promise<CustomProject> => {
  const projects = await getCustomProjects()
  const found = projects.find(
    project => project.id === CUSTOM_UNCATEGORIZED_PROJECT_ID,
  )
  if (found) {
    return found
  }
  const uncategorizedProject = buildUncategorizedProject()
  await saveCustomProjects([...projects, uncategorizedProject])
  await appendUncategorizedProjectToOrder()
  return uncategorizedProject
}

const uniqueSavedTabItems = (items: SavedTabItem[]): SavedTabItem[] => {
  const seen = new Set<string>()
  const uniqueItems: SavedTabItem[] = []
  for (const item of items) {
    const trimmedUrl = item.url?.trim()
    if (!trimmedUrl) {
      continue
    }
    if (seen.has(trimmedUrl)) {
      continue
    }
    seen.add(trimmedUrl)
    uniqueItems.push({
      url: trimmedUrl,
      title: item.title || '',
    })
  }
  return uniqueItems
}

const addUrlsToUncategorizedProject = async (
  urls: SavedTabItem[],
): Promise<void> => {
  const normalizedItems = uniqueSavedTabItems(urls)
  if (normalizedItems.length === 0) {
    return
  }

  await migrateToUrlsStorage()
  const projects = await getCustomProjects()
  let targetIndex = projects.findIndex(
    project => project.id === CUSTOM_UNCATEGORIZED_PROJECT_ID,
  )
  if (targetIndex === -1) {
    projects.push(buildUncategorizedProject())
    targetIndex = projects.length - 1
    await appendUncategorizedProjectToOrder()
  }

  const targetProject = projects[targetIndex]
  if (!targetProject.urlIds) {
    targetProject.urlIds = []
  }
  const urlIdSet = new Set(targetProject.urlIds)
  const now = Date.now()
  const urlRecords = await getUrlRecords()
  const updatedUrlRecords = [...urlRecords]
  const recordIndexByUrl = new Map(
    updatedUrlRecords.map((record, index) => [record.url, index]),
  )
  let urlRecordsChanged = false

  for (const item of normalizedItems) {
    const recordIndex = recordIndexByUrl.get(item.url)
    let urlId: string

    if (recordIndex == null) {
      const newRecord: UrlRecord = {
        id: uuidv4(),
        url: item.url,
        title: item.title || '',
        savedAt: now,
      }
      updatedUrlRecords.push(newRecord)
      recordIndexByUrl.set(item.url, updatedUrlRecords.length - 1)
      urlRecordsChanged = true
      urlId = newRecord.id
    } else {
      const existingRecord = updatedUrlRecords[recordIndex]
      const nextTitle = item.title || existingRecord.title || ''
      updatedUrlRecords[recordIndex] = {
        ...existingRecord,
        title: nextTitle,
        savedAt: now,
      }
      urlRecordsChanged = true
      urlId = existingRecord.id
    }

    removeUrlIdFromOtherProjects(
      projects,
      urlId,
      CUSTOM_UNCATEGORIZED_PROJECT_ID,
      now,
    )

    if (urlIdSet.has(urlId)) {
      continue
    }
    urlIdSet.add(urlId)
    targetProject.urlIds.push(urlId)
  }

  if (urlRecordsChanged) {
    await saveUrlRecords(updatedUrlRecords)
  }

  targetProject.updatedAt = Date.now()
  projects[targetIndex] = targetProject
  await saveCustomProjects(projects)
}

const getCustomProjectOrder = async (): Promise<string[]> => {
  const { customProjectOrder = [] } =
    await chrome.storage.local.get('customProjectOrder')
  if (!Array.isArray(customProjectOrder)) {
    return []
  }
  return customProjectOrder.filter(
    (projectId): projectId is string => typeof projectId === 'string',
  )
}
const ensureProjectUrlIds = (project: CustomProject): void => {
  if (!project.urlIds) {
    project.urlIds = []
  }
}
const addUrlIdToProject = (project: CustomProject, urlId: string): boolean => {
  ensureProjectUrlIds(project)
  let urlIds = project.urlIds
  if (!urlIds) {
    urlIds = []
    project.urlIds = urlIds
  }
  if (urlIds.includes(urlId)) {
    return false
  }
  urlIds.push(urlId)
  return true
}

const removeUrlIdFromProject = (
  project: CustomProject,
  urlId: string,
  updatedAt: number,
): boolean => {
  if (!project.urlIds?.includes(urlId)) {
    return false
  }

  project.urlIds = project.urlIds.filter(id => id !== urlId)
  if (project.urlMetadata?.[urlId]) {
    delete project.urlMetadata[urlId]
  }
  project.updatedAt = updatedAt
  return true
}

const removeUrlIdFromOtherProjects = (
  projects: CustomProject[],
  urlId: string,
  keepProjectId: string,
  updatedAt = Date.now(),
): boolean => {
  let hasChanges = false
  for (const project of projects) {
    if (project.id === keepProjectId) {
      continue
    }

    if (removeUrlIdFromProject(project, urlId, updatedAt)) {
      hasChanges = true
    }
  }

  return hasChanges
}

const setProjectUrlMetadata = (
  project: CustomProject,
  urlId: string,
  notes?: string,
  category?: string,
): void => {
  if (!(notes || category)) {
    return
  }
  if (!project.urlMetadata) {
    project.urlMetadata = {}
  }
  project.urlMetadata[urlId] = {
    notes,
    category,
  }
}
const getDomainFromUrl = (url: string): string => {
  const urlObj = new URL(url)
  return `${urlObj.protocol}//${urlObj.hostname}`
}
const ensureUrlIdInGroup = (group: TabGroup, urlId: string): TabGroup => {
  if (!group.urlIds) {
    group.urlIds = []
  }
  if (!group.urlIds.includes(urlId)) {
    group.urlIds.push(urlId)
  }
  return group
}
const addUrlIdToDomainMode = async (
  url: string,
  urlId: string,
): Promise<void> => {
  const { savedTabs = [] } = await chrome.storage.local.get<{
    savedTabs?: import('@/types/storage').TabGroup[]
  }>('savedTabs')
  const domain = getDomainFromUrl(url)
  const domainGroup = savedTabs.find(
    (group: TabGroup) => group.domain === domain,
  )
  if (domainGroup) {
    ensureUrlIdInGroup(domainGroup, urlId)
  } else {
    savedTabs.push({
      id: uuidv4(),
      domain,
      urlIds: [urlId],
      savedAt: Date.now(),
    })
  }
  await chrome.storage.local.set({
    savedTabs,
  })
  console.log(`URL ${url} をドメインモードのデータにも追加しました`)
} // URLをカスタムプロジェクトに追加する関数（新形式対応）
const addUrlToCustomProject = async (
  projectId: string,
  url: string,
  title: string,
  options?: {
    notes?: string
    category?: string
  },
): Promise<void> => {
  try {
    // マイグレーションを実行（未実行の場合）
    await migrateToUrlsStorage()
    const projects = await getCustomProjects()
    const projectIndex = projects.findIndex(p => p.id === projectId)
    if (projectIndex === -1) {
      throw new Error(`Project with ID ${projectId} not found`)
    }
    const project = projects[projectIndex]

    // URLレコードを作成または更新
    const urlRecord = await createOrUpdateUrlRecord(url, title)
    removeUrlIdFromOtherProjects(projects, urlRecord.id, projectId)
    const isNewUrl = addUrlIdToProject(project, urlRecord.id)
    setProjectUrlMetadata(
      project,
      urlRecord.id,
      options?.notes,
      options?.category,
    )
    if (isNewUrl) {
      await addUrlIdToDomainMode(url, urlRecord.id)
    }
    project.updatedAt = Date.now()
    projects[projectIndex] = project
    await saveCustomProjects(projects)
    console.log(
      `${isNewUrl ? '新しい' : '既存の'}URLをプロジェクトに${isNewUrl ? '追加' : '更新'}しました: ${url}`,
    )
  } catch (error) {
    console.error('URLをプロジェクトに追加中にエラーが発生しました:', error)
    throw error
  }
} // URLをカスタムプロジェクトから削除する関数（新形式対応）

const saveUrlsToCustomProjects = async (
  urls: SavedTabItem[],
): Promise<void> => {
  const normalizedItems = uniqueSavedTabItems(urls)
  if (normalizedItems.length === 0) {
    return
  }

  const [projects, projectOrder] = await Promise.all([
    getCustomProjects(),
    getCustomProjectOrder(),
  ])
  const matchingProjects = projects.filter(
    project => project.id !== CUSTOM_UNCATEGORIZED_PROJECT_ID,
  )
  const uncategorizedItems: SavedTabItem[] = []

  for (const item of normalizedItems) {
    const matchedProjectId = findMatchingProjectIdForSavedTab({
      projects: matchingProjects,
      savedTab: item,
      projectOrder,
    })

    if (!matchedProjectId) {
      uncategorizedItems.push(item)
      continue
    }

    await addUrlToCustomProject(matchedProjectId, item.url, item.title)
  }

  await addUrlsToUncategorizedProject(uncategorizedItems)
}
const removeUrlFromCustomProject = async (
  projectId: string,
  url: string,
): Promise<void> => {
  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }
  const project = projects[projectIndex]

  // 新形式のみサポート: URLIDsからURLを削除
  if (project.urlIds && project.urlIds.length > 0) {
    const urlRecords = await getUrlRecordsByIds(project.urlIds)
    const urlRecord = urlRecords.find(record => record.url === url)
    if (urlRecord) {
      project.urlIds = project.urlIds.filter(id => id !== urlRecord.id)

      // メタデータも削除
      if (project.urlMetadata?.[urlRecord.id]) {
        delete project.urlMetadata[urlRecord.id]
      }
    }
  }
  project.updatedAt = Date.now()
  projects[projectIndex] = project
  await saveCustomProjects(projects)

  // ドメインモードからも同じURLを削除
  try {
    const { savedTabs = [] } = await chrome.storage.local.get<{
      savedTabs?: import('@/types/storage').TabGroup[]
    }>('savedTabs')

    // URLレコードを取得
    const urlRecords = await getUrlRecordsByIds(
      savedTabs.flatMap((group: TabGroup) => group.urlIds || []),
    )
    const urlRecord = urlRecords.find(record => record.url === url)
    if (urlRecord) {
      const updatedGroups = savedTabs
        .map((group: TabGroup) => {
          if (group.urlIds) {
            const updatedUrlIds = group.urlIds.filter(id => id !== urlRecord.id)
            if (updatedUrlIds.length === 0) {
              return null // URLが0になったらグループを削除
            }
            return {
              ...group,
              urlIds: updatedUrlIds,
            }
          }
          return group
        })
        .filter((group: TabGroup | null): group is TabGroup => group !== null)
      await chrome.storage.local.set({
        savedTabs: updatedGroups,
      })
      console.log(`URL ${url} はドメインモードからも削除されました`)
    }
  } catch (syncError) {
    console.error('ドメインモードの同期中にエラーが発生しました:', syncError)
    // エラーをスローしないで続行 - カスタムプロジェクトの削除は成功している
  }
}

/**
 * ドメインモードからも指定されたURLを同期削除するヘルパー関数
 */
const syncDeleteToDomainMode = async (
  targetUrlsSet: Set<string>,
  urlsLength: number,
): Promise<void> => {
  try {
    const { savedTabs = [] } = await chrome.storage.local.get<{
      savedTabs?: import('@/types/storage').TabGroup[]
    }>('savedTabs')

    const urlRecords = await getUrlRecordsByIds(
      savedTabs.flatMap((g: TabGroup) => g.urlIds || []),
    )
    const recordsToDelete = urlRecords.filter(record =>
      targetUrlsSet.has(record.url),
    )

    if (recordsToDelete.length > 0) {
      const idsToDelete = new Set(recordsToDelete.map(r => r.id))
      const updatedGroups = savedTabs
        .map((group: TabGroup) => {
          if (group.urlIds) {
            const updatedUrlIds = group.urlIds.filter(
              id => !idsToDelete.has(id),
            )
            if (updatedUrlIds.length === 0) {
              return null
            }
            return {
              ...group,
              urlIds: updatedUrlIds,
            }
          }
          return group
        })
        .filter((group: TabGroup | null): group is TabGroup => group !== null)

      await chrome.storage.local.set({
        savedTabs: updatedGroups,
      })
      console.log(`${urlsLength}件のURLはドメインモードからも削除されました`)
    }
  } catch (syncError) {
    console.error('ドメインモードの同期中にエラーが発生しました:', syncError)
  }
}

/**
 * プロジェクトのURL IDsとメタデータから指定IDを削除する内部関数
 * @returns 変更があったかどうか
 */
const updateProjectUrlIdsAndMetadata = (
  project: CustomProject,
  idsToDelete: Set<string>,
): boolean => {
  if (!project.urlIds || project.urlIds.length === 0) {
    return false
  }

  const hasOverlap = project.urlIds.some(id => idsToDelete.has(id))
  if (hasOverlap) {
    project.urlIds = project.urlIds.filter(id => !idsToDelete.has(id))

    if (project.urlMetadata) {
      for (const id of idsToDelete) {
        if (project.urlMetadata[id]) {
          delete project.urlMetadata[id]
        }
      }
    }
    project.updatedAt = Date.now()
    return true
  }
  return false
}

/**
 * 特定のプロジェクトから複数の URL をまとめて削除する。
 */
const removeUrlsFromCustomProject = async (
  projectId: string,
  urls: string[],
): Promise<void> => {
  if (urls.length === 0) {
    return
  }

  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }

  const project = projects[projectIndex]
  const targetUrlsSet = new Set(urls)

  if (project.urlIds && project.urlIds.length > 0) {
    const urlRecords = await getUrlRecordsByIds(project.urlIds)
    const recordsToDelete = urlRecords.filter(record =>
      targetUrlsSet.has(record.url),
    )

    if (recordsToDelete.length > 0) {
      const idsToDelete = new Set(recordsToDelete.map(r => r.id))

      if (updateProjectUrlIdsAndMetadata(project, idsToDelete)) {
        projects[projectIndex] = project
        await saveCustomProjects(projects)
      }
    }
  }

  // ドメインモードからも同じURLを削除
  await syncDeleteToDomainMode(targetUrlsSet, urls.length)
}

/**
 * URLをすべてのカスタムプロジェクトから削除する関数
 */
const removeUrlFromAllCustomProjects = async (url: string): Promise<void> => {
  try {
    await migrateToUrlsStorage()
    const projects = await getCustomProjects()
    let hasChanges = false

    const urlRecords = await getUrlRecords()
    const urlRecord = urlRecords.find(record => record.url === url)
    if (!urlRecord) {
      return
    }

    for (const project of projects) {
      if (project.urlIds?.includes(urlRecord.id)) {
        project.urlIds = project.urlIds.filter(
          (id: string) => id !== urlRecord.id,
        )
        if (project.urlMetadata?.[urlRecord.id]) {
          delete project.urlMetadata[urlRecord.id]
        }
        project.updatedAt = Date.now()
        hasChanges = true
      }
    }

    if (hasChanges) {
      await saveCustomProjects(projects)
      console.log(`URL ${url} をすべてのカスタムプロジェクトから削除しました`)
    }
  } catch (error) {
    console.error(
      'カスタムプロジェクトからのURL削除中にエラーが発生しました:',
      error,
    )
  }
}

/**
 * 複数のプロジェクトから指定のIDを一括で削除する内部処理
 */
const processProjectsForBulkDelete = (
  projects: CustomProject[],
  idsToDelete: Set<string>,
): boolean => {
  let hasChanges = false
  for (const project of projects) {
    if (updateProjectUrlIdsAndMetadata(project, idsToDelete)) {
      hasChanges = true
    }
  }
  return hasChanges
}

/**
 * 全てのプロジェクトから複数の URL をまとめて削除する。
 */
const removeUrlsFromAllCustomProjects = async (
  urls: string[],
): Promise<void> => {
  if (urls.length === 0) {
    return
  }

  try {
    await migrateToUrlsStorage()
    const projects = await getCustomProjects()
    const targetUrlsSet = new Set(urls)

    const urlRecords = await getUrlRecords()
    const recordsToDelete = urlRecords.filter(record =>
      targetUrlsSet.has(record.url),
    )

    if (recordsToDelete.length === 0) {
      return
    }

    const idsToDelete = new Set(recordsToDelete.map(r => r.id))
    const hasChanges = processProjectsForBulkDelete(projects, idsToDelete)

    if (hasChanges) {
      await saveCustomProjects(projects)
      console.log(
        `${urls.length}件のURLをすべてのカスタムプロジェクトから削除しました`,
      )
    }
  } catch (error) {
    console.error(
      'カスタムプロジェクトからの複数URL削除中にエラーが発生しました:',
      error,
    )
  }
} // カスタムプロジェクトを削除する関数

/**
 * 全てのプロジェクトから複数の URL ID をまとめて削除する。
 */
const removeUrlIdsFromAllCustomProjects = async (
  urlIds: string[],
): Promise<void> => {
  if (urlIds.length === 0) {
    return
  }

  try {
    await migrateToUrlsStorage()
    const projects = await getCustomProjects()
    const idsToDelete = new Set(urlIds)
    const hasChanges = processProjectsForBulkDelete(projects, idsToDelete)

    if (hasChanges) {
      await saveCustomProjects(projects)
      console.log(
        `${urlIds.length}件のURL IDをすべてのカスタムプロジェクトから削除しました`,
      )
    }
  } catch (error) {
    console.error(
      'カスタムプロジェクトからの複数URL ID削除中にエラーが発生しました:',
      error,
    )
  }
} // カスタムプロジェクトを削除する関数

const ensureProjectMetadataEntry = (
  project: CustomProject,
  urlId: string,
): void => {
  if (!project.urlMetadata) {
    project.urlMetadata = {}
  }
  if (!project.urlMetadata[urlId]) {
    project.urlMetadata[urlId] = {}
  }
}

const mergeUrlsIntoUncategorized = (
  projectToDelete: CustomProject,
  uncategorizedProject: CustomProject,
): void => {
  if (!(projectToDelete.urlIds && projectToDelete.urlIds.length > 0)) {
    return
  }
  if (!uncategorizedProject.urlIds) {
    uncategorizedProject.urlIds = []
  }
  const targetUrlSet = new Set(uncategorizedProject.urlIds)
  for (const urlId of projectToDelete.urlIds) {
    if (targetUrlSet.has(urlId)) {
      continue
    }
    targetUrlSet.add(urlId)
    uncategorizedProject.urlIds.push(urlId)
    const metadata = projectToDelete.urlMetadata?.[urlId]
    if (!metadata?.notes) {
      continue
    }
    ensureProjectMetadataEntry(uncategorizedProject, urlId)
    const urlMetadata = uncategorizedProject.urlMetadata
    if (!urlMetadata) {
      continue
    }
    urlMetadata[urlId].notes = metadata.notes
  }
  uncategorizedProject.updatedAt = Date.now()
}

const findOrCreateUncategorizedProject = async (
  projects: CustomProject[],
): Promise<CustomProject> => {
  const existing = projects.find(
    project => project.id === CUSTOM_UNCATEGORIZED_PROJECT_ID,
  )
  if (existing) {
    return existing
  }
  const created = buildUncategorizedProject()
  projects.push(created)
  await appendUncategorizedProjectToOrder()
  return created
}

const removeProjectIdFromOrder = async (projectId: string): Promise<void> => {
  const { customProjectOrder = [] } =
    await chrome.storage.local.get('customProjectOrder')
  if (!Array.isArray(customProjectOrder)) {
    return
  }
  await chrome.storage.local.set({
    customProjectOrder: customProjectOrder.filter(id => id !== projectId),
  })
}

const deleteCustomProject = async (projectId: string): Promise<void> => {
  if (projectId === CUSTOM_UNCATEGORIZED_PROJECT_ID) {
    throw new Error('Uncategorized project cannot be deleted')
  }
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }

  const projectToDelete = projects[projectIndex]
  const remainingProjects = projects.filter(project => project.id !== projectId)

  const uncategorizedProject =
    await findOrCreateUncategorizedProject(remainingProjects)
  mergeUrlsIntoUncategorized(projectToDelete, uncategorizedProject)
  await saveCustomProjects(remainingProjects)
  await removeProjectIdFromOrder(projectId)
} // カスタムプロジェクト名を更新する関数
const updateCustomProjectName = async (
  projectId: string,
  newName: string,
): Promise<void> => {
  const projects = await getCustomProjects()

  // 同名プロジェクトの重複チェック（自分自身は除く）
  if (
    projects.some(
      p => p.name.toLowerCase() === newName.toLowerCase() && p.id !== projectId,
    )
  ) {
    throw new Error(`DUPLICATE_PROJECT_NAME:${newName}`)
  }
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }
  projects[projectIndex] = {
    ...projects[projectIndex],
    name: newName,
    updatedAt: Date.now(),
  }
  await saveCustomProjects(projects)
} // プロジェクトにカテゴリを追加する関数
const addCategoryToProject = async (
  projectId: string,
  categoryName: string,
): Promise<void> => {
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }
  const project = projects[projectIndex]

  // カテゴリが既に存在するかチェック
  if (project.categories.includes(categoryName)) {
    return // 既に存在する場合は何もしない
  }

  // カテゴリを追加
  project.categories = [...project.categories, categoryName]
  project.updatedAt = Date.now()

  // カテゴリ順序が存在しなければ初期化
  if (project.categoryOrder) {
    // 新しいカテゴリを順序にも追加
    project.categoryOrder = [...project.categoryOrder, categoryName]
  } else {
    project.categoryOrder = project.categories
  }
  projects[projectIndex] = project
  await saveCustomProjects(projects)
} // プロジェクトからカテゴリを削除する関数
const removeCategoryFromProject = async (
  projectId: string,
  categoryName: string,
): Promise<void> => {
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }
  const project = projects[projectIndex]

  // カテゴリを削除
  project.categories = project.categories.filter(cat => cat !== categoryName)

  // カテゴリ順序も更新
  if (project.categoryOrder) {
    project.categoryOrder = project.categoryOrder.filter(
      cat => cat !== categoryName,
    )
  }

  // このカテゴリに所属するURLのカテゴリをnullに設定（新形式対応）
  if (project.urlMetadata) {
    for (const [urlId, meta] of Object.entries(project.urlMetadata)) {
      if (meta?.category === categoryName) {
        project.urlMetadata[urlId].category = undefined
      }
    }
  }
  project.updatedAt = Date.now()
  projects[projectIndex] = project
  await saveCustomProjects(projects)
} // URLにカテゴリを設定する関数（新形式対応）
const setUrlCategory = async (
  projectId: string,
  url: string,
  category?: string,
): Promise<void> => {
  // マイグレーションを実行（未実行の場合）
  await migrateToUrlsStorage()
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }
  const project = projects[projectIndex]

  // 新形式のみサポート: URLIDsからURLレコードを探してカテゴリを設定
  if (project.urlIds && project.urlIds.length > 0) {
    const urlRecords = await getUrlRecordsByIds(project.urlIds)
    const urlRecord = urlRecords.find(record => record.url === url)
    if (urlRecord) {
      if (!project.urlMetadata) {
        project.urlMetadata = {}
      }
      if (!project.urlMetadata[urlRecord.id]) {
        project.urlMetadata[urlRecord.id] = {}
      }
      project.urlMetadata[urlRecord.id].category = category
    }
  }
  project.updatedAt = Date.now()
  projects[projectIndex] = project
  await saveCustomProjects(projects)
} // カテゴリ順序を更新する関数
const updateCategoryOrder = async (
  projectId: string,
  newOrder: string[],
): Promise<void> => {
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }
  const project = projects[projectIndex]
  project.categoryOrder = newOrder
  project.updatedAt = Date.now()
  projects[projectIndex] = project
  await saveCustomProjects(projects)
} // プロジェクト内のURLを並び替える関数
const reorderProjectUrls = async (
  projectId: string,
  urls: CustomProject['urls'],
): Promise<void> => {
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }
  const project = projects[projectIndex]

  if (project.urlIds && project.urlIds.length > 0 && urls) {
    const urlRecords = await getUrlRecordsByIds(project.urlIds)
    const urlToIds = new Map<string, string[]>()
    for (const record of urlRecords) {
      const ids = urlToIds.get(record.url)
      if (ids) {
        ids.push(record.id)
      } else {
        urlToIds.set(record.url, [record.id])
      }
    }

    const orderedIds: string[] = []
    for (const item of urls) {
      const idQueue = urlToIds.get(item.url)
      const nextId = idQueue?.shift()
      if (nextId) {
        orderedIds.push(nextId)
      }
    }

    if (orderedIds.length > 0) {
      const orderedSet = new Set(orderedIds)
      const remainingIds = project.urlIds.filter(id => !orderedSet.has(id))
      project.urlIds = [...orderedIds, ...remainingIds]
    }
  }

  project.urls = urls
  project.updatedAt = Date.now()
  projects[projectIndex] = project
  await saveCustomProjects(projects)
} // プロジェクト順序を保存する関数
const moveUrlBetweenCustomProjects = async (
  sourceProjectId: string,
  targetProjectId: string,
  url: string,
): Promise<void> => {
  if (sourceProjectId === targetProjectId) {
    return
  }

  await migrateToUrlsStorage()
  const projects = await getCustomProjects()
  const sourceIndex = projects.findIndex(
    project => project.id === sourceProjectId,
  )
  const targetIndex = projects.findIndex(
    project => project.id === targetProjectId,
  )
  if (sourceIndex === -1 || targetIndex === -1) {
    throw new Error('Source or target project not found')
  }

  const sourceProject = projects[sourceIndex]
  const targetProject = projects[targetIndex]
  if (!(sourceProject.urlIds && sourceProject.urlIds.length > 0)) {
    throw new Error('URL not found in source project')
  }

  const sourceRecords = await getUrlRecordsByIds(sourceProject.urlIds)
  const urlRecord = sourceRecords.find(record => record.url === url)
  if (!urlRecord) {
    throw new Error('URL not found in source project')
  }

  const urlId = urlRecord.id
  if (!targetProject.urlIds) {
    targetProject.urlIds = []
  }
  if (targetProject.urlIds.includes(urlId)) {
    throw new Error('URL already exists in target project')
  }

  sourceProject.urlIds = sourceProject.urlIds.filter(id => id !== urlId)
  targetProject.urlIds.push(urlId)

  const sourceMetadata = sourceProject.urlMetadata?.[urlId]
  if (sourceProject.urlMetadata?.[urlId]) {
    delete sourceProject.urlMetadata[urlId]
  }
  if (sourceMetadata?.notes) {
    if (!targetProject.urlMetadata) {
      targetProject.urlMetadata = {}
    }
    targetProject.urlMetadata[urlId] = {
      notes: sourceMetadata.notes,
    }
  }

  sourceProject.updatedAt = Date.now()
  targetProject.updatedAt = Date.now()
  projects[sourceIndex] = sourceProject
  projects[targetIndex] = targetProject
  await saveCustomProjects(projects)
}

const updateProjectOrder = async (projectIds: string[]): Promise<void> => {
  try {
    // プロジェクト順序の保存
    await chrome.storage.local.set({
      customProjectOrder: projectIds,
    })
    console.log('プロジェクト順序を保存しました:', projectIds)
  } catch (error) {
    console.error('プロジェクト順序の保存に失敗しました:', error)
    throw error
  }
} // カテゴリ名を変更する関数
const renameCategoryInProject = async (
  projectId: string,
  oldCategoryName: string,
  newCategoryName: string,
): Promise<void> => {
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }
  const project = projects[projectIndex]
  if (project.categories.includes(newCategoryName)) {
    throw new Error(
      `Category name ${newCategoryName} already exists in project ${projectId}`,
    )
  }
  project.categories = project.categories.map(cat =>
    cat === oldCategoryName ? newCategoryName : cat,
  )
  if (project.categoryOrder) {
    project.categoryOrder = project.categoryOrder.map(cat =>
      cat === oldCategoryName ? newCategoryName : cat,
    )
  }
  // URLメタデータのカテゴリ名を更新（新形式対応）
  if (project.urlMetadata) {
    for (const [urlId, meta] of Object.entries(project.urlMetadata)) {
      if (meta?.category === oldCategoryName) {
        project.urlMetadata[urlId].category = newCategoryName
      }
    }
  }
  project.updatedAt = Date.now()
  projects[projectIndex] = project
  await saveCustomProjects(projects)
}

const updateProjectKeywords = async (
  projectId: string,
  projectKeywords: ProjectKeywordSettings,
): Promise<void> => {
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }

  const project = projects[projectIndex]
  project.projectKeywords = normalizeProjectKeywords(projectKeywords)
  project.updatedAt = Date.now()
  projects[projectIndex] = project
  await saveCustomProjects(projects)
}

export {
  CUSTOM_UNCATEGORIZED_PROJECT_ID,
  CUSTOM_UNCATEGORIZED_PROJECT_NAME,
  addCategoryToProject,
  addUrlToCustomProject,
  addUrlsToUncategorizedProject,
  createCustomProject,
  deleteCustomProject,
  getCustomProjects,
  getOrCreateUncategorizedProject,
  getProjectUrls,
  moveUrlBetweenCustomProjects,
  removeCategoryFromProject,
  removeUrlFromAllCustomProjects,
  removeUrlFromCustomProject,
  removeUrlIdsFromAllCustomProjects,
  removeUrlsFromAllCustomProjects,
  removeUrlsFromCustomProject,
  renameCategoryInProject,
  reorderProjectUrls,
  saveCustomProjects,
  saveUrlsToCustomProjects,
  setUrlCategory,
  updateCategoryOrder,
  updateCustomProjectName,
  updateProjectKeywords,
  updateProjectOrder,
}
