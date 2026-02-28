/**
 * @file useProjectManagement.ts
 * @description カスタムプロジェクトの CRUD・ビューモード切替・URL管理・
 * プロジェクト内カテゴリ管理を担うカスタムフック。
 */

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import {
  addCategoryToProject,
  addUrlToCustomProject,
  createCustomProject,
  deleteCustomProject,
  getCustomProjects,
  getViewMode,
  removeCategoryFromProject,
  removeUrlFromCustomProject,
  renameCategoryInProject,
  reorderProjectUrls,
  saveViewMode,
  setUrlCategory,
  updateCategoryOrder,
  updateCustomProjectName,
  updateProjectOrder,
} from '@/lib/storage/projects'
import type {
  CustomProject,
  TabGroup,
  UserSettings,
  ViewMode,
} from '@/types/storage'

/** useProjectManagement フックの戻り値型 */
interface UseProjectManagementReturn {
  /** カスタムプロジェクト一覧 */
  customProjects: CustomProject[]
  /** customProjects を直接更新するセッター */
  setCustomProjects: Dispatch<SetStateAction<CustomProject[]>>
  /** 現在のビューモード */
  viewMode: ViewMode
  /** viewMode を直接更新するセッター */
  setViewMode: Dispatch<SetStateAction<ViewMode>>
  /** customProjects の最新値を保持する ref（非同期処理用） */
  customProjectsRef: React.RefObject<CustomProject[]>
  /** viewMode の最新値を保持する ref（非同期処理用） */
  viewModeRef: React.RefObject<ViewMode>
  /** ドメインモードのデータをカスタムプロジェクトに同期する */
  syncDomainDataToCustomProjects: () => Promise<CustomProject[]>
  /**
   * ビューモードを変更し、カスタムモードに切り替えた場合はデータ同期を行う。
   * @param mode - 変更先のビューモード
   */
  handleViewModeChange: (mode: ViewMode) => Promise<void>
  /**
   * 新しいカスタムプロジェクトを作成する。
   * @param name - プロジェクト名
   * @param description - 説明（省略可）
   */
  handleCreateProject: (name: string, description?: string) => Promise<void>
  /**
   * カスタムプロジェクトを削除する。
   * @param projectId - 削除するプロジェクトの ID
   */
  handleDeleteProject: (projectId: string) => Promise<void>
  /**
   * カスタムプロジェクト名を変更する。
   * @param projectId - 対象プロジェクトの ID
   * @param newName - 新しいプロジェクト名
   */
  handleRenameProject: (projectId: string, newName: string) => Promise<void>
  /**
   * プロジェクトに URL を追加する。
   * @param projectId - 対象プロジェクトの ID
   * @param url - 追加する URL
   * @param title - URL のタイトル
   */
  handleAddUrlToProject: (
    projectId: string,
    url: string,
    title: string,
  ) => Promise<void>
  /**
   * プロジェクトから URL を削除する。
   * @param projectId - 対象プロジェクトの ID
   * @param url - 削除する URL
   */
  handleDeleteUrlFromProject: (projectId: string, url: string) => Promise<void>
  /**
   * プロジェクトにカテゴリを追加する。
   * @param projectId - 対象プロジェクトの ID
   * @param categoryName - 追加するカテゴリ名
   */
  handleAddCategory: (projectId: string, categoryName: string) => Promise<void>
  /**
   * プロジェクトからカテゴリを削除する。
   * @param projectId - 対象プロジェクトの ID
   * @param categoryName - 削除するカテゴリ名
   */
  handleDeleteProjectCategory: (
    projectId: string,
    categoryName: string,
  ) => Promise<void>
  /**
   * プロジェクト内の URL にカテゴリを設定する。
   * @param projectId - 対象プロジェクトの ID
   * @param url - 対象 URL
   * @param category - 設定するカテゴリ名（省略すると未分類）
   */
  handleSetUrlCategory: (
    projectId: string,
    url: string,
    category?: string,
  ) => Promise<void>
  /**
   * プロジェクト内のカテゴリ順序を更新する。
   * @param projectId - 対象プロジェクトの ID
   * @param newOrder - 新しいカテゴリ順序の配列
   */
  handleUpdateCategoryOrder: (
    projectId: string,
    newOrder: string[],
  ) => Promise<void>
  /**
   * プロジェクト内の URL 順序を更新する。
   * @param projectId - 対象プロジェクトの ID
   * @param urls - 新しい URL 順序の配列
   */
  handleReorderUrls: (
    projectId: string,
    urls: CustomProject['urls'],
  ) => Promise<void>
  /**
   * プロジェクト自体の表示順序を更新する。
   * @param newOrder - 新しいプロジェクト ID 順序の配列
   */
  handleReorderProjects: (newOrder: string[]) => Promise<void>
  /**
   * プロジェクト内のカテゴリ名を変更する。
   * @param projectId - 対象プロジェクトの ID
   * @param oldCategoryName - 変更前のカテゴリ名
   * @param newCategoryName - 変更後のカテゴリ名
   */
  handleRenameCategory: (
    projectId: string,
    oldCategoryName: string,
    newCategoryName: string,
  ) => Promise<void>
}
/**
 * カスタムプロジェクト管理フック。
 * ビューモード切替・CRUD・URL管理・プロジェクト内カテゴリ管理を担う。
 *
 * @param tabGroups - 現在のタブグループ一覧（ドメインモードのデータ）
 * @param _settings - ユーザー設定（将来の拡張用）
 * @returns UseProjectManagementReturn
 */
const useProjectManagement = (
  _tabGroups: TabGroup[],
  _settings: UserSettings,
): UseProjectManagementReturn => {
  const [customProjects, setCustomProjects] = useState<CustomProject[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('domain')
  const customProjectsRef = useRef<CustomProject[]>([])
  const viewModeRef = useRef<ViewMode>('domain')
  const creatingProjectNamesRef = useRef<Set<string>>(new Set())

  // ref を最新の state に同期する
  useEffect(() => {
    customProjectsRef.current = customProjects
  }, [customProjects])
  useEffect(() => {
    viewModeRef.current = viewMode
  }, [viewMode])

  /** カスタムプロジェクトを最新化して state に反映する */
  const syncDomainDataToCustomProjects = useCallback(async (): Promise<
    CustomProject[]
  > => {
    try {
      const projects = await getCustomProjects()
      setCustomProjects(projects)
      return projects
    } catch (error) {
      console.error('データ同期エラー:', error)
      try {
        const latestProjects = await getCustomProjects()
        setCustomProjects(latestProjects)
        return latestProjects
      } catch (e) {
        console.error('プロジェクト再取得エラー:', e)
        return []
      }
    }
  }, [])

  /** ビューモードを変更し、カスタムモードに切り替えた場合はデータ同期を行う */
  const handleViewModeChange = useCallback(
    async (mode: ViewMode): Promise<void> => {
      try {
        console.log(`ビューモードを ${mode} に変更します`)
        setViewMode(mode)
        await saveViewMode(mode)
        if (mode !== 'custom') {
          return
        }
        console.log('カスタムモードに切り替え: データ同期を開始')
        await syncDomainDataToCustomProjects()
      } catch (error) {
        console.error('ビューモード変更エラー:', error)
        toast.error('モードの切り替えに失敗しました')
      }
    },
    [syncDomainDataToCustomProjects],
  )

  /** 新しいカスタムプロジェクトを作成する */
  const handleCreateProject = useCallback(
    async (name: string, description?: string): Promise<void> => {
      const normalizedName = name.trim()
      const projectKey = normalizedName.toLowerCase()
      if (!normalizedName) {
        return
      }
      if (creatingProjectNamesRef.current.has(projectKey)) {
        return
      }

      creatingProjectNamesRef.current.add(projectKey)
      try {
        const newProject = await createCustomProject(
          normalizedName,
          description,
        )
        setCustomProjects(prev => {
          const withoutCreated = prev.filter(
            project => project.id !== newProject.id,
          )
          return [newProject, ...withoutCreated]
        })
        toast.success(`プロジェクト「${normalizedName}」を作成しました`)
      } catch (error) {
        console.error('プロジェクト作成エラー:', error)
        if (
          error instanceof Error &&
          error.message.startsWith('DUPLICATE_PROJECT_NAME:')
        ) {
          toast.error(
            `プロジェクト名「${normalizedName}」は既に使用されています`,
          )
        } else {
          toast.error('プロジェクトの作成に失敗しました')
        }
      } finally {
        creatingProjectNamesRef.current.delete(projectKey)
      }
    },
    [],
  )

  /** カスタムプロジェクトを削除する */
  const handleDeleteProject = useCallback(
    async (projectId: string): Promise<void> => {
      try {
        const project = customProjectsRef.current.find(p => p.id === projectId)
        if (!project) {
          return
        }
        await deleteCustomProject(projectId)
        setCustomProjects(prev => prev.filter(p => p.id !== projectId))
        toast.success(`プロジェクト「${project.name}」を削除しました`)
      } catch (error) {
        console.error('プロジェクト削除エラー:', error)
        toast.error('プロジェクトの削除に失敗しました')
      }
    },
    [],
  )

  /** カスタムプロジェクト名を変更する */
  const handleRenameProject = useCallback(
    async (projectId: string, newName: string): Promise<void> => {
      try {
        await updateCustomProjectName(projectId, newName)
        setCustomProjects(prev =>
          prev.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  name: newName,
                  updatedAt: Date.now(),
                }
              : p,
          ),
        )
        toast.success('プロジェクト名を変更しました')
      } catch (error) {
        console.error('プロジェクト名変更エラー:', error)
        if (
          error instanceof Error &&
          error.message.startsWith('DUPLICATE_PROJECT_NAME:')
        ) {
          toast.error(`プロジェクト名「${newName}」は既に使用されています`)
        } else {
          toast.error('プロジェクト名の変更に失敗しました')
        }
      }
    },
    [],
  )

  /** プロジェクトに URL を追加する */
  const handleAddUrlToProject = useCallback(
    async (projectId: string, url: string, title: string): Promise<void> => {
      try {
        await addUrlToCustomProject(projectId, url, title)
        const updatedProjects = await getCustomProjects()
        setCustomProjects(updatedProjects)
        toast.success('URLを追加しました')
      } catch (error) {
        console.error('URL追加エラー:', error)
        toast.error('URLの追加に失敗しました')
      }
    },
    [],
  )

  /** プロジェクトから URL を削除する */
  const handleDeleteUrlFromProject = useCallback(
    async (projectId: string, url: string): Promise<void> => {
      try {
        await removeUrlFromCustomProject(projectId, url)
        const updatedProjects = await getCustomProjects()
        setCustomProjects(updatedProjects)
        toast.success('URLを削除しました')
      } catch (error) {
        console.error('URL削除エラー:', error)
        toast.error('URLの削除に失敗しました')
      }
    },
    [],
  )

  /** プロジェクトにカテゴリを追加する */
  const handleAddCategory = useCallback(
    async (projectId: string, categoryName: string): Promise<void> => {
      try {
        await addCategoryToProject(projectId, categoryName)
        setCustomProjects(prev =>
          prev.map(p => {
            if (p.id !== projectId) {
              return p
            }
            if (p.categories.includes(categoryName)) {
              return p
            }

            const updatedCategories = [...p.categories, categoryName]
            const baseCategoryOrder = p.categoryOrder ?? p.categories
            return {
              ...p,
              categories: updatedCategories,
              categoryOrder: baseCategoryOrder.includes(categoryName)
                ? baseCategoryOrder
                : [...baseCategoryOrder, categoryName],
              updatedAt: Date.now(),
            }
          }),
        )
        toast.success(`カテゴリ「${categoryName}」を追加しました`)
      } catch (error) {
        console.error('カテゴリ追加エラー:', error)
        toast.error('カテゴリの追加に失敗しました')
      }
    },
    [],
  )

  /** プロジェクトからカテゴリを削除する */
  const handleDeleteProjectCategory = useCallback(
    async (projectId: string, categoryName: string): Promise<void> => {
      try {
        await removeCategoryFromProject(projectId, categoryName)
        const updatedProjects = await getCustomProjects()
        setCustomProjects(updatedProjects)
        toast.success(`カテゴリ「${categoryName}」を削除しました`)
      } catch (error) {
        console.error('カテゴリ削除エラー:', error)
        toast.error('カテゴリの削除に失敗しました')
      }
    },
    [],
  )

  /** プロジェクト内の URL にカテゴリを設定する */
  const handleSetUrlCategory = useCallback(
    async (
      projectId: string,
      url: string,
      category?: string,
    ): Promise<void> => {
      try {
        await setUrlCategory(projectId, url, category)
        const updatedProjects = await getCustomProjects()
        setCustomProjects(updatedProjects)
      } catch (error) {
        console.error('URL分類エラー:', error)
        toast.error('URLの分類更新に失敗しました')
      }
    },
    [],
  )

  /** プロジェクト内のカテゴリ順序を更新する */
  const handleUpdateCategoryOrder = useCallback(
    async (projectId: string, newOrder: string[]): Promise<void> => {
      try {
        console.log(`カテゴリ順序を更新: ${projectId}`, newOrder)
        await updateCategoryOrder(projectId, newOrder)
        setCustomProjects(prev =>
          prev.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  categoryOrder: newOrder,
                  updatedAt: Date.now(),
                }
              : p,
          ),
        )
      } catch (error) {
        console.error('カテゴリ順序更新エラー:', error)
        toast.error('カテゴリの順序更新に失敗しました')
      }
    },
    [],
  )

  /** プロジェクト内の URL 順序を更新する */
  const handleReorderUrls = useCallback(
    async (projectId: string, urls: CustomProject['urls']): Promise<void> => {
      try {
        await reorderProjectUrls(projectId, urls)
        setCustomProjects(prev =>
          prev.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  urls,
                  updatedAt: Date.now(),
                }
              : p,
          ),
        )
      } catch (error) {
        console.error('URL順序更新エラー:', error)
        toast.error('URLの順序更新に失敗しました')
      }
    },
    [],
  )

  /** プロジェクト自体の表示順序を更新する */
  const handleReorderProjects = useCallback(
    async (newOrder: string[]): Promise<void> => {
      try {
        console.log('プロジェクト順序を更新:', newOrder)
        await updateProjectOrder(newOrder)
        setCustomProjects(prev =>
          [...prev].sort((a, b) => {
            const indexA = newOrder.indexOf(a.id)
            const indexB = newOrder.indexOf(b.id)
            if (indexA === -1) {
              return 1
            }
            if (indexB === -1) {
              return -1
            }
            return indexA - indexB
          }),
        )
        toast.success('プロジェクトの順序を変更しました')
      } catch (error) {
        console.error('プロジェクト順序更新エラー:', error)
        toast.error('プロジェクト順序の更新に失敗しました')
      }
    },
    [],
  )

  /** プロジェクト内のカテゴリ名を変更する */
  const handleRenameCategory = useCallback(
    async (
      projectId: string,
      oldCategoryName: string,
      newCategoryName: string,
    ): Promise<void> => {
      try {
        await renameCategoryInProject(
          projectId,
          oldCategoryName,
          newCategoryName,
        )
        setCustomProjects(prev =>
          prev.map(project =>
            project.id === projectId
              ? {
                  ...project,
                  categories: project.categories.map(cat =>
                    cat === oldCategoryName ? newCategoryName : cat,
                  ),
                  categoryOrder: project.categoryOrder
                    ? project.categoryOrder.map(cat =>
                        cat === oldCategoryName ? newCategoryName : cat,
                      )
                    : project.categoryOrder,
                  urls: project.urls?.map(item => ({
                    ...item,
                    category:
                      item.category === oldCategoryName
                        ? newCategoryName
                        : item.category,
                  })),
                }
              : project,
          ),
        )
        toast.success('カテゴリ名を変更しました')
      } catch (error) {
        console.error('カテゴリ名の変更エラー:', error)
        toast.error('カテゴリ名の変更に失敗しました')
      }
    },
    [],
  )

  // ビューモードと既存のカスタムプロジェクトをロード（初回のみ）
  useEffect(() => {
    const loadViewMode = async () => {
      try {
        console.log(
          '初回ロード: ビューモードとカスタムプロジェクトを取得します',
        )
        // 最初にビューモードを取得
        const mode = await getViewMode()
        setViewMode(mode)
        console.log(`ビューモード: ${mode}`)

        // カスタムプロジェクトを読み込む
        const projects = await getCustomProjects()
        console.log(`カスタムプロジェクト数: ${projects.length}`)

        // UIを更新
        setCustomProjects(projects)
        console.log('初回ロード完了')
      } catch (error) {
        console.error('ビューモードの読み込みエラー:', error)
      }
    }
    loadViewMode()
  }, [syncDomainDataToCustomProjects])
  return {
    customProjects,
    setCustomProjects,
    viewMode,
    setViewMode,
    customProjectsRef,
    viewModeRef,
    syncDomainDataToCustomProjects,
    handleViewModeChange,
    handleCreateProject,
    handleDeleteProject,
    handleRenameProject,
    handleAddUrlToProject,
    handleDeleteUrlFromProject,
    handleAddCategory,
    handleDeleteProjectCategory,
    handleSetUrlCategory,
    handleUpdateCategoryOrder,
    handleReorderUrls,
    handleReorderProjects,
    handleRenameCategory,
  }
}
export { useProjectManagement }
export type { UseProjectManagementReturn }
