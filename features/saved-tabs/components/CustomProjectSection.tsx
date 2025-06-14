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
// DnDのインポートを追加
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useState } from 'react'
import { CustomProjectCard } from './CustomProjectCard'

import type { CustomProjectSectionProps } from '../types/CustomProjectSection.types'

export const CustomProjectSection = ({
  projects,
  handleOpenUrl,
  handleDeleteUrl,
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
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

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

  // ドラッグオーバー中のプロジェクトIDを管理
  const [draggedOverProjectId, setDraggedOverProjectId] = useState<
    string | null
  >(null)

  const handleCreateClick = () => {
    // 入力チェック
    if (!newProjectName.trim()) {
      setNameError('プロジェクト名を入力してください')
      return
    }

    // 既存プロジェクト名との重複チェック
    if (
      projects.some(
        p => p.name.toLowerCase() === newProjectName.trim().toLowerCase(),
      )
    ) {
      setNameError('そのプロジェクト名は既に使用されています')
      return
    }

    handleCreateProject(newProjectName, newProjectDescription)
    setNewProjectName('')
    setNewProjectDescription('')
    setNameError(null)
    setIsCreateDialogOpen(false)
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewProjectName(e.target.value)
    if (e.target.value.trim()) {
      setNameError(null)
    }
  }

  // ドラッグ開始時の処理
  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current) {
      const { url, projectId, title, type } = event.active.data.current as {
        url?: string
        projectId?: string
        title?: string
        type: string
      }

      if (type === 'url' && url && projectId && title) {
        // URLドラッグの場合
        console.log(
          `URLドラッグ開始: ${title} (${url}) from プロジェクト ${projectId}`,
        )
        setDraggedItem({ url, projectId, title })
      } else if (type === 'project' && projectId) {
        // プロジェクトドラッグの場合
        console.log(`プロジェクトドラッグ開始: ${projectId}`)
        const project = projects.find(p => p.id === projectId)
        if (project) {
          setDraggedProject(project)
        }
      }
    }
  }

  // ドラッグオーバー時の処理
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event

    if (over && event.active.data.current?.type === 'url') {
      // URLドラッグ時のオーバー処理
      const projectId = over.data.current?.projectId
      if (projectId && draggedItem && projectId !== draggedItem.projectId) {
        setDraggedOverProjectId(projectId)
        return
      }
    }

    setDraggedOverProjectId(null)
  }

  // ドラッグ終了時の処理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // ドラッグタイプを確認
    const dragType = active.data.current?.type

    if (dragType === 'url') {
      // URLドラッグの場合の処理
      handleUrlDragEnd(event)
    } else if (dragType === 'project' && over && active.id !== over.id) {
      // プロジェクトドラッグの場合の処理
      console.log(
        `プロジェクト順序変更: ${active.id} を ${over.id} の位置に移動`,
      )

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
    setDraggedItem(null)
    setDraggedProject(null)
    setDraggedOverProjectId(null)
  }

  // URLドラッグ終了時の処理を分離
  const handleUrlDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // ドラッグアイテムをリセット
    setDraggedOverProjectId(null)

    // オーバー要素がない、またはアクティブ要素と同じ場合は何もしない
    if (!over) {
      return
    }

    // ドラッグされたURLと、ドロップ先のプロジェクトIDを取得
    const draggedUrl = active.id as string
    const sourceProjectId = active.data.current?.projectId as string

    // ドロップ先のデータを取得
    const targetData = over.data.current
    if (targetData && targetData.type === 'project') {
      const targetProjectId = targetData.projectId as string

      // 同じプロジェクト内なら何もしない
      if (sourceProjectId === targetProjectId) {
        return
      }

      // プロジェクト間のURL移動を実行
      if (handleMoveUrlBetweenProjects) {
        console.log(
          `URL移動の実行: ${sourceProjectId} → ${targetProjectId}, URL: ${draggedUrl}`,
        )
        handleMoveUrlBetweenProjects(
          sourceProjectId,
          targetProjectId,
          draggedUrl,
        )
      }
    }
  }

  return (
    <div>
      {projects.length > 0 ? (
        <DndContext
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
      ) : (
        <div className='flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-md border p-8'>
          <div className='text-2xl text-foreground'>
            プロジェクトがありません
          </div>
          <div className='text-center text-muted-foreground'>
            デフォルトプロジェクトが必要です
            <br />
            タブは拡張機能アイコンまたは右クリックメニューから保存できます
          </div>
          {/* 新規プロジェクト作成ボタンも非表示に
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus size={16} className='mr-1' />
            新規プロジェクト
          </Button>
          */}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規プロジェクト作成</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div>
              <Label htmlFor='name'>プロジェクト名 *</Label>
              <Input
                id='name'
                value={newProjectName}
                onChange={handleNameChange}
                placeholder='プロジェクト名'
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
                value={newProjectDescription}
                onChange={e => setNewProjectDescription(e.target.value)}
                placeholder='プロジェクトの説明'
                className='w-full'
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='ghost'
              onClick={() => {
                setIsCreateDialogOpen(false)
                setNameError(null)
                setNewProjectName('')
                setNewProjectDescription('')
              }}
            >
              キャンセル
            </Button>
            <Button onClick={handleCreateClick}>作成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
