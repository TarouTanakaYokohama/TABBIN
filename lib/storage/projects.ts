import type {
  CustomProject,
  TabGroup,
  UrlRecord,
  ViewMode,
} from '@/types/storage'
import { v4 as uuidv4 } from 'uuid'
import { migrateToUrlsStorage } from './migration'
import { createOrUpdateUrlRecord, getUrlRecordsByIds } from './urls'

/**
 * CustomProjectからURLデータを取得する（新旧形式対応）
 */
export async function getProjectUrls(
  project: CustomProject,
): Promise<Array<UrlRecord & { notes?: string; category?: string }>> {
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
}

// カスタムプロジェクト一覧を取得する関数
export async function getCustomProjects(): Promise<CustomProject[]> {
  try {
    // マイグレーションを実行（未実行の場合）
    await migrateToUrlsStorage()

    // プロジェクトとプロジェクト順序を同時に取得
    const data = await chrome.storage.local.get([
      'customProjects',
      'customProjectOrder',
    ])
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
        if (!project.urlIds || !Array.isArray(project.urlIds)) {
          project.urlIds = []
        }

        // 必須フィールドの確認と修正
        if (!project.categories || !Array.isArray(project.categories)) {
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
      await chrome.storage.local.set({ customProjects: validProjects })
    }

    // 順序が保存されている場合、その順序でソート
    if (projectOrder.length > 0) {
      return [...validProjects].sort((a, b) => {
        const indexA = projectOrder.indexOf(a.id)
        const indexB = projectOrder.indexOf(b.id)
        // 順序にないプロジェクトは最後に
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
    }

    return validProjects
  } catch (error) {
    console.error('カスタムプロジェクト取得エラー:', error)
    return []
  }
}

// カスタムプロジェクト一覧を保存する関数
export async function saveCustomProjects(
  projects: CustomProject[],
): Promise<void> {
  try {
    await chrome.storage.local.set({ customProjects: projects })
    console.log(`${projects.length}個のカスタムプロジェクトを保存しました`)
  } catch (error) {
    console.error('カスタムプロジェクト保存エラー:', error)
    throw error
  }
}

// 現在のビューモードを取得する関数
export async function getViewMode(): Promise<ViewMode> {
  try {
    const { viewMode = 'domain' } = await chrome.storage.local.get('viewMode')
    return viewMode as ViewMode
  } catch (error) {
    console.error('ビューモード取得エラー:', error)
    return 'domain' // エラー時はデフォルト値を返す
  }
}

// ビューモードを保存する関数
export async function saveViewMode(mode: ViewMode): Promise<void> {
  await chrome.storage.local.set({ viewMode: mode })
}

// 新しいカスタムプロジェクトを作成する関数
export async function createCustomProject(
  name: string,
  description?: string,
): Promise<CustomProject> {
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
    description,
    urlIds: [], // 新形式のURL IDリスト
    categories: [], // 空のカテゴリリストで初期化
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  await saveCustomProjects([...projects, newProject])
  return newProject
}

// URLをカスタムプロジェクトに追加する関数（新形式対応）
export async function addUrlToCustomProject(
  projectId: string,
  url: string,
  title: string,
  notes?: string,
  category?: string,
): Promise<void> {
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

    // URLIDsが存在しない場合は初期化
    if (!project.urlIds) {
      project.urlIds = []
    }

    let isNewUrl = false

    // URLが既にプロジェクトに存在するかチェック
    if (!project.urlIds.includes(urlRecord.id)) {
      isNewUrl = true
      project.urlIds.push(urlRecord.id)
    }

    // メタデータを設定
    if (notes || category) {
      if (!project.urlMetadata) {
        project.urlMetadata = {}
      }
      project.urlMetadata[urlRecord.id] = {
        notes,
        category,
      }
    }

    if (isNewUrl) {
      // URLがドメインモードにまだなければ追加
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

      // URLからドメインを抽出
      const urlObj = new URL(url)
      const domain = `${urlObj.protocol}//${urlObj.hostname}`

      // そのドメイングループが存在するか確認
      let domainGroup = savedTabs.find(
        (group: TabGroup) => group.domain === domain,
      )

      if (!domainGroup) {
        // ドメイングループが存在しなければ作成（新形式のみ）
        domainGroup = {
          id: uuidv4(),
          domain,
          urlIds: [urlRecord.id],
          savedAt: Date.now(),
        }
        savedTabs.push(domainGroup)
      } else {
        // 既存のドメイングループに追加（新形式のみ）
        if (!domainGroup.urlIds) {
          domainGroup.urlIds = []
        }
        if (!domainGroup.urlIds.includes(urlRecord.id)) {
          domainGroup.urlIds.push(urlRecord.id)
        }
      }

      // 保存
      await chrome.storage.local.set({ savedTabs })
      console.log(`URL ${url} をドメインモードのデータにも追加しました`)
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
}

// URLをカスタムプロジェクトから削除する関数（新形式対応）
export async function removeUrlFromCustomProject(
  projectId: string,
  url: string,
): Promise<void> {
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
    const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

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

      await chrome.storage.local.set({ savedTabs: updatedGroups })
      console.log(`URL ${url} はドメインモードからも削除されました`)
    }
  } catch (syncError) {
    console.error('ドメインモードの同期中にエラーが発生しました:', syncError)
    // エラーをスローしないで続行 - カスタムプロジェクトの削除は成功している
  }
}

// カスタムプロジェクトを削除する関数
export async function deleteCustomProject(projectId: string): Promise<void> {
  const projects = await getCustomProjects()
  const updatedProjects = projects.filter(p => p.id !== projectId)

  if (projects.length === updatedProjects.length) {
    throw new Error(`Project with ID ${projectId} not found`)
  }

  await saveCustomProjects(updatedProjects)
}

// カスタムプロジェクト名を更新する関数
export async function updateCustomProjectName(
  projectId: string,
  newName: string,
): Promise<void> {
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
}

// プロジェクトにカテゴリを追加する関数
export async function addCategoryToProject(
  projectId: string,
  categoryName: string,
): Promise<void> {
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
  if (!project.categoryOrder) {
    project.categoryOrder = project.categories
  } else {
    // 新しいカテゴリを順序にも追加
    project.categoryOrder = [...project.categoryOrder, categoryName]
  }

  projects[projectIndex] = project
  await saveCustomProjects(projects)
}

// プロジェクトからカテゴリを削除する関数
export async function removeCategoryFromProject(
  projectId: string,
  categoryName: string,
): Promise<void> {
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
    for (const urlId in project.urlMetadata) {
      if (project.urlMetadata[urlId]?.category === categoryName) {
        project.urlMetadata[urlId].category = undefined
      }
    }
  }

  project.updatedAt = Date.now()
  projects[projectIndex] = project
  await saveCustomProjects(projects)
}

// URLにカテゴリを設定する関数（新形式対応）
export async function setUrlCategory(
  projectId: string,
  url: string,
  category?: string,
): Promise<void> {
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
}

// カテゴリ順序を更新する関数
export async function updateCategoryOrder(
  projectId: string,
  newOrder: string[],
): Promise<void> {
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
}

// プロジェクト内のURLを並び替える関数
export async function reorderProjectUrls(
  projectId: string,
  urls: CustomProject['urls'],
): Promise<void> {
  const projects = await getCustomProjects()
  const projectIndex = projects.findIndex(p => p.id === projectId)

  if (projectIndex === -1) {
    throw new Error(`Project with ID ${projectId} not found`)
  }

  const project = projects[projectIndex]
  project.urls = urls
  project.updatedAt = Date.now()

  projects[projectIndex] = project
  await saveCustomProjects(projects)
}

// プロジェクト順序を保存する関数
export async function updateProjectOrder(projectIds: string[]): Promise<void> {
  try {
    // 現在のプロジェクトを取得
    const projects = await getCustomProjects()
    if (projects.length === 0) return

    // プロジェクト順序の保存
    await chrome.storage.local.set({ customProjectOrder: projectIds })
    console.log('プロジェクト順序を保存しました:', projectIds)

    // プロジェクトの更新日時も更新
    const updatedProjects = projects.map(project => ({
      ...project,
      updatedAt: Date.now(),
    }))

    await saveCustomProjects(updatedProjects)
  } catch (error) {
    console.error('プロジェクト順序の保存に失敗しました:', error)
    throw error
  }
}

// カテゴリ名を変更する関数
export async function renameCategoryInProject(
  projectId: string,
  oldCategoryName: string,
  newCategoryName: string,
): Promise<void> {
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
    for (const urlId in project.urlMetadata) {
      if (project.urlMetadata[urlId]?.category === oldCategoryName) {
        project.urlMetadata[urlId].category = newCategoryName
      }
    }
  }
  project.updatedAt = Date.now()
  projects[projectIndex] = project
  await saveCustomProjects(projects)
}
