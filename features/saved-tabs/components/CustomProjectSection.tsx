import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
// DnDのインポートを追加
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CustomProject } from '@/types/storage'
import {
  DragHandlersContext,
  type ProjectDragHandlers,
} from '../contexts/DragHandlersContext'
import type { CustomProjectSectionProps } from '../types/CustomProjectSection.types'
import { CustomProjectCard } from './CustomProjectCard'

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'プロジェクト名を入力してください'),
  description: z.string(),
})

type CreateProjectFormValues = z.infer<typeof createProjectSchema>

const resolveTargetProjectId = (over: DragEndEvent['over']): string | null => {
  const overProjectId = over?.data.current?.projectId
  if (typeof overProjectId === 'string' && overProjectId.length > 0) {
    return overProjectId
  }

  if (typeof over?.id !== 'string') {
    return null
  }

  if (over.id.startsWith('project-')) {
    return over.id.slice('project-'.length)
  }
  if (over.id.startsWith('uncategorized-')) {
    return over.id.slice('uncategorized-'.length)
  }
  return null
}

export const CustomProjectSection = ({
  projects,
  handleOpenUrl,
  handleDeleteUrl,
  handleDeleteUrlsFromProject,
  handleAddUrl,
  handleCreateProject,
  handleDeleteProject,
  handleRenameProject,
  handleAddCategory,
  handleDeleteCategory,
  handleRenameCategory, // 追加: カテゴリ名変更ハンドラ
  handleSetUrlCategory,
  handleUpdateCategoryOrder,
  handleReorderUrls,
  handleReorderProjects, // 追加: プロジェクト順序の更新ハンドラ
  handleOpenAllUrls,
  handleMoveUrlBetweenProjects, // 新しいプロパティを受け取る
  handleMoveUrlsBetweenCategories, // カテゴリ間移動
  settings,
}: CustomProjectSectionProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
    },
    reValidateMode: 'onChange',
  })
  const nameError = errors.name?.message ?? null

  // ドラッグ中のアイテムの状態
  const [draggedItem, setDraggedItem] = useState<{
    url: string
    projectId: string
    title: string
  } | null>(null)

  // ドラッグ中のプロジェクトの状態を追加
  const [draggedProject, setDraggedProject] = useState<CustomProject | null>(
    null,
  )
  const [isProjectReorderMode, setIsProjectReorderMode] = useState(false)

  // ドラッグオーバー中のプロジェクトIDを管理
  const [draggedOverProjectId, setDraggedOverProjectId] = useState<
    string | null
  >(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const projectDragHandlersRef = useRef<Record<string, ProjectDragHandlers>>({})

  const dragHandlersContextValue = useMemo(
    () => ({
      registerHandlers: (projectId: string, handlers: ProjectDragHandlers) => {
        projectDragHandlersRef.current[projectId] = handlers
      },
      unregisterHandlers: (projectId: string) => {
        const newHandlers = { ...projectDragHandlersRef.current }
        delete newHandlers[projectId]
        projectDragHandlersRef.current = newHandlers
      },
    }),
    [],
  )

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false)
    reset()
  }

  const handleCreateDialogChange = (open: boolean) => {
    setIsCreateDialogOpen(open)
    if (!open) {
      reset()
    }
  }

  const handleCreateProjectSubmit = ({
    name,
    description,
  }: CreateProjectFormValues) => {
    const trimmedName = name.trim()

    if (
      projects.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      setError('name', {
        type: 'manual',
        message: 'そのプロジェクト名は既に使用されています',
      })
      return
    }

    handleCreateProject(trimmedName, description)
    closeCreateDialog()
  }

  const nameField = register('name', {
    onChange: () => {
      clearErrors('name')
    },
  })
  const descriptionField = register('description')

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    void handleSubmit(handleCreateProjectSubmit)()
  }

  const handleCreateButtonClick = () => {
    void handleSubmit(handleCreateProjectSubmit)()
  }

  // ドラッグ開始時の処理
  const handleDragStart = (event: DragStartEvent) => {
    if (!event.active.data.current) {
      return
    }

    const { projectId, type } = event.active.data.current as {
      projectId?: string
      type: string
    }

    if (!projectId) {
      return
    }

    if (type === 'url') {
      // URLドラッグではセクション全体の状態更新を最小化する
      setIsProjectReorderMode(false)
      setDraggedProject(null)
    } else if (type === 'project') {
      // プロジェクトドラッグの場合
      const project = projects.find(p => p.id === projectId)
      if (project) {
        setIsProjectReorderMode(true)
        setDraggedProject(project)
      }
    }

    // プロジェクトへ伝播
    const handler = projectDragHandlersRef.current[projectId]
    if (handler) {
      handler.handleDragStart(event)
    }
  }

  // ドラッグオーバー時の処理
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    const activeData = active.data.current

    if (over && activeData?.type === 'url') {
      // URLドラッグ時のオーバー処理
      const sourceProjectId = activeData.projectId as string | undefined
      const projectId = over.data.current?.projectId
      if (projectId && sourceProjectId && projectId !== sourceProjectId) {
        setDraggedOverProjectId(prev => (prev === projectId ? prev : projectId))
      } else {
        setDraggedOverProjectId(prev => (prev === null ? prev : null))
      }
    } else {
      setDraggedOverProjectId(prev => (prev === null ? prev : null))
    }

    // 全てのプロジェクトへ伝播させる (hoverが外れたことを伝えるため)
    Object.entries(projectDragHandlersRef.current).forEach(([id, handlers]) => {
      const project = projects.find(p => p.id === id)
      if (project) {
        handlers.handleDragOver(event, project)
      }
    })
  }

  // ドラッグ終了時の処理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const dragType = active.data.current?.type

    if (dragType === 'url') {
      handleUrlDragSequence(event)
    } else if (dragType === 'category') {
      const sourceProjectId = active.data.current?.projectId as string
      if (sourceProjectId && projectDragHandlersRef.current[sourceProjectId]) {
        projectDragHandlersRef.current[sourceProjectId].handleCategoryDragEnd(
          event,
        )
      }
    } else if (dragType === 'project' && over && active.id !== over.id) {
      // プロジェクトドラッグの場合の処理
      // プロジェクトの順序を変更
      const oldIndex = projects.findIndex(p => p.id === active.id)
      const newIndex = projects.findIndex(p => p.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1 && handleReorderProjects) {
        const newOrder = arrayMove(
          projects.map(p => p.id),
          oldIndex,
          newIndex,
        )
        handleReorderProjects(newOrder)
      }
    }

    // すべてのドラッグ状態をリセット
    setIsProjectReorderMode(false)
    setDraggedItem(null)
    setDraggedProject(null)
    setDraggedOverProjectId(null)
  }

  // URLドラッグに関わるシーケンス制御
  const handleUrlDragSequence = (event: DragEndEvent) => {
    const { active, over } = event
    const sourceProjectId = active.data.current?.projectId as string
    const targetProjectId = resolveTargetProjectId(over)

    if (
      !targetProjectId ||
      (sourceProjectId && sourceProjectId === targetProjectId)
    ) {
      // 同一プロジェクト内または無効なドロップエリア
      if (sourceProjectId && projectDragHandlersRef.current[sourceProjectId]) {
        const isUncategorizedOver =
          over?.id === `uncategorized-${targetProjectId}` ||
          over?.data?.current?.type === 'uncategorized'
        projectDragHandlersRef.current[sourceProjectId].handleUrlDragEnd(
          event,
          isUncategorizedOver,
        )
      }
    } else {
      // クロスプロジェクトドロップ
      handleUrlCrossProjectDragEnd(event, targetProjectId, sourceProjectId)

      // 元プロジェクトの状態リセット
      if (sourceProjectId && projectDragHandlersRef.current[sourceProjectId]) {
        projectDragHandlersRef.current[sourceProjectId].clearDragState()
      }
    }
  }

  // プロジェクト間のURL移動
  const handleUrlCrossProjectDragEnd = (
    event: DragEndEvent,
    targetProjectId: string,
    sourceProjectId: string,
  ) => {
    const { active } = event
    const draggedUrl = active.id as string

    if (handleMoveUrlBetweenProjects) {
      handleMoveUrlBetweenProjects(sourceProjectId, targetProjectId, draggedUrl)
    }
  }

  return (
    <div>
      {projects.length > 0 ? (
        <DragHandlersContext.Provider value={dragHandlersContextValue}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={projects.map(project => project.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className='grid gap-4'>
                {projects.map(project => (
                  <CustomProjectCard
                    key={project.id}
                    project={project}
                    handleOpenUrl={handleOpenUrl}
                    handleDeleteUrl={handleDeleteUrl}
                    handleDeleteUrlsFromProject={handleDeleteUrlsFromProject}
                    handleAddUrl={handleAddUrl}
                    handleDeleteProject={handleDeleteProject}
                    handleRenameProject={handleRenameProject}
                    handleAddCategory={handleAddCategory}
                    handleDeleteCategory={handleDeleteCategory}
                    handleRenameCategory={handleRenameCategory} // 追加: カテゴリ名変更ハンドラ
                    handleSetUrlCategory={handleSetUrlCategory}
                    handleUpdateCategoryOrder={handleUpdateCategoryOrder}
                    handleReorderUrls={handleReorderUrls}
                    handleOpenAllUrls={handleOpenAllUrls}
                    settings={settings}
                    // ドラッグ中のアイテム情報を渡す
                    draggedItem={draggedItem}
                    // ドラッグオーバー中のプロジェクトIDを渡す
                    isDropTarget={draggedOverProjectId === project.id}
                    isProjectReorderMode={isProjectReorderMode}
                    handleMoveUrlsBetweenCategories={
                      handleMoveUrlsBetweenCategories
                    }
                    handleMoveUrlBetweenProjects={handleMoveUrlBetweenProjects} // 追加: プロジェクト間URL移動を渡す
                  />
                ))}
              </div>
            </SortableContext>

            {/* ドラッグ中の要素のオーバーレイ */}
            <DragOverlay>
              {draggedItem && (
                <div className='max-w-[300px] truncate rounded-md border bg-background p-2 shadow-md'>
                  {draggedItem.title || draggedItem.url}
                </div>
              )}
              {draggedProject && (
                <div className='w-full max-w-[600px] rounded-md border bg-background p-4 shadow-lg'>
                  <div className='font-bold text-lg'>{draggedProject.name}</div>
                  <div className='text-muted-foreground text-sm'>
                    {draggedProject.description}
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </DragHandlersContext.Provider>
      ) : (
        <div className='flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-md border p-8'>
          <div className='text-2xl text-foreground'>
            プロジェクトがありません
          </div>
          <div className='text-center text-muted-foreground'>
            表示可能なプロジェクトがありません
            <br />
            親カテゴリを作成するとプロジェクトとして表示されます
          </div>
          {/* 新規プロジェクト作成ボタンも非表示に
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus size={16} className='mr-1' />
            新規プロジェクト
          </Button>
          */}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規プロジェクト作成</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreateProjectSubmit)}>
            <div className='grid gap-4 py-4'>
              <div>
                <Label htmlFor='name'>プロジェクト名 *</Label>
                <Input
                  id='name'
                  {...nameField}
                  onKeyDown={handleNameKeyDown}
                  placeholder='例: ウェブサイトリニューアル、ライブラリ調査'
                  className={`w-full ${nameError ? 'border-red-500' : ''}`}
                />
                {nameError && (
                  <p className='mt-1 text-red-500 text-xs'>{nameError}</p>
                )}
              </div>
              <div>
                <Label htmlFor='description'>説明（オプション）</Label>
                <Textarea
                  id='description'
                  {...descriptionField}
                  placeholder='例: ユーザーエクスペリエンスの改善とパフォーマンス最適化'
                  className='w-full'
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant='ghost' type='button' onClick={closeCreateDialog}>
                キャンセル
              </Button>
              <Button type='button' onClick={handleCreateButtonClick}>
                作成
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
