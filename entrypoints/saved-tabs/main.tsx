import '@/assets/global.css'
import { handleTabGroupRemoval } from '@/features/saved-tabs/lib'
import {
  addSubCategoryToGroup,
  getParentCategories,
  getUserSettings,
  migrateParentCategoriesToDomainNames,
  saveParentCategories,
  updateDomainCategorySettings,
} from '@/lib/storage'
import { defaultSettings } from '@/lib/storage'
import type { ParentCategory, TabGroup, UserSettings } from '@/types/storage'
import Fuse from 'fuse.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
// lucide-reactからのアイコンインポート
import { Plus } from 'lucide-react'

import { ThemeProvider } from '@/components/theme-provider'
// UIコンポーネントのインポート
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CategoryGroup } from '@/features/saved-tabs/components/CategoryGroup'
import { CustomProjectSection } from '@/features/saved-tabs/components/CustomProjectSection'
import { Header } from '@/features/saved-tabs/components/Header' // ヘッダーコンポーネントをインポート
import { SortableDomainCard } from '@/features/saved-tabs/components/SortableDomainCard'
import {
  addUrlToCustomProject,
  createCustomProject,
  deleteCustomProject,
  getCustomProjects,
  getViewMode,
  removeUrlFromCustomProject,
  saveCustomProjects,
  saveViewMode,
  updateCustomProjectName,
  updateProjectOrder,
} from '@/lib/storage'
import type { CustomProject, ViewMode } from '@/types/storage'
import { toast } from 'sonner'

import {
  addCategoryToProject,
  removeCategoryFromProject,
  renameCategoryInProject,
  reorderProjectUrls,
  setUrlCategory,
  updateCategoryOrder,
  // ...other imports...
} from '@/lib/storage'

const SavedTabs = () => {
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [categories, setCategories] = useState<ParentCategory[]>([])
  const [newSubCategory, setNewSubCategory] = useState('')
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [categoryOrder, setCategoryOrder] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('domain')
  const [customProjects, setCustomProjects] = useState<CustomProject[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (showSubCategoryModal && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showSubCategoryModal])

  // ページ読み込み時にマイグレーションを実行
  useEffect(() => {
    const loadSavedTabs = async () => {
      try {
        console.log('ページ読み込み時の親カテゴリ移行処理を開始...')

        // まずマイグレーションを実行
        try {
          await migrateParentCategoriesToDomainNames()
        } catch (error) {
          console.error('親カテゴリ移行エラー:', error)
        }

        // データ読み込み
        const storageResult = await chrome.storage.local.get('savedTabs')
        const savedTabs: TabGroup[] = Array.isArray(storageResult.savedTabs)
          ? storageResult.savedTabs
          : []
        console.log('読み込まれたタブ:', savedTabs)
        setTabGroups(savedTabs)

        // ユーザー設定を読み込み
        const userSettings = await getUserSettings()
        setSettings(userSettings)

        // カテゴリを読み込み
        const parentCategories = await getParentCategories()
        console.log('読み込まれた親カテゴリ:', parentCategories)

        // カテゴリが空の場合、または無効なカテゴリがある場合
        const hasInvalidCategory = parentCategories.some(
          cat => !cat.domainNames || !Array.isArray(cat.domainNames),
        )

        if (hasInvalidCategory || parentCategories.length === 0) {
          console.log('無効なカテゴリを検出、再マイグレーションを実行')
          await migrateParentCategoriesToDomainNames()
          const updatedCategories = await getParentCategories()
          setCategories(updatedCategories)
        } else {
          setCategories(parentCategories)
        }

        // TabGroupのparentCategoryId修復処理
        let needsUpdate = false
        const updatedTabGroups = savedTabs.map((group: TabGroup) => {
          if (!group.parentCategoryId) {
            // parentCategoryIdが設定されていない場合、適切なカテゴリを探す
            for (const category of parentCategories) {
              // IDベースで検索
              if (category.domains?.includes(group.id)) {
                console.log(
                  `TabGroup ${group.domain} のparentCategoryIdを ${category.id} に修復しました (IDベース)`,
                )
                needsUpdate = true
                return { ...group, parentCategoryId: category.id }
              }
              // ドメイン名ベースで検索
              if (category.domainNames?.includes(group.domain)) {
                console.log(
                  `TabGroup ${group.domain} のparentCategoryIdを ${category.id} に修復しました (ドメイン名ベース)`,
                )
                needsUpdate = true
                return { ...group, parentCategoryId: category.id }
              }
            }
          }
          return group
        })

        // 修復が必要な場合はストレージを更新
        if (needsUpdate) {
          await chrome.storage.local.set({ savedTabs: updatedTabGroups })
          setTabGroups(updatedTabGroups)
          console.log('TabGroupのparentCategoryId修復処理が完了しました')
        }
      } catch (error) {
        console.error('保存されたタブの読み込みエラー:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedTabs()

    // ストレージが変更されたときに再読み込み
    chrome.storage.onChanged.addListener(changes => {
      console.log('ストレージ変更を検出:', changes)
      if (changes.savedTabs) {
        setTabGroups(changes.savedTabs.newValue || [])
      }
      if (changes.userSettings) {
        setSettings(prev => ({ ...prev, ...changes.userSettings.newValue }))
      }
      if (changes.parentCategories) {
        setCategories(changes.parentCategories.newValue || [])
      }
    })
  }, [])

  useEffect(() => {
    if (categories.length > 0) {
      setCategoryOrder(categories.map(cat => cat.id))
    }
  }, [categories])

  // ドメインモードのデータをカスタムプロジェクトと同期する関数の型定義
  type SyncDomainDataToCustomProjects = () => Promise<CustomProject[]>

  // ドメインモードのデータをカスタムプロジェクトと同期する関数
  // 重複定義を削除し、1つにまとめる
  const syncDomainDataToCustomProjects: SyncDomainDataToCustomProjects =
    useCallback(async () => {
      try {
        console.log('ドメインモードのデータをカスタムプロジェクトと同期します')

        // 最新のタブグループを取得
        const storageResult = await chrome.storage.local.get('savedTabs')
        const savedTabs: TabGroup[] = Array.isArray(storageResult.savedTabs)
          ? storageResult.savedTabs
          : []
        console.log(`同期元のドメインモードタブグループ数: ${savedTabs.length}`)

        // 最新のカスタムプロジェクトを取得
        let projects = await getCustomProjects()
        console.log(`既存のカスタムプロジェクト数: ${projects.length}`)

        // プロジェクトがなければデフォルトプロジェクトを作成
        if (projects.length === 0) {
          console.log(
            'カスタムプロジェクトが存在しないため、デフォルトプロジェクトを作成します',
          )

          // ドメインモードのURLsを収集
          const allDomainUrls: { url: string; title: string }[] = []
          for (const group of savedTabs) {
            for (const urlItem of group.urls) {
              allDomainUrls.push({
                url: urlItem.url,
                title: urlItem.title,
              })
            }
          }

          // デフォルトプロジェクトを作成
          const defaultProject = await createCustomProject(
            'デフォルトプロジェクト',
            '自動作成されたプロジェクト',
          )

          // URLを追加
          for (const urlItem of allDomainUrls) {
            await addUrlToCustomProject(
              defaultProject.id,
              urlItem.url,
              urlItem.title,
            )
          }

          // 再取得
          projects = await getCustomProjects()
          console.log(
            `デフォルトプロジェクトを作成しました: ${projects.length} プロジェクト`,
          )
        }

        // 各プロジェクトごとに処理
        const updatedProjects = projects.map(project => {
          // 安全なチェックを追加: urls配列が存在するか確認
          if (!project.urls || !Array.isArray(project.urls)) {
            console.warn(`プロジェクト ${project.id} のURLsが不正です`)
            // urls配列がなければ初期化して返す
            return {
              ...project,
              urls: [],
              updatedAt: Date.now(),
            }
          }

          // 既存のURLを把握（削除済みのURLを検出するため）
          // エラー修正: nullチェックと配列チェックを追加
          const existingUrls = new Set(project.urls.map(u => u.url))
          const updatedUrls = [...project.urls]
          let hasChanges = false

          // ドメインモードのすべてのURLをチェック
          let urlsProcessed = 0
          for (const group of savedTabs) {
            for (const tabUrl of group.urls) {
              urlsProcessed++
              // このURLがカスタムプロジェクトに存在するか
              const urlIndex = updatedUrls.findIndex(u => u.url === tabUrl.url)

              if (urlIndex >= 0) {
                // 存在する場合は、タイトルなどを最新の状態に更新
                if (
                  updatedUrls[urlIndex].title !== tabUrl.title &&
                  tabUrl.title
                ) {
                  updatedUrls[urlIndex] = {
                    ...updatedUrls[urlIndex],
                    title: tabUrl.title,
                  }
                  hasChanges = true
                }
              }

              // URLが存在していることをマーク
              existingUrls.delete(tabUrl.url)
            }
          }
          console.log(`処理したURL数: ${urlsProcessed}`)

          // ドメインモードに存在しないURLの数
          const missingUrlsCount = existingUrls.size
          console.log(`ドメインモードに存在しないURL数: ${missingUrlsCount}`)

          // 削除対象のURLがあればログに出力
          if (missingUrlsCount > 0) {
            console.log(`削除対象のURL: ${Array.from(existingUrls).join(', ')}`)
            hasChanges = true
          }

          // ドメインモードに存在しないURL（削除されたURL）をカスタムプロジェクトからも削除
          const filteredUrls = updatedUrls.filter(
            url => !existingUrls.has(url.url),
          )

          // 変更があった場合のみ更新
          if (hasChanges || filteredUrls.length !== updatedUrls.length) {
            return {
              ...project,
              urls: filteredUrls,
              updatedAt: Date.now(),
            }
          }
          return project
        })

        // 何らかの変更があれば保存
        let hasUpdates = false
        for (let i = 0; i < projects.length; i++) {
          if (
            JSON.stringify(projects[i]) !== JSON.stringify(updatedProjects[i])
          ) {
            hasUpdates = true
            break
          }
        }

        if (hasUpdates) {
          await saveCustomProjects(updatedProjects)
          setCustomProjects(updatedProjects)
          console.log(
            'カスタムプロジェクトとドメインモードのデータを同期しました',
          )
        } else {
          console.log('同期の必要はありません、データは最新です')
          // UIを更新するために状態を更新
          setCustomProjects([...updatedProjects])
        }

        return updatedProjects
      } catch (error) {
        console.error('データ同期エラー:', error)
        // エラーが発生しても最新のプロジェクトを再取得して返す
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

  // モード切替ハンドラー
  const handleViewModeChange = async (mode: ViewMode) => {
    try {
      console.log(`ビューモードを ${mode} に変更します`)
      setViewMode(mode)
      await saveViewMode(mode)

      // カスタムモードに切り替えた時は必ず最新のプロジェクトを読み込む
      if (mode === 'custom') {
        console.log('カスタムモードに切り替え: データ同期を開始')
        const projects = await syncDomainDataToCustomProjects()
        console.log(`同期完了: ${projects.length} プロジェクト`)

        // プロジェクトが空の場合、デフォルトプロジェクトを作成
        if (projects.length === 0) {
          try {
            console.log('デフォルトプロジェクトを作成します')
            const defaultProject = await createCustomProject(
              'デフォルトプロジェクト',
              '自動作成されたプロジェクト',
            )
            setCustomProjects([defaultProject])

            // ドメインモードのURLsをコピー
            const { savedTabs = [] } =
              await chrome.storage.local.get('savedTabs')
            for (const group of savedTabs) {
              for (const urlItem of group.urls) {
                await addUrlToCustomProject(
                  defaultProject.id,
                  urlItem.url,
                  urlItem.title,
                )
              }
            }
            console.log('デフォルトプロジェクトを作成し、URLをコピーしました')

            // 再取得して状態を更新
            const updatedProjects = await getCustomProjects()
            setCustomProjects(updatedProjects)
          } catch (createError) {
            console.error('デフォルトプロジェクト作成エラー:', createError)
            toast.error('プロジェクトの作成に失敗しました')
          }
        }
      }
    } catch (error) {
      console.error('ビューモード変更エラー:', error)
      toast.error('モードの切り替えに失敗しました')
    }
  }

  // ビューモードと既存のカスタムプロジェクトをロード
  useEffect(() => {
    const loadViewMode = async () => {
      try {
        const mode = await getViewMode()
        setViewMode(mode)

        // カスタムプロジェクトを読み込む
        const projects = await getCustomProjects()
        setCustomProjects(projects)

        // カスタムモードのデータとドメインモードのデータを同期
        await syncDomainDataToCustomProjects()
      } catch (error) {
        console.error('ビューモードの読み込みエラー:', error)
      }
    }

    loadViewMode()
  }, [syncDomainDataToCustomProjects])

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
        let projects = await getCustomProjects()
        console.log(`カスタムプロジェクト数: ${projects.length}`)

        // プロジェクトが空なら同期してから再取得
        if (projects.length === 0) {
          console.log('プロジェクトが空のため同期を行います')
          await syncDomainDataToCustomProjects()
          projects = await getCustomProjects()
          console.log(`同期後のカスタムプロジェクト数: ${projects.length}`)
        }

        // UIを更新
        setCustomProjects(projects)
        console.log('初回ロード完了')
      } catch (error) {
        console.error('ビューモードの読み込みエラー:', error)
      }
    }

    loadViewMode()
  }, [syncDomainDataToCustomProjects])

  // カスタムプロジェクト関連ハンドラー
  const handleCreateProject = async (name: string, description?: string) => {
    try {
      const newProject = await createCustomProject(name, description)
      setCustomProjects([...customProjects, newProject])
      toast.success(`プロジェクト「${name}」を作成しました`)
    } catch (error) {
      console.error('プロジェクト作成エラー:', error)
      if (
        error instanceof Error &&
        error.message.startsWith('DUPLICATE_PROJECT_NAME:')
      ) {
        toast.error(`プロジェクト名「${name}」は既に使用されています`)
      } else {
        toast.error('プロジェクトの作成に失敗しました')
      }
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      // 対象のプロジェクト名を取得
      const project = customProjects.find(p => p.id === projectId)
      if (!project) return

      await deleteCustomProject(projectId)
      setCustomProjects(customProjects.filter(p => p.id !== projectId))
      toast.success(`プロジェクト「${project.name}」を削除しました`)
    } catch (error) {
      console.error('プロジェクト削除エラー:', error)
      toast.error('プロジェクトの削除に失敗しました')
    }
  }

  const handleRenameProject = async (projectId: string, newName: string) => {
    try {
      await updateCustomProjectName(projectId, newName)

      const updatedProjects = customProjects.map(p =>
        p.id === projectId ? { ...p, name: newName, updatedAt: Date.now() } : p,
      )

      setCustomProjects(updatedProjects)
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
  }

  const handleAddUrlToProject = async (
    projectId: string,
    url: string,
    title: string,
  ) => {
    try {
      await addUrlToCustomProject(projectId, url, title)

      // プロジェクトリストを更新
      const updatedProjects = customProjects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            urls: [
              ...p.urls.filter(item => item.url !== url), // 既存の同じURLを除外
              { url, title, savedAt: Date.now() },
            ],
            updatedAt: Date.now(),
          }
        }
        return p
      })

      setCustomProjects(updatedProjects)
      toast.success('URLを追加しました')
    } catch (error) {
      console.error('URL追加エラー:', error)
      toast.error('URLの追加に失敗しました')
    }
  }

  const handleDeleteUrlFromProject = async (projectId: string, url: string) => {
    try {
      // カスタムプロジェクトからURLを削除
      await removeUrlFromCustomProject(projectId, url)

      // ドメインモードからも同じURLを削除
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

      // ドメインモードのデータを更新
      const updatedGroups = savedTabs
        .map((group: TabGroup) => {
          const updatedUrls = group.urls.filter(
            (item: { url: string }) => item.url !== url,
          )
          if (updatedUrls.length === 0) {
            return null // URLが0になったらグループを削除
          }
          return {
            ...group,
            urls: updatedUrls,
          }
        })
        .filter((proj: TabGroup | null): proj is TabGroup => proj !== null) // Filter out null entries with type guard

      // ドメインモードのデータを保存
      await chrome.storage.local.set({ savedTabs: updatedGroups })
      console.log(`URL "${url}" をドメインモードからも削除しました`)

      // プロジェクトリストを更新（functional updateで最新状態を使用）
      setCustomProjects(prev =>
        prev.map(p =>
          p.id === projectId
            ? {
                ...p,
                urls: p.urls.filter(item => item.url !== url),
                updatedAt: Date.now(),
              }
            : p,
        ),
      )
      toast.success('URLを削除しました')
    } catch (error) {
      console.error('URL削除エラー:', error)
      toast.error('URLの削除に失敗しました')
    }
  }

  // 新しいカテゴリ関連のハンドラーを追加
  const handleAddCategory = async (projectId: string, categoryName: string) => {
    try {
      await addCategoryToProject(projectId, categoryName)

      // プロジェクトリストを更新
      const updatedProjects = customProjects.map(p => {
        if (p.id === projectId) {
          const updatedCategories = [...p.categories, categoryName]
          return {
            ...p,
            categories: updatedCategories,
            categoryOrder: p.categoryOrder
              ? [...p.categoryOrder, categoryName]
              : updatedCategories,
            updatedAt: Date.now(),
          }
        }
        return p
      })

      setCustomProjects(updatedProjects)
      toast.success(`カテゴリ「${categoryName}」を追加しました`)
    } catch (error) {
      console.error('カテゴリ追加エラー:', error)
      toast.error('カテゴリの追加に失敗しました')
    }
  }

  const handleDeleteProjectCategory = async (
    projectId: string,
    categoryName: string,
  ) => {
    try {
      await removeCategoryFromProject(projectId, categoryName)

      // プロジェクトリストを更新
      const updatedProjects = customProjects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            categories: p.categories.filter(c => c !== categoryName),
            categoryOrder: p.categoryOrder
              ? p.categoryOrder.filter(c => c !== categoryName)
              : undefined,
            urls: p.urls.map(u =>
              u.category === categoryName ? { ...u, category: undefined } : u,
            ),
            updatedAt: Date.now(),
          }
        }
        return p
      })

      setCustomProjects(updatedProjects)
      toast.success(`カテゴリ「${categoryName}」を削除しました`)
    } catch (error) {
      console.error('カテゴリ削除エラー:', error)
      toast.error('カテゴリの削除に失敗しました')
    }
  }

  const handleSetUrlCategory = async (
    projectId: string,
    url: string,
    category?: string,
  ) => {
    try {
      await setUrlCategory(projectId, url, category)

      // プロジェクトリストを更新
      const updatedProjects = customProjects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            urls: p.urls.map(u => (u.url === url ? { ...u, category } : u)),
            updatedAt: Date.now(),
          }
        }
        return p
      })

      setCustomProjects(updatedProjects)
    } catch (error) {
      console.error('URL分類エラー:', error)
      toast.error('URLの分類更新に失敗しました')
    }
  }

  const handleUpdateCategoryOrder = async (
    projectId: string,
    newOrder: string[],
  ) => {
    try {
      console.log(`カテゴリ順序を更新: ${projectId}`, newOrder)
      await updateCategoryOrder(projectId, newOrder)

      // プロジェクトリストを更新
      const updatedProjects = customProjects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            categoryOrder: newOrder,
            updatedAt: Date.now(),
          }
        }
        return p
      })

      setCustomProjects(updatedProjects)
      // 成功メッセージは CustomProjectCard 内で表示するため不要
    } catch (error) {
      console.error('カテゴリ順序更新エラー:', error)
      toast.error('カテゴリの順序更新に失敗しました')
    }
  }

  const handleReorderUrls = async (
    projectId: string,
    urls: CustomProject['urls'],
  ) => {
    try {
      await reorderProjectUrls(projectId, urls)

      // プロジェクトリストを更新
      const updatedProjects = customProjects.map(p => {
        if (p.id === projectId) {
          return { ...p, urls, updatedAt: Date.now() }
        }
        return p
      })

      setCustomProjects(updatedProjects)
    } catch (error) {
      console.error('URL順序更新エラー:', error)
      toast.error('URLの順序更新に失敗しました')
    }
  }

  // プロジェクトの順序を更新するハンドラー関数を追加
  const handleReorderProjects = async (newOrder: string[]) => {
    try {
      console.log('プロジェクト順序を更新:', newOrder)

      // バックエンドのストレージに順序を保存
      await updateProjectOrder(newOrder)

      // UIの状態を更新: 新しい順序でプロジェクトを並び替え
      const orderedProjects = [...customProjects].sort((a, b) => {
        const indexA = newOrder.indexOf(a.id)
        const indexB = newOrder.indexOf(b.id)
        // 見つからない場合は最後に配置
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })

      setCustomProjects(orderedProjects)
      toast.success('プロジェクトの順序を変更しました')
    } catch (error) {
      console.error('プロジェクト順序更新エラー:', error)
      toast.error('プロジェクト順序の更新に失敗しました')
    }
  }

  // カテゴリ名変更ハンドラ
  const handleRenameCategory = async (
    projectId: string,
    oldCategoryName: string,
    newCategoryName: string,
  ) => {
    try {
      await renameCategoryInProject(projectId, oldCategoryName, newCategoryName)
      const updated = customProjects.map(project =>
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
              urls: project.urls.map(item => ({
                ...item,
                category:
                  item.category === oldCategoryName
                    ? newCategoryName
                    : item.category,
              })),
            }
          : project,
      )
      setCustomProjects(updated)
      toast.success('カテゴリ名を変更しました')
    } catch (error) {
      console.error('カテゴリ名の変更エラー:', error)
      toast.error('カテゴリ名の変更に失敗しました')
    }
  }

  // 既存のタブ開く処理を拡張して両方のモードで同期する
  const handleOpenTab = async (url: string) => {
    // 設定に基づきバックグラウンド(active: false)またはフォアグラウンド(active: true)で開く
    chrome.tabs.create({ url, active: !settings.openUrlInBackground })

    // 設定に基づいて、開いたタブを削除するかどうかを決定
    if (settings.removeTabAfterOpen) {
      // タブを開いた後に削除する処理
      const updatedGroups = tabGroups
        .map(group => ({
          ...group,
          urls: group.urls.filter(item => item.url !== url),
        }))
        // 空のグループを削除
        .filter((proj: TabGroup | null): proj is TabGroup => proj !== null) // Filter out null entries with type guard

      setTabGroups(updatedGroups)
      await chrome.storage.local.set({ savedTabs: updatedGroups })

      // カスタムモードも同期して更新
      // URLが開かれた場合、両方のモードから削除する
      try {
        // カスタムプロジェクトから該当URLを削除
        const updatedProjects = customProjects.map(project => ({
          ...project,
          urls: project.urls.filter(item => item.url !== url),
        }))
        // 空のプロジェクトは削除しない（ユーザーが明示的に削除するまで残す）

        setCustomProjects(updatedProjects)
        await saveCustomProjects(updatedProjects)
      } catch (error) {
        console.error('カスタムモードの同期エラー:', error)
      }
    }
  }

  // handleOpenAllTabs関数も同様に修正
  const handleOpenAllTabs = async (urls: { url: string; title: string }[]) => {
    // ①新しいウィンドウでまとめて開くモード
    if (settings.openAllInNewWindow) {
      await chrome.windows.create({
        url: urls.map(u => u.url),
        focused: true, // 新ウィンドウを常に前面に表示
      })
    }
    // ②通常モード: タブ単位で開く
    else {
      for (const { url } of urls) {
        await chrome.tabs.create({ url, active: !settings.openUrlInBackground })
      }
    }

    // ③開いた後に削除設定が有効ならグループ/プロジェクトを更新
    if (settings.removeTabAfterOpen) {
      const urlSet = new Set(urls.map(u => u.url))

      // カテゴリ設定を保存
      for (const group of tabGroups) {
        const remaining = group.urls.filter(item => !urlSet.has(item.url))
        if (remaining.length === 0) {
          await updateDomainCategorySettings(
            group.domain,
            group.subCategories || [],
            group.categoryKeywords || [],
          )
        }
      }

      // グループをフィルタリング
      const updatedGroups = tabGroups
        .map(g => {
          const rem = g.urls.filter(item => !urlSet.has(item.url))
          return rem.length === 0 ? null : { ...g, urls: rem }
        })
        .filter((proj: TabGroup | null): proj is TabGroup => proj !== null) // Filter out null entries with type guard

      setTabGroups(updatedGroups)
      await chrome.storage.local.set({ savedTabs: updatedGroups })

      // カスタムプロジェクトも同期
      try {
        const updatedProjects = customProjects.map(p => ({
          ...p,
          urls: p.urls.filter(item => !urlSet.has(item.url)),
        }))
        setCustomProjects(updatedProjects)
        await saveCustomProjects(updatedProjects)
      } catch (e) {
        console.error('カスタムプロジェクト同期エラー:', e)
      }
    }
  }

  // handleDeleteGroup関数を修正
  const handleDeleteGroup = async (id: string) => {
    try {
      // 削除前にカテゴリ設定と親カテゴリ情報を保存
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
      const groupToDelete = savedTabs.find(
        (group: { id: string }) => group.id === id,
      )
      if (!groupToDelete) return
      console.log(`グループを削除: ${groupToDelete.domain}`)

      // 専用の削除前処理関数を呼び出し（インポートした関数を使用）
      await handleTabGroupRemoval(id)

      // 以降は従来通りの処理
      const updatedGroups = savedTabs.filter(
        (group: { id: string }) => group.id !== id,
      )
      setTabGroups(updatedGroups)
      await chrome.storage.local.set({ savedTabs: updatedGroups })

      // 親カテゴリからはドメインIDのみを削除（ドメイン名は保持）
      const updatedCategories = categories.map(category => ({
        ...category,
        domains: category.domains.filter(domainId => domainId !== id),
      }))

      await saveParentCategories(updatedCategories)
      console.log('グループ削除処理が完了しました')
    } catch (error) {
      console.error('グループ削除エラー:', error)
    }
  }

  const handleDeleteUrl = async (groupId: string, url: string) => {
    const updatedGroups = tabGroups
      .map(group => {
        if (group.id === groupId) {
          const updatedUrls = group.urls.filter(item => item.url !== url)
          if (updatedUrls.length === 0) {
            return null // URLが0になったらグループを削除
          }
          return {
            ...group,
            urls: updatedUrls,
          }
        }
        return group
      })
      .filter((proj: TabGroup | null): proj is TabGroup => proj !== null) // Filter out null entries with type guard

    setTabGroups(updatedGroups)
    await chrome.storage.local.set({ savedTabs: updatedGroups })
  }

  const handleUpdateUrls = async (
    groupId: string,
    updatedUrls: TabGroup['urls'],
  ) => {
    const updatedGroups = tabGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          urls: updatedUrls,
        }
      }
      return group
    })

    setTabGroups(updatedGroups)
    await chrome.storage.local.set({ savedTabs: updatedGroups })
  }

  // 子カテゴリを追加
  const handleAddSubCategory = async () => {
    if (newSubCategory.trim()) {
      try {
        await addSubCategoryToGroup('', newSubCategory.trim())
        setShowSubCategoryModal(false)
        setNewSubCategory('')
      } catch (error) {
        console.error('子カテゴリ追加エラー:', error)
      }
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setTabGroups((groups: TabGroup[]) => {
        const oldIndex = groups.findIndex(group => group.id === active.id)
        const newIndex = groups.findIndex(group => group.id === over.id)

        const newGroups = arrayMove(groups, oldIndex, newIndex)

        // ストレージに保存
        chrome.storage.local.set({ savedTabs: newGroups })

        return newGroups
      })
    }
  }

  // カテゴリの削除を処理する関数 - 改善版
  const handleDeleteCategory = async (
    groupId: string,
    categoryName: string,
  ) => {
    try {
      console.log(`カテゴリ ${categoryName} の削除を開始します...`)

      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')

      // 削除前にグループを取得して現在のカテゴリを確認
      const targetGroup = savedTabs.find(
        (group: TabGroup) => group.id === groupId,
      )
      if (!targetGroup) {
        console.error('カテゴリ削除対象のグループが見つかりません:', groupId)
        return
      }

      const updatedGroups = savedTabs.map((group: TabGroup) => {
        if (group.id === groupId) {
          // 削除前と削除後のカテゴリ情報をログ
          console.log('削除前のサブカテゴリ:', group.subCategories)

          const updatedSubCategories =
            group.subCategories?.filter(cat => cat !== categoryName) || []

          console.log('削除後のサブカテゴリ:', updatedSubCategories)

          return {
            ...group,
            subCategories: updatedSubCategories,
            categoryKeywords:
              group.categoryKeywords?.filter(
                ck => ck.categoryName !== categoryName,
              ) || [],
            urls: group.urls.map(url =>
              url.subCategory === categoryName
                ? { ...url, subCategory: undefined }
                : url,
            ),
          }
        }
        return group
      })

      console.log(`カテゴリ ${categoryName} を削除します`)
      await chrome.storage.local.set({ savedTabs: updatedGroups })

      // 明示的に状態を更新
      setTabGroups(updatedGroups)

      console.log(`カテゴリ ${groupId} を削除しました`)
    } catch (error) {
      console.error('カテゴリ削除エラー:', error)
    }
  }

  // 親カテゴリの順序変更ハンドラを追加
  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // カテゴリの順序を更新
      const oldIndex = categories.findIndex(cat => cat.id === active.id)
      const newIndex = categories.findIndex(cat => cat.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        // 新しい順序を作成
        const newOrder = arrayMove(categoryOrder, oldIndex, newIndex)
        setCategoryOrder(newOrder)

        // 新しい順序に基づいてカテゴリを並び替え
        const orderedCategories = [...categories].sort(
          (a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id),
        )

        // ストレージに保存
        await saveParentCategories(orderedCategories)
        setCategories(orderedCategories)
      }
    }
  }

  // カテゴリ内のドメイン順序更新関数を改善
  const handleUpdateDomainsOrder = async (
    categoryId: string,
    updatedDomains: TabGroup[],
  ) => {
    try {
      console.log('カテゴリ内のドメイン順序を更新:', categoryId)
      console.log(
        '更新後のドメイン順序:',
        updatedDomains.map(d => d.domain),
      )

      // 更新するカテゴリを探す
      const targetCategory = categories.find(cat => cat.id === categoryId)
      if (!targetCategory) {
        console.error('更新対象のカテゴリが見つかりません:', categoryId)
        return
      }

      // 更新するドメインIDの配列を作成
      const updatedDomainIds = updatedDomains.map(domain => domain.id)

      // カテゴリ内のドメイン順序を更新
      const updatedCategories = categories.map(category => {
        if (category.id === categoryId) {
          return {
            ...category,
            domains: updatedDomainIds,
          }
        }
        return category
      })

      // ストレージに保存
      await saveParentCategories(updatedCategories)
      setCategories(updatedCategories)

      console.log('カテゴリ内のドメイン順序を更新しました:', categoryId)
    } catch (error) {
      console.error('カテゴリ内ドメイン順序更新エラー:', error)
    }
  }

  // タブグループをカテゴリごとに整理する関数を強化
  const organizeTabGroups = (): {
    categorized: Record<string, TabGroup[]>
    uncategorized: TabGroup[]
  } => {
    if (!settings.enableCategories) {
      return { categorized: {}, uncategorized: tabGroups }
    }

    console.log('親カテゴリ一覧:', categories)
    console.log('タブグループ:', tabGroups)

    // カテゴリに属するドメインとカテゴリに属さないドメインに分ける
    const categorizedGroups: Record<string, TabGroup[]> = {}
    const uncategorizedGroups: TabGroup[] = []

    const groupsToOrganize = tabGroups
      .map(g => {
        const filteredUrls = g.urls.filter(item => {
          if (searchQuery) {
            const query = searchQuery.toLowerCase()
            const matchesBasicFields =
              item.title.toLowerCase().includes(query) ||
              item.url.toLowerCase().includes(query) ||
              g.domain.toLowerCase().includes(query)

            // 子カテゴリでの検索
            const matchesSubCategory = item.subCategory
              ?.toLowerCase()
              .includes(query)

            // 親カテゴリでの検索（このタブグループが属する親カテゴリ名で検索）
            let matchesParentCategory = false

            // まず、parentCategoryIdで検索
            if (g.parentCategoryId) {
              const parentCategory = categories.find(
                cat => cat.id === g.parentCategoryId,
              )
              if (parentCategory) {
                matchesParentCategory = parentCategory.name
                  .toLowerCase()
                  .includes(query)
                console.log(
                  `親カテゴリ検索デバッグ: ドメイン ${g.domain}, 親カテゴリ「${parentCategory.name}」, クエリ「${query}」, マッチ: ${matchesParentCategory}`,
                )
              } else {
                console.log(
                  `親カテゴリ検索デバッグ: ドメイン ${g.domain}, parentCategoryId ${g.parentCategoryId} に対応するカテゴリが見つかりません`,
                )
              }
            }

            // parentCategoryIdが未設定またはマッチしない場合、リアルタイムでカテゴリを探す
            if (!matchesParentCategory) {
              for (const category of categories) {
                // IDベースまたはドメイン名ベースでカテゴリを探す
                if (
                  category.domains?.includes(g.id) ||
                  category.domainNames?.includes(g.domain)
                ) {
                  const categoryMatches = category.name
                    .toLowerCase()
                    .includes(query)
                  if (categoryMatches) {
                    matchesParentCategory = true
                    console.log(
                      `親カテゴリ検索デバッグ（リアルタイム）: ドメイン ${g.domain}, 親カテゴリ「${category.name}」, クエリ「${query}」, マッチ: ${categoryMatches}`,
                    )
                    break
                  }
                }
              }
            }

            if (!g.parentCategoryId && !matchesParentCategory) {
              console.log(
                `親カテゴリ検索デバッグ: ドメイン ${g.domain}, parentCategoryIdが未設定かつカテゴリマッチなし`,
              )
            }

            if (
              !(
                matchesBasicFields ||
                matchesSubCategory ||
                matchesParentCategory
              )
            ) {
              return false
            }
          }
          return true
        })
        return { ...g, urls: filteredUrls }
      })
      .filter(g => g.urls.length > 0)

    for (const group of groupsToOrganize) {
      // このグループが属するカテゴリを探す
      let found = false

      // まずIDベースでカテゴリを検索
      for (const category of categories) {
        if (category.domains?.includes(group.id)) {
          // 配列が未初期化の場合は初期化する
          if (!categorizedGroups[category.id]) {
            categorizedGroups[category.id] = []
          }
          categorizedGroups[category.id].push(group)

          // TabGroupのparentCategoryIdが設定されていない場合は設定
          if (group.parentCategoryId !== category.id) {
            group.parentCategoryId = category.id
            console.log(
              `ドメイン ${group.domain} のparentCategoryIdをIDベースで ${category.id} に更新しました`,
            )

            // TabGroupの変更を永続化
            ;(async () => {
              try {
                const { savedTabs = [] } =
                  await chrome.storage.local.get('savedTabs')
                const updatedTabGroups = savedTabs.map((tab: TabGroup) =>
                  tab.id === group.id
                    ? { ...tab, parentCategoryId: category.id }
                    : tab,
                )
                await chrome.storage.local.set({ savedTabs: updatedTabGroups })
                console.log(
                  `ドメイン ${group.domain} のTabGroupを永続化しました`,
                )
              } catch (err) {
                console.error('TabGroup更新エラー:', err)
              }
            })()
          }

          found = true
          console.log(
            `ドメイン ${group.domain} はIDベースで ${category.name} に分類されました`,
          )
          break
        }
      }

      // IDで見つからなかった場合は、ドメイン名で検索
      if (!found) {
        for (const category of categories) {
          if (
            category.domainNames &&
            Array.isArray(category.domainNames) &&
            category.domainNames.includes(group.domain)
          ) {
            // 配列が未初期化の場合は初期化する
            if (!categorizedGroups[category.id]) {
              categorizedGroups[category.id] = []
            }
            categorizedGroups[category.id].push(group)

            console.log(
              `ドメイン ${group.domain} はドメイン名ベースで ${category.name} に分類されました`,
            )

            // TabGroupのparentCategoryIdを更新
            group.parentCategoryId = category.id
            console.log(
              `ドメイン ${group.domain} のparentCategoryIdを ${category.id} に設定しました`,
            )

            // 見つかった場合、ドメインIDも更新して同期させる
            ;(async () => {
              try {
                const updatedCategory = {
                  ...category,
                  domains: [...category.domains, group.id],
                }

                await saveParentCategories(
                  categories.map(c =>
                    c.id === category.id ? updatedCategory : c,
                  ),
                )

                // TabGroupも永続化するために保存
                const { savedTabs = [] } =
                  await chrome.storage.local.get('savedTabs')
                const updatedTabGroups = savedTabs.map((tab: TabGroup) =>
                  tab.id === group.id
                    ? { ...tab, parentCategoryId: category.id }
                    : tab,
                )
                await chrome.storage.local.set({ savedTabs: updatedTabGroups })

                console.log(
                  `ドメイン ${group.domain} のIDを親カテゴリに同期し、TabGroupも更新しました`,
                )
              } catch (err) {
                console.error('カテゴリ同期エラー:', err)
              }
            })()

            found = true
            break
          }
        }
      }

      if (!found) {
        uncategorizedGroups.push(group)
        console.log(`ドメイン ${group.domain} は未分類です`)
      }
    }

    // カテゴリ内のドメイン順序を維持するための処理を追加
    for (const categoryId of Object.keys(categorizedGroups)) {
      // カテゴリIDに対応する配列が未初期化の場合は初期化する
      if (!categorizedGroups[categoryId]) {
        categorizedGroups[categoryId] = []
      }
      const category = categories.find(c => c.id === categoryId)
      const domains = category?.domains
      if (domains && domains.length > 0) {
        // ドメインIDの順序に従ってドメインをソート
        const domainArray = [...domains] // 配列として扱うことを保証
        categorizedGroups[categoryId].sort((a, b) => {
          const indexA = domainArray.indexOf(a.id)
          const indexB = domainArray.indexOf(b.id)
          // 見つからない場合は最後に配置
          if (indexA === -1) return 1
          if (indexB === -1) return -1
          return indexA - indexB
        })
      }
    }

    return {
      categorized: categorizedGroups,
      uncategorized: uncategorizedGroups,
    }
  }

  // 検索・フィルタ適用後のグループを整理
  const { categorized, uncategorized } = organizeTabGroups()
  // コンテンツがあるグループリスト（カテゴリと未分類を結合）
  const hasContentTabGroups = [
    ...Object.values(categorized).flat(),
    ...uncategorized,
  ]

  // カスタムモード検索用にプロジェクトとURLをフィルタリング
  const filteredCustomProjects = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return customProjects

    const query = q.toLowerCase()

    // プロジェクト名での曖昧検索
    const projectFuse = new Fuse(customProjects, {
      keys: ['name'],
      threshold: 0.4,
    })
    const matchedProjects = projectFuse.search(q).map(res => res.item)

    // カテゴリ名での検索
    const categoryMatchedProjects = customProjects
      .filter(proj => !matchedProjects.includes(proj))
      .filter(proj =>
        proj.categories.some(category =>
          category.toLowerCase().includes(query),
        ),
      )

    // URLレベルでの曖昧検索（カテゴリ名も含む）
    const urlFuseOptions = { keys: ['title', 'url'], threshold: 0.4 }
    const urlMatchedProjects = customProjects
      .filter(
        proj =>
          !matchedProjects.includes(proj) &&
          !categoryMatchedProjects.includes(proj),
      )
      .map(proj => {
        const fuseUrls = new Fuse(proj.urls, urlFuseOptions)
        const fuseMatches = fuseUrls.search(q).map(r => r.item)

        // URL個別のカテゴリ名での検索も追加
        const categoryMatches = proj.urls.filter(url =>
          url.category?.toLowerCase().includes(query),
        )

        const allMatches = [...fuseMatches, ...categoryMatches]
        // 重複を削除
        const uniqueMatches = allMatches.filter(
          (url, index, self) =>
            self.findIndex(u => u.url === url.url) === index,
        )

        return uniqueMatches.length ? { ...proj, urls: uniqueMatches } : null
      })
      .filter(
        (proj: CustomProject | null): proj is CustomProject => proj !== null,
      ) // Filter out null entries with type guard

    return [
      ...matchedProjects,
      ...categoryMatchedProjects,
      ...urlMatchedProjects,
    ]
  }, [customProjects, searchQuery])

  // ストレージ変更検出時のリスナーを改善（ドメインモードとカスタムモード間の同期）
  useEffect(() => {
    // ...existing code...

    // ストレージが変更されたときに再読み込み
    chrome.storage.onChanged.addListener(async changes => {
      console.log('ストレージ変更を検出:', changes)

      // savedTabsの変更を検出した場合
      if (changes.savedTabs) {
        const storageResult = await chrome.storage.local.get('savedTabs')
        const savedTabs: TabGroup[] = Array.isArray(storageResult.savedTabs)
          ? storageResult.savedTabs
          : []
        setTabGroups(savedTabs)

        // ドメインモードで変更があった場合、カスタムプロジェクトも同期更新
        await syncDomainDataToCustomProjects()
      }

      if (changes.userSettings) {
        setSettings(prev => ({ ...prev, ...changes.userSettings.newValue }))
      }

      if (changes.parentCategories) {
        setCategories(changes.parentCategories.newValue || [])
      }

      // カスタムプロジェクトの変更を検出した場合
      if (changes.customProjects && viewMode === 'custom') {
        setCustomProjects(changes.customProjects.newValue || [])
      }
    })
  }, [viewMode, syncDomainDataToCustomProjects]) // 必要な依存関係を追加

  // ドメインを別のカテゴリに移動する関数
  const handleMoveDomainToCategory = async (
    domainId: string,
    fromCategoryId: string | null,
    toCategoryId: string,
  ) => {
    try {
      const domainGroup = tabGroups.find(group => group.id === domainId)
      if (!domainGroup) return

      let updatedCategories = [...categories]

      if (fromCategoryId) {
        updatedCategories = updatedCategories.map(cat =>
          cat.id === fromCategoryId
            ? {
                ...cat,
                domains: cat.domains.filter(d => d !== domainId),
                domainNames: cat.domainNames
                  ? cat.domainNames.filter(d => d !== domainGroup.domain)
                  : [],
              }
            : cat,
        )
      }

      updatedCategories = updatedCategories.map(cat =>
        cat.id === toCategoryId
          ? {
              ...cat,
              domains: cat.domains.includes(domainId)
                ? cat.domains
                : [...cat.domains, domainId],
              domainNames: cat.domainNames?.includes(domainGroup.domain)
                ? cat.domainNames
                : [...(cat.domainNames || []), domainGroup.domain],
            }
          : cat,
      )

      await saveParentCategories(updatedCategories)
      setCategories(updatedCategories)
      console.log(
        `ドメイン ${domainGroup.domain} を ${fromCategoryId || '未分類'} から ${toCategoryId} に移動しました`,
      )
    } catch (error) {
      console.error('カテゴリ間ドメイン移動エラー:', error)
    }
  }

  // カスタムプロジェクト間でURLを移動するハンドラ
  const handleMoveUrlBetweenProjects = async (
    sourceProjectId: string,
    targetProjectId: string,
    url: string,
  ) => {
    try {
      console.log(
        `URL移動: ${sourceProjectId} → ${targetProjectId}, URL: ${url}`,
      )
      // 移動するURLのデータを取得
      const sourceProject = customProjects.find(p => p.id === sourceProjectId)
      const targetProject = customProjects.find(p => p.id === targetProjectId)
      if (!sourceProject || !targetProject) {
        console.error('プロジェクトが見つかりません')
        return null
      }
      // 移動するURLを見つける
      const urlItem = sourceProject.urls.find(item => item.url === url)
      if (!urlItem) {
        console.error('移動するURLが見つかりません')
        return null
      }
      // 移動先に既に同じURLが存在していないか確認
      const existsInTarget = targetProject.urls.some(item => item.url === url)
      if (existsInTarget) {
        console.log('移動先に既にURLが存在するため、移動をスキップします')
        toast.info('移動先のプロジェクトに既にこのURLが存在します')
        return null
      }
      // 元のカテゴリ情報を保持（移動元のカテゴリが存在する場合）
      const originalCategory = urlItem.category
      // 元のプロジェクトからURLを削除
      await removeUrlFromCustomProject(sourceProjectId, url)
      // 移動先のプロジェクトにURLを追加（注記とカテゴリ情報も保持）
      await addUrlToCustomProject(
        targetProjectId,
        url,
        urlItem.title,
        urlItem.notes,
        originalCategory, // カテゴリを保持して移動
      )
      // UIの状態を更新
      const updatedProjects = customProjects.map(project => {
        if (project.id === sourceProjectId) {
          return {
            ...project,
            urls: project.urls.filter(item => item.url !== url),
            updatedAt: Date.now(),
          }
        }
        if (project.id === targetProjectId) {
          return {
            ...project,
            urls: [
              ...project.urls,
              { ...urlItem, category: originalCategory, savedAt: Date.now() },
            ],
            updatedAt: Date.now(),
          }
        }
        return project
      })
      setCustomProjects(updatedProjects)
      toast.success('URLを移動しました')
      return originalCategory
    } catch (error) {
      console.error('URL移動エラー:', error)
      toast.error('URLの移動に失敗しました')
      return null
    }
  }

  // カテゴリ間でURLを移動するハンドラ
  const handleMoveUrlsBetweenCategories = async (
    projectId: string,
    sourceCategoryName: string,
    targetCategoryName: string,
  ) => {
    try {
      console.log(
        `カテゴリ間URL移動: ${sourceCategoryName} → ${targetCategoryName}, プロジェクト: ${projectId}`,
      )
      // 移動元と移動先のプロジェクトを見つける
      const project = customProjects.find(p => p.id === projectId)
      if (!project) {
        console.error('プロジェクトが見つかりません')
        return
      }
      // 移動元カテゴリに属するURLを特定
      const urlsToMove = project.urls.filter(
        item => item.category === sourceCategoryName,
      )
      console.log(
        `カテゴリ "${sourceCategoryName}" のURL数: ${urlsToMove.length}`,
      )
      console.log(
        `カテゴリ "${targetCategoryName}" のURL数: ${project.urls.filter(item => item.category === targetCategoryName).length}`,
      )
      // カテゴリを統合するか、URLを移動するかを判断
      if (urlsToMove.length === 0) {
        // 移動元カテゴリにURLがない場合は統合
        await removeCategoryFromProject(projectId, sourceCategoryName)
        toast.success(
          `カテゴリ「${sourceCategoryName}」を「${targetCategoryName}」に統合しました`,
        )
        const updatedProjects = customProjects.map(p => {
          if (p.id === projectId) {
            return {
              ...p,
              categories: p.categories.filter(c => c !== sourceCategoryName),
              categoryOrder: p.categoryOrder
                ? p.categoryOrder.filter(c => c !== sourceCategoryName)
                : undefined,
              updatedAt: Date.now(),
            }
          }
          return p
        })
        setCustomProjects(updatedProjects)
        return
      }
      // 各URLのカテゴリを変更
      let successCount = 0
      for (const urlItem of urlsToMove) {
        try {
          await setUrlCategory(projectId, urlItem.url, targetCategoryName)
          successCount++
        } catch (error) {
          console.error(`URL ${urlItem.url} の移動に失敗:`, error)
        }
      }
      // UIの状態を更新
      const updatedProjects = customProjects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            urls: p.urls.map(item => {
              if (item.category === sourceCategoryName) {
                return { ...item, category: targetCategoryName }
              }
              return item
            }),
            updatedAt: Date.now(),
          }
        }
        return p
      })
      setCustomProjects(updatedProjects)
      if (successCount > 0) {
        await removeCategoryFromProject(projectId, sourceCategoryName)
        toast.success(
          `カテゴリ「${sourceCategoryName}」から「${targetCategoryName}」へ ${successCount} 件のURLを移動しました`,
        )
      }
    } catch (error) {
      console.error('カテゴリ間URL移動エラー:', error)
      toast.error('URLの移動に失敗しました')
    }
  }

  return (
    <>
      <Toaster />
      <div className='container mx-auto min-h-screen px-4 py-2'>
        <Header
          tabGroups={tabGroups}
          filteredTabGroups={
            viewMode === 'domain'
              ? hasContentTabGroups
              : // カスタムモードの場合、filteredCustomProjectsからTabGroup形式に変換
                filteredCustomProjects.map(
                  proj =>
                    ({
                      id: proj.id,
                      domain: proj.name, // プロジェクト名をドメインとして使用
                      urls: proj.urls,
                    }) as TabGroup,
                )
          }
          customProjects={customProjects}
          onAddCategory={handleAddCategory}
          currentMode={viewMode}
          onModeChange={handleViewModeChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        {isLoading ? (
          <div className='flex min-h-[200px] items-center justify-center'>
            <div className='text-foreground text-xl'>読み込み中...</div>
          </div>
        ) : viewMode === 'domain' ? (
          // ドメインモード表示（既存の表示）
          <>
            {/* 既存のドメインモード表示コード */}
            {settings.enableCategories &&
              Object.keys(categorized).length > 0 && (
                <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleCategoryDragEnd}
                  >
                    <SortableContext
                      items={categoryOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className='flex flex-col gap-1'>
                        {/* カテゴリ順序に基づいて表示 */}
                        {categoryOrder.map(categoryId => {
                          if (!categoryId) return null
                          const category = categories.find(
                            c => c.id === categoryId,
                          )
                          if (!category) return null
                          const domainGroups = categorized[categoryId] || []
                          if (domainGroups.length === 0) return null

                          return (
                            <CategoryGroup
                              key={categoryId}
                              category={category}
                              domains={domainGroups}
                              handleOpenAllTabs={handleOpenAllTabs}
                              handleDeleteGroup={handleDeleteGroup}
                              handleDeleteUrl={handleDeleteUrl}
                              handleOpenTab={handleOpenTab}
                              handleUpdateUrls={handleUpdateUrls}
                              handleUpdateDomainsOrder={
                                handleUpdateDomainsOrder
                              }
                              handleMoveDomainToCategory={
                                handleMoveDomainToCategory
                              }
                              handleDeleteCategory={handleDeleteCategory}
                              settings={settings}
                            />
                          )
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {uncategorized.length > 0 && (
                    <h2 className='sticky top-0 z-50 mt-6 bg-card font-bold text-foreground text-xl'>
                      未分類のドメイン
                    </h2>
                  )}
                </>
              )}

            {/* 未分類タブを表示する部分 */}
            {uncategorized.filter(group => group.urls.length > 0).length >
              0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={uncategorized
                    .filter(group => group.urls.length > 0)
                    .map(group => group.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className='mt-2 flex flex-col gap-1'>
                    {uncategorized
                      .filter(group => group.urls.length > 0)
                      .map(group => (
                        <SortableDomainCard
                          key={group.id}
                          group={group}
                          handleOpenAllTabs={handleOpenAllTabs}
                          handleDeleteGroup={handleDeleteGroup}
                          handleDeleteUrl={handleDeleteUrl}
                          handleOpenTab={handleOpenTab}
                          handleUpdateUrls={handleUpdateUrls}
                          handleDeleteCategory={handleDeleteCategory}
                          settings={settings} // settingsを渡す
                        />
                      ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* すべてのカテゴリとドメインが空の場合のメッセージ */}
            {hasContentTabGroups.length === 0 && (
              <div className='flex min-h-[200px] flex-col items-center justify-center gap-4'>
                <div className='text-2xl text-foreground'>
                  保存されたタブはありません
                </div>
                <div className='text-muted-foreground'>
                  タブを右クリックして保存するか、拡張機能のアイコンをクリックしてください
                </div>
              </div>
            )}
          </>
        ) : (
          // カスタムモード表示
          <CustomProjectSection
            projects={filteredCustomProjects}
            handleOpenUrl={handleOpenTab}
            handleDeleteUrl={handleDeleteUrlFromProject}
            handleAddUrl={handleAddUrlToProject}
            handleCreateProject={handleCreateProject}
            handleDeleteProject={handleDeleteProject}
            handleRenameProject={handleRenameProject}
            handleAddCategory={handleAddCategory}
            handleDeleteCategory={handleDeleteProjectCategory}
            handleSetUrlCategory={handleSetUrlCategory}
            handleUpdateCategoryOrder={handleUpdateCategoryOrder}
            handleReorderUrls={handleReorderUrls}
            handleOpenAllUrls={handleOpenAllTabs}
            handleMoveUrlBetweenProjects={handleMoveUrlBetweenProjects}
            handleMoveUrlsBetweenCategories={handleMoveUrlsBetweenCategories}
            handleReorderProjects={handleReorderProjects} // 追加: プロジェクト順序更新ハンドラー
            handleRenameCategory={handleRenameCategory} // 追加: カテゴリ名変更ハンドラー
            settings={settings}
          />
        )}

        {/* ...existing code... */}
        {/* 子カテゴリ追加モーダル */}
        {showSubCategoryModal && (
          <Dialog
            open={showSubCategoryModal}
            onOpenChange={setShowSubCategoryModal}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新しい子カテゴリを追加</DialogTitle>
              </DialogHeader>
              <Input
                value={newSubCategory}
                onChange={e => setNewSubCategory(e.target.value)}
                placeholder='例: 仕事、プライベート、学習'
                className='mb-4 w-full rounded border p-2 text-foreground'
                ref={inputRef}
              />
              <DialogFooter>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setShowSubCategoryModal(false)}
                      className='cursor-pointer rounded px-2 py-1 text-secondary-foreground'
                      title='キャンセル'
                    >
                      キャンセル
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top' className='block lg:hidden'>
                    キャンセル
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='default'
                      size='sm'
                      onClick={handleAddSubCategory}
                      className='flex cursor-pointer items-center gap-1 rounded text-primary-foreground'
                      title='追加'
                    >
                      <Plus size={14} />
                      <span className='hidden lg:inline'>追加</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top' className='block lg:hidden'>
                    追加
                  </TooltipContent>
                </Tooltip>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </>
  )
}

// Reactコンポーネントをレンダリング
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app')
  if (!appContainer) throw new Error('Failed to find the app container')

  const root = createRoot(appContainer)
  root.render(
    <ThemeProvider defaultTheme='system' storageKey='tab-manager-theme'>
      <TooltipProvider>
        <SavedTabs />
      </TooltipProvider>
    </ThemeProvider>,
  )
})
