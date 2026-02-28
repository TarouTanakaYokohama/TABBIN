import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useDragHandlers } from '../../contexts/DragHandlersContext'
import { useCustomProjectCard } from '../../hooks/useCustomProjectCard'
import type { CustomProjectCardProps } from '../../types/CustomProjectCard.types'
import {
  ProjectCardContext,
  type ProjectCardContextType,
} from './ProjectCardContext'

/** ProjectCardRoot の props */
interface ProjectCardRootProps {
  /** プロジェクトデータ */
  project: CustomProjectCardProps['project']
  /** 設定 */
  settings: CustomProjectCardProps['settings']
  /** ドラッグ中アイテム */
  draggedItem?: CustomProjectCardProps['draggedItem']
  /** ドロップターゲットか */
  isDropTarget?: boolean
  /** プロジェクト並び替え中か */
  isProjectReorderMode?: boolean
  /** 操作ハンドラ */
  handlers: ProjectCardContextType['handlers']
  /** useCustomProjectCard に渡すハンドラ */
  hookHandlers: {
    handleDeleteUrl: CustomProjectCardProps['handleDeleteUrl']
    handleSetUrlCategory: CustomProjectCardProps['handleSetUrlCategory']
    handleUpdateCategoryOrder: CustomProjectCardProps['handleUpdateCategoryOrder']
    handleReorderUrls: CustomProjectCardProps['handleReorderUrls']
  }
  /** 子コンポーネント */
  children: React.ReactNode
}

/**
 * ProjectCard の複合コンポーネントルート
 * Card + useSortable + useDroppable + useCustomProjectCard + DndContext を提供する
 * @param props ProjectCardRootProps
 */
export const ProjectCardRoot = ({
  project,
  settings,
  draggedItem,
  isDropTarget = false,
  isProjectReorderMode = false,
  handlers,
  hookHandlers,
  children,
}: ProjectCardRootProps) => {
  const hookState = useCustomProjectCard({
    project,
    handleDeleteUrl: hookHandlers.handleDeleteUrl,
    handleSetUrlCategory: hookHandlers.handleSetUrlCategory,
    handleUpdateCategoryOrder: hookHandlers.handleUpdateCategoryOrder,
    handleReorderUrls: hookHandlers.handleReorderUrls,
  })

  const { urls, dnd, categoryOrder } = hookState

  // プロジェクト全体をドラッグ可能にするためのsortable設定
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({
    id: project.id,
    data: {
      type: 'project',
      projectId: project.id,
      name: project.name,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // このプロジェクトをドロップターゲットとして設定
  const { setNodeRef: setProjectDroppableRef, isOver: isProjectOver } =
    useDroppable({
      id: `project-${project.id}`,
      data: {
        type: 'project',
        projectId: project.id,
      },
    })

  // 未分類URLエリア用のドロップ領域
  const { setNodeRef: setUncategorizedDropRef, isOver: isUncategorizedOver } =
    useDroppable({
      id: `uncategorized-${project.id}`,
      data: {
        type: 'uncategorized',
        projectId: project.id,
        isDropArea: true,
      },
    })

  // 両方のrefを組み合わせる
  const setCombinedRefs = (node: HTMLElement | null) => {
    setNodeRef(node)
    setProjectDroppableRef(node)
  }

  // ドラッグハンドラの登録
  const { registerHandlers, unregisterHandlers } = useDragHandlers()

  useEffect(() => {
    registerHandlers(project.id, {
      handleDragStart: dnd.handleDragStart,
      handleDragOver: dnd.handleDragOver,
      handleCategoryDragEnd: dnd.handleCategoryDragEnd,
      handleUrlDragEnd: dnd.handleUrlDragEnd,
      clearDragState: dnd.resetDnD,
    })
    return () => unregisterHandlers(project.id)
  }, [project.id, registerHandlers, unregisterHandlers, dnd])

  // 別プロジェクトからドラッグされているかを判定
  const isExternalItemOver =
    !isProjectReorderMode && (isProjectOver || isDropTarget)

  const projectUrlCount =
    project.urlIds?.length ?? project.urls?.length ?? urls.projectUrls.length

  const contextValue: ProjectCardContextType = useMemo(
    () => ({
      hookState,
      project,
      settings,
      isUncategorizedOver,
      isExternalItemOver,
      setUncategorizedDropRef,
      categoryOrder,
      handlers,
    }),
    [
      hookState,
      project,
      settings,
      isUncategorizedOver,
      isExternalItemOver,
      setUncategorizedDropRef,
      categoryOrder,
      handlers,
    ],
  )

  return (
    <ProjectCardContext value={contextValue}>
      <Card
        className={`mb-4 w-full overflow-x-hidden ${
          isExternalItemOver
            ? 'border-2 border-primary bg-primary/5 shadow-lg'
            : ''
        }`}
        ref={setCombinedRefs}
        style={style}
      >
        <CardContent className='overflow-x-hidden'>
          <div className='mb-4 flex items-start justify-between gap-3 border-border border-b pb-3'>
            <div className='min-w-0'>
              <h2 className='truncate font-semibold text-base'>
                {project.name}
              </h2>
              {project.description && (
                <p className='truncate text-muted-foreground text-sm'>
                  {project.description}
                </p>
              )}
            </div>
            <button
              {...attributes}
              {...listeners}
              type='button'
              aria-label='プロジェクト順を変更'
              className='mt-0.5 inline-flex cursor-grab items-center rounded border border-transparent p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing'
            >
              <GripVertical size={16} aria-hidden='true' />
            </button>
          </div>

          {/* プロジェクト間ドラッグ中の表示 */}
          {isExternalItemOver && (
            <div className='mb-4 rounded border-2 border-primary border-dashed bg-primary/10 p-4 text-center font-medium'>
              <span className='text-primary'>
                {draggedItem?.title || 'URL'}
              </span>{' '}
              をここにドロップして追加
            </div>
          )}

          {isProjectReorderMode ? (
            <div className='py-3 text-muted-foreground text-sm'>
              並び替え中のためカテゴリを折りたたんでいます（URL{' '}
              {projectUrlCount}
              件）
            </div>
          ) : (
            <>
              {children}

              {/* ローディング状態 */}
              {urls.isLoadingUrls && (
                <div className='py-4 text-center text-muted-foreground'>
                  URLを読み込み中...
                </div>
              )}

              {/* プロジェクトが空の場合 */}
              {urls.projectUrls.length === 0 &&
                !isExternalItemOver &&
                !urls.isLoadingUrls && (
                  <div className='py-4 text-center text-muted-foreground'>
                    このプロジェクトにはURLがありません。
                    <br />
                    拡張機能アイコンからタブを保存するか、右クリックメニューから追加できます。
                    <br />
                    他のプロジェクトからURLをドラッグ&ドロップして追加することもできます。
                  </div>
                )}
            </>
          )}
        </CardContent>
      </Card>
    </ProjectCardContext>
  )
}
