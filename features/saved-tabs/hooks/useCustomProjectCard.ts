import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { closestCenter } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { getProjectUrls } from '@/lib/storage/projects'
import type { CustomProject, UrlRecord } from '@/types/storage'
import { useCategoryDnD } from './useCategoryDnD'

/** useCustomProjectCard フックの引数 */
interface UseCustomProjectCardParams {
  /** プロジェクトデータ */
  project: CustomProject
  /** URL削除ハンドラ */
  handleDeleteUrl: (projectId: string, url: string) => void
  /** URLカテゴリ設定ハンドラ */
  handleSetUrlCategory: (
    projectId: string,
    url: string,
    category?: string,
  ) => void
  /** カテゴリ順序更新ハンドラ */
  handleUpdateCategoryOrder: (projectId: string, newOrder: string[]) => void
  /** URL並び替えハンドラ */
  handleReorderUrls: (projectId: string, urls: CustomProject['urls']) => void
}
type ProjectUrlItem = UrlRecord & {
  notes?: string
  category?: string
}
const isPointerDroppedInUncategorizedArea = (
  event: DragEndEvent,
  hasSourceCategory: boolean,
): boolean => {
  if (!hasSourceCategory || !(event.activatorEvent instanceof MouseEvent)) {
    return false
  }
  const activatorEvent = event.activatorEvent as MouseEvent
  const { delta } = event
  const dropX = activatorEvent.clientX + delta.x
  const dropY = activatorEvent.clientY + delta.y
  const dropEl = document.elementFromPoint(dropX, dropY) as HTMLElement | null
  return Boolean(dropEl?.closest('[data-uncategorized-area="true"]'))
}
const isUncategorizedDropTarget = (
  over: DragEndEvent['over'],
  projectId: string,
): boolean => {
  if (!over) {
    return false
  }
  if (over.data?.current?.type === 'uncategorized') {
    return true
  }
  if (over.id === `uncategorized-${projectId}`) {
    return true
  }
  return typeof over.id === 'string' && over.id.includes('uncategorized')
}
const reorderUrlsInBucket = (
  projectUrls: ProjectUrlItem[],
  sourceCategory: string | undefined,
  actualUrl: string,
  overId: string,
): ProjectUrlItem[] | null => {
  const urlsInTarget = projectUrls.filter(u => u.category === sourceCategory)
  const oldIndex = urlsInTarget.findIndex(u => u.url === actualUrl)
  const newIndex = urlsInTarget.findIndex(u => u.url === overId)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return null
  }
  const moved = arrayMove(urlsInTarget, oldIndex, newIndex)
  let movedIndex = 0
  return projectUrls.map(u => {
    if (u.category === sourceCategory) {
      return moved[movedIndex++]
    }
    return u
  })
}
const resolveOverCategory = (
  over: DragEndEvent['over'],
): string | undefined => {
  if (!over) {
    return undefined
  }
  if (over.data?.current?.type === 'category') {
    return over.data.current.categoryName
  }
  return over.data?.current?.category
}
type UrlToUrlDropResult =
  | {
      kind: 'noop'
    }
  | {
      kind: 'reordered'
      reorderedUrls: ProjectUrlItem[]
    }
  | {
      kind: 'moved'
      overCategory: string | undefined
    }
const shouldMoveToUncategorized = (params: {
  event: DragEndEvent
  isUncategorizedOver: boolean
  dragSourceCategory: string | undefined
  over: DragEndEvent['over']
  projectId: string
}): boolean => {
  const { event, isUncategorizedOver, dragSourceCategory, over, projectId } =
    params
  if (!dragSourceCategory) {
    return false
  }
  if (isPointerDroppedInUncategorizedArea(event, true)) {
    return true
  }
  if (isUncategorizedOver) {
    return true
  }
  return isUncategorizedDropTarget(over, projectId)
}
const applyMovedCategoryToUrls = (
  urls: ProjectUrlItem[],
  actualUrl: string,
  overCategory: string | undefined,
): ProjectUrlItem[] => {
  return urls.map(url =>
    url.url === actualUrl
      ? {
          ...url,
          category: overCategory,
        }
      : url,
  )
}
const handleProcessedUrlDrop = (params: {
  projectId: string
  actualUrl: string
  dragSourceCategory: string | undefined
  over: DragEndEvent['over']
  event: DragEndEvent
  isUncategorizedOver: boolean
  projectUrls: ProjectUrlItem[]
  handleSetUrlCategory: (
    projectId: string,
    url: string,
    category?: string,
  ) => void
  handleReorderUrls: (projectId: string, urls: CustomProject['urls']) => void
  setProjectUrls: Dispatch<SetStateAction<ProjectUrlItem[]>>
  clearDragState: () => void
}): void => {
  const {
    projectId,
    actualUrl,
    dragSourceCategory,
    over,
    event,
    isUncategorizedOver,
    projectUrls,
    handleSetUrlCategory,
    handleReorderUrls,
    setProjectUrls,
    clearDragState,
  } = params
  const moveToUncategorized = () => {
    handleSetUrlCategory(projectId, actualUrl, undefined)
    toast.success('タブを未分類に移動しました')
    clearDragState()
  }
  if (
    shouldMoveToUncategorized({
      event,
      isUncategorizedOver,
      dragSourceCategory,
      over,
      projectId,
    })
  ) {
    moveToUncategorized()
    return
  }
  const urlToUrlDropResult = processUrlToUrlDrop({
    active: event.active,
    over,
    projectUrls,
    dragSourceCategory,
    actualUrl,
  })
  if (urlToUrlDropResult.kind === 'reordered') {
    handleReorderUrls(projectId, urlToUrlDropResult.reorderedUrls)
    setProjectUrls(urlToUrlDropResult.reorderedUrls)
    toast.success('タブの順序を変更しました')
    clearDragState()
    return
  }
  if (urlToUrlDropResult.kind === 'moved') {
    handleSetUrlCategory(projectId, actualUrl, urlToUrlDropResult.overCategory)
    setProjectUrls(prev =>
      applyMovedCategoryToUrls(
        prev,
        actualUrl,
        urlToUrlDropResult.overCategory,
      ),
    )
    toast.success(
      urlToUrlDropResult.overCategory
        ? `タブを「${urlToUrlDropResult.overCategory}」に移動しました`
        : 'タブを未分類に移動しました',
    )
    clearDragState()
    return
  }
  if (over?.data?.current?.type === 'category') {
    const targetCategory = over.data.current.categoryName
    if (targetCategory && targetCategory !== dragSourceCategory) {
      handleSetUrlCategory(projectId, actualUrl, targetCategory)
      toast.success(`タブを「${targetCategory}」に移動しました`)
      clearDragState()
      return
    }
  }
  clearDragState()
}
const processUrlToUrlDrop = (params: {
  active: DragEndEvent['active']
  over: DragEndEvent['over']
  projectUrls: ProjectUrlItem[]
  dragSourceCategory: string | undefined
  actualUrl: string
}): UrlToUrlDropResult => {
  const { active, over, projectUrls, dragSourceCategory, actualUrl } = params
  const isUrlToUrlDrop =
    active.data.current?.type === 'url' &&
    over?.data.current?.type === 'url' &&
    over.id !== active.id
  if (!isUrlToUrlDrop) {
    return {
      kind: 'noop',
    }
  }
  const overCategory = resolveOverCategory(over)
  const isSameBucket =
    !(dragSourceCategory || overCategory) || dragSourceCategory === overCategory
  if (!isSameBucket) {
    return {
      kind: 'moved',
      overCategory,
    }
  }
  const reorderedUrls = reorderUrlsInBucket(
    projectUrls,
    dragSourceCategory,
    actualUrl,
    String(over.id),
  )
  if (!reorderedUrls) {
    return {
      kind: 'noop',
    }
  }
  return {
    kind: 'reordered',
    reorderedUrls,
  }
}
/**
 * CustomProjectCard の状態ロジックを管理するカスタムフック
 * @param params フックの引数
 * @returns プロジェクトURL・DnD・衝突検出関連の状態と操作
 */
export const useCustomProjectCard = ({
  project,
  handleSetUrlCategory,
  handleUpdateCategoryOrder,
  handleReorderUrls,
}: UseCustomProjectCardParams) => {
  // --- プロジェクトURL状態 ---
  const [projectUrls, setProjectUrls] = useState<ProjectUrlItem[]>([])
  const [isLoadingUrls, setIsLoadingUrls] = useState(true)
  const projectUrlsRef = useRef(projectUrls)
  const handleSetUrlCategoryRef = useRef(handleSetUrlCategory)
  useEffect(() => {
    projectUrlsRef.current = projectUrls
  }, [projectUrls])
  useEffect(() => {
    handleSetUrlCategoryRef.current = handleSetUrlCategory
  }, [handleSetUrlCategory])

  // --- DnD状態管理 ---
  const {
    isDraggingCategory,
    draggedCategoryName,
    activeId,
    draggedOverCategory,
    setDraggedOverCategory,
    setActiveId,
    handleDragStart,
    handleDragOver,
    resetDnD,
  } = useCategoryDnD()

  // --- プロジェクトURL読み込み ---
  useEffect(() => {
    const loadProjectUrls = async () => {
      setIsLoadingUrls(true)
      try {
        const urls = await getProjectUrls(project)
        setProjectUrls(urls)
      } catch (error) {
        console.error('プロジェクトURLの取得エラー:', error)
        setProjectUrls([])
      } finally {
        setIsLoadingUrls(false)
      }
    }
    loadProjectUrls()
  }, [project.id, project.updatedAt])

  // --- 衝突検出ストラテジー ---
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    args => closestCenter(args),
    [],
  )

  // --- URLドラッグ終了時 ---
  const handleUrlDragEnd = useCallback(
    (event: DragEndEvent, isUncategorizedOver: boolean) => {
      const { active, over } = event
      const actualUrl = active.data.current?.url || String(active.id)
      const dragSourceCategory = active.data.current?.category
      setActiveId(null)
      const clearDragState = () => setDraggedOverCategory(null)
      if (!over) {
        clearDragState()
        return
      }
      handleProcessedUrlDrop({
        projectId: project.id,
        actualUrl,
        dragSourceCategory,
        over,
        event,
        isUncategorizedOver,
        projectUrls,
        handleSetUrlCategory,
        handleReorderUrls,
        setProjectUrls,
        clearDragState,
      })
    },
    [
      project.id,
      projectUrls,
      handleSetUrlCategory,
      handleReorderUrls,
      setActiveId,
      setDraggedOverCategory,
    ],
  )

  // --- カテゴリドラッグ終了時 ---
  const handleCategoryDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      resetDnD()
      if (!over) {
        return
      }
      if (isDraggingCategory && draggedCategoryName && active.id !== over.id) {
        const oldIndex =
          project.categoryOrder?.indexOf(active.id as string) ??
          project.categories.indexOf(active.id as string)
        const newIndex =
          project.categoryOrder?.indexOf(over.id as string) ??
          project.categories.indexOf(over.id as string)
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(
            project.categoryOrder || project.categories,
            oldIndex,
            newIndex,
          )
          handleUpdateCategoryOrder(project.id, newOrder)
          toast.success('カテゴリの順序を変更しました')
        }
      }
    },
    [
      isDraggingCategory,
      draggedCategoryName,
      project.categoryOrder,
      project.categories,
      project.id,
      handleUpdateCategoryOrder,
      resetDnD,
    ],
  )

  // --- Alt+クリックによるカテゴリ解除 ---
  useEffect(() => {
    const handleManualCategoryReset = (e: MouseEvent) => {
      if (e.altKey) {
        const targetElement = document.elementFromPoint(
          e.clientX,
          e.clientY,
        ) as HTMLElement
        if (targetElement) {
          const urlAttr =
            targetElement.getAttribute('data-url') ||
            targetElement.closest('[data-url]')?.getAttribute('data-url')
          if (urlAttr && projectUrlsRef.current.some(u => u.url === urlAttr)) {
            handleSetUrlCategoryRef.current(project.id, urlAttr, undefined)
            toast.success('タブのカテゴリを解除しました（Alt+クリック）')
          }
        }
      }
    }
    document.addEventListener('click', handleManualCategoryReset)
    return () =>
      document.removeEventListener('click', handleManualCategoryReset)
  }, [project.id])

  // --- 計算済みデータ ---
  const uncategorizedUrls = projectUrls.filter(url => !url.category)
  const categoryOrder = project.categoryOrder || project.categories
  return {
    /** プロジェクトURL関連 */
    urls: {
      projectUrls,
      setProjectUrls,
      isLoadingUrls,
      uncategorizedUrls,
    },
    /** DnD関連 */
    dnd: {
      isDraggingCategory,
      draggedCategoryName,
      activeId,
      draggedOverCategory,
      setDraggedOverCategory,
      setActiveId,
      handleDragStart,
      handleDragOver,
      handleUrlDragEnd,
      handleCategoryDragEnd,
      collisionDetectionStrategy,
      resetDnD,
    },
    /** カテゴリ表示順 */
    categoryOrder,
  }
}
