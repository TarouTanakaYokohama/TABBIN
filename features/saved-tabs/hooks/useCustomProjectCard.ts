import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useCallback, useEffect, useRef, useState } from 'react'
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

/**
 * CustomProjectCard の状態ロジックを管理するカスタムフック
 * @param params フックの引数
 * @returns プロジェクトURL・DnD・衝突検出関連の状態と操作
 */
export function useCustomProjectCard({
  project,
  handleSetUrlCategory,
  handleUpdateCategoryOrder,
  handleReorderUrls,
}: UseCustomProjectCardParams) {
  // --- プロジェクトURL状態 ---
  const [projectUrls, setProjectUrls] = useState<
    Array<UrlRecord & { notes?: string; category?: string }>
  >([])
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
  }, [project])

  // --- 衝突検出ストラテジー ---
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    args => {
      const { active } = args
      if (active.data.current?.type === 'url') {
        const pointerCollisions = pointerWithin(args)
        if (pointerCollisions.length > 0) {
          return pointerCollisions
        }
        const intersections = rectIntersection(args)
        if (intersections.length > 0) {
          return intersections
        }
        return closestCenter(args)
      }

      const uncategorizedId = `uncategorized-${project.id}`

      const pointerCollisions = pointerWithin(args)
      const uncPointer = pointerCollisions.find(c => c.id === uncategorizedId)
      if (uncPointer && active.data.current?.type !== 'url') {
        return [uncPointer]
      }

      const intersections = rectIntersection(args)
      const uncRect = intersections.find(c => c.id === uncategorizedId)
      if (uncRect && active.data.current?.type !== 'url') {
        return [uncRect]
      }
      if (intersections.length > 0) {
        return intersections
      }

      if (pointerCollisions.length > 0) {
        return pointerCollisions
      }

      return closestCenter(args)
    },
    [project.id],
  )

  // --- URLドラッグ終了時 ---
  const handleUrlDragEnd = useCallback(
    (event: DragEndEvent, isUncategorizedOver: boolean) => {
      const { active, over } = event

      const actualUrl = active.data.current?.url || String(active.id)
      const dragSourceCategory = active.data.current?.category

      setActiveId(null)

      // Manual detection for uncategorized area
      if (event.activatorEvent instanceof MouseEvent) {
        const activatorEvent = event.activatorEvent as MouseEvent
        const { delta } = event
        const dropX = activatorEvent.clientX + delta.x
        const dropY = activatorEvent.clientY + delta.y
        const dropEl = document.elementFromPoint(
          dropX,
          dropY,
        ) as HTMLElement | null
        if (
          dropEl?.closest('[data-uncategorized-area="true"]') &&
          dragSourceCategory
        ) {
          handleSetUrlCategory(project.id, actualUrl, undefined)
          toast.success('URLを未分類に移動しました')
          setDraggedOverCategory(null)
          return
        }
      }

      if (isUncategorizedOver && dragSourceCategory) {
        handleSetUrlCategory(project.id, actualUrl, undefined)
        toast.success('URLを未分類に移動しました')
        setDraggedOverCategory(null)
        return
      }

      if (!over) {
        setDraggedOverCategory(null)
        return
      }

      // 直接的な未分類エリア検出
      if (
        (over?.id === `uncategorized-${project.id}` ||
          (typeof over?.id === 'string' &&
            over.id.includes('uncategorized'))) &&
        dragSourceCategory
      ) {
        handleSetUrlCategory(project.id, actualUrl, undefined)
        toast.success('URLを未分類に移動しました')
        setDraggedOverCategory(null)
        return
      }

      if (over?.data?.current?.type === 'uncategorized' && dragSourceCategory) {
        handleSetUrlCategory(project.id, actualUrl, undefined)
        toast.success('URLを未分類に移動しました')
        setDraggedOverCategory(null)
        return
      }

      // 同一プロジェクト内でURLの並び替え
      if (
        over &&
        active.data.current?.type === 'url' &&
        over.data.current?.type === 'url' &&
        over.id !== active.id
      ) {
        const overCategory =
          over.data?.current?.type === 'category'
            ? over.data?.current?.categoryName
            : over.data?.current?.category

        if (
          !(dragSourceCategory || overCategory) ||
          (dragSourceCategory && dragSourceCategory === overCategory)
        ) {
          const urlsInTarget = projectUrls.filter(
            u => u.category === dragSourceCategory,
          )
          const oldIndex = urlsInTarget.findIndex(u => u.url === actualUrl)
          const newIndex = urlsInTarget.findIndex(u => u.url === over.id)
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const moved = arrayMove(urlsInTarget, oldIndex, newIndex)
            let newUrls: typeof projectUrls
            if (dragSourceCategory) {
              let movedIndex = 0
              newUrls = projectUrls.map(u => {
                if (u.category === dragSourceCategory) {
                  return moved[movedIndex++]
                }
                return u
              })
            } else {
              let movedIndex = 0
              newUrls = projectUrls.map(u => {
                if (!u.category) {
                  return moved[movedIndex++]
                }
                return u
              })
            }
            handleReorderUrls(project.id, newUrls)
            setProjectUrls(newUrls)
            toast.success('URLの順序を変更しました')
            setDraggedOverCategory(null)
            return
          }
        } else if (dragSourceCategory !== overCategory) {
          handleSetUrlCategory(project.id, actualUrl, overCategory)
          setProjectUrls(prev =>
            prev.map(u =>
              u.url === actualUrl ? { ...u, category: overCategory } : u,
            ),
          )
          toast.success(
            overCategory
              ? `URLを「${overCategory}」に移動しました`
              : 'URLを未分類に移動しました',
          )
          setDraggedOverCategory(null)
          return
        }
      }

      // カテゴリへのドロップ
      if (over?.data?.current?.type === 'category') {
        const targetCategory = over.data.current.categoryName
        if (targetCategory && targetCategory !== dragSourceCategory) {
          handleSetUrlCategory(project.id, actualUrl, targetCategory)
          toast.success(`URLを「${targetCategory}」に移動しました`)
          setDraggedOverCategory(null)
          return
        }
      }

      setDraggedOverCategory(null)
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
            toast.success('URLのカテゴリを解除しました（Alt+クリック）')
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
    },
    /** カテゴリ表示順 */
    categoryOrder,
  }
}
