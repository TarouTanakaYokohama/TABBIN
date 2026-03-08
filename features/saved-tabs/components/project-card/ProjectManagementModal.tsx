import { Edit, Trash, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from '@/features/saved-tabs/components/shared/SavedTabsResponsive'
import type { CustomProject } from '@/types/storage'

// プロジェクト名のバリデーションスキーマ
const projectNameSchema = z
  .string()
  .trim()
  .min(1, {
    message: 'プロジェクト名を入力してください',
  })
  .max(50, {
    message: 'プロジェクト名は50文字以下にしてください',
  })

interface ProjectManagementModalProps {
  isOpen: boolean
  onClose: () => void
  project: CustomProject
  onRenameProject?: (projectId: string, newName: string) => Promise<void> | void
  onDeleteProject?: (projectId: string) => Promise<void> | void
}

export const ProjectManagementModal = ({
  isOpen,
  onClose,
  project,
  onRenameProject,
  onDeleteProject,
}: ProjectManagementModalProps) => {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [localProjectName, setLocalProjectName] = useState('')
  const [projectNameError, setProjectNameError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // モーダルが開いたときの初期化
  useEffect(() => {
    if (isOpen) {
      setNewProjectName(project.name)
      setLocalProjectName(project.name)
      setIsRenaming(false)
      setIsProcessing(false)
      setProjectNameError(null)
      setShowDeleteConfirm(false)
    }
  }, [isOpen, project.name])

  // 入力値バリデーション関数
  const validateProjectName = (name: string) => {
    const result = projectNameSchema.safeParse(name)
    if (!result.success) {
      const [
        { message } = {
          message: 'プロジェクト名が無効です',
        },
      ] = result.error.issues
      setProjectNameError(message)
      return false
    }
    setProjectNameError(null)
    return true
  }

  // リネーム処理を開始
  const handleStartRenaming = () => {
    setNewProjectName(localProjectName)
    setIsRenaming(true)
    setProjectNameError(null)
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    })
  }

  // リネームをキャンセル
  const handleCancelRenaming = () => {
    setIsRenaming(false)
    setNewProjectName(localProjectName)
    setProjectNameError(null)
  }

  // 入力変更時の処理
  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNewProjectName(value)
    validateProjectName(value)
  }

  // 名前変更の保存処理
  const handleSaveRenaming = async (trimmedName: string) => {
    setIsProcessing(true)
    setIsSaving(true)

    try {
      if (!onRenameProject) {
        throw new Error('プロジェクト名変更機能が利用できません')
      }

      await onRenameProject(project.id, trimmedName)

      setLocalProjectName(trimmedName)
      setIsRenaming(false)
    } catch (error) {
      console.error('プロジェクト名の更新に失敗:', error)
      // エラー表示は useProjectManagement 側で行われることが多いため、ここでは最小限に
    } finally {
      setIsSaving(false)
      setIsProcessing(false)
    }
  }

  // プロジェクト削除処理
  const handleDeleteProject = async () => {
    if (isProcessing) {
      return
    }

    setIsProcessing(true)
    try {
      if (!onDeleteProject) {
        throw new Error('プロジェクト削除機能が利用できません')
      }

      await onDeleteProject(project.id)
      onClose()
    } catch (error) {
      console.error('プロジェクトの削除に失敗しました:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        if (isProcessing || isRenaming || isSaving) {
          return
        }
        if (document.readyState === 'loading') {
          return
        }
        onClose()
      }}
    >
      <DialogContent className='max-h-[90vh] overflow-y-auto'>
        <DialogHeader className='text-left'>
          <DialogTitle>「{localProjectName}」の設定</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          {/* プロジェクト名変更セクション */}
          <div className='mb-4'>
            <div className='mb-2 flex items-center justify-between'>
              <Label>プロジェクト名</Label>
              {!isRenaming && (
                <div className='flex items-center gap-2'>
                  <Tooltip>
                    <TooltipTrigger asChild={true}>
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={handleStartRenaming}
                        className='flex cursor-pointer items-center gap-2 rounded px-2 py-1'
                      >
                        <Edit size={14} />
                        <SavedTabsResponsiveLabel>
                          名前を変更
                        </SavedTabsResponsiveLabel>
                      </Button>
                    </TooltipTrigger>
                    <SavedTabsResponsiveTooltipContent side='top'>
                      名前を変更
                    </SavedTabsResponsiveTooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild={true}>
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={() => setShowDeleteConfirm(true)}
                        className='flex cursor-pointer items-center gap-2 rounded px-2 py-1'
                        disabled={isProcessing}
                      >
                        <Trash2 size={14} />
                        <SavedTabsResponsiveLabel>
                          プロジェクトを削除
                        </SavedTabsResponsiveLabel>
                      </Button>
                    </TooltipTrigger>
                    <SavedTabsResponsiveTooltipContent side='top'>
                      プロジェクトを削除
                    </SavedTabsResponsiveTooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>

            {isRenaming ? (
              <div className='mt-2 w-full rounded border p-3'>
                <div className='mb-2 text-gray-300 text-sm'>
                  新しいプロジェクト名を入力してください
                </div>
                <Input
                  ref={inputRef}
                  value={newProjectName}
                  onChange={handleProjectNameChange}
                  placeholder='例: ウェブサイトリニューアル'
                  className={`w-full flex-1 rounded border p-2 ${projectNameError ? 'border-red-500' : ''}`}
                  autoFocus={true}
                  onBlur={() => {
                    if (isProcessing) {
                      return
                    }
                    const trimmedName = newProjectName.trim()
                    if (
                      trimmedName &&
                      trimmedName !== localProjectName &&
                      !projectNameError
                    ) {
                      handleSaveRenaming(trimmedName)
                    } else if (projectNameError) {
                      inputRef.current?.focus()
                    } else {
                      handleCancelRenaming()
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const trimmedName = newProjectName.trim()
                      if (
                        trimmedName &&
                        trimmedName !== localProjectName &&
                        !projectNameError &&
                        !isProcessing
                      ) {
                        handleSaveRenaming(trimmedName)
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      handleCancelRenaming()
                    }
                  }}
                />
                {projectNameError && (
                  <p className='mt-1 text-red-500 text-xs'>
                    {projectNameError}
                  </p>
                )}
              </div>
            ) : (
              <button
                type='button'
                onClick={handleStartRenaming}
                className='flex w-full cursor-pointer justify-start rounded border bg-secondary/20 p-2'
              >
                {localProjectName}
              </button>
            )}
          </div>

          {showDeleteConfirm && (
            <div className='mt-1 mb-3 rounded border p-3'>
              <p className='mb-2 text-gray-700 dark:text-gray-300'>
                プロジェクト「{localProjectName}
                」を削除しますか？この操作は取り消せません。
                <span className='mt-1 block max-w-full truncate text-xs'>
                  このプロジェクトに含まれるすべてのタブとの紐付けも解除されます。
                </span>
              </p>
              <div className='flex justify-end gap-2'>
                <Tooltip>
                  <TooltipTrigger asChild={true}>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isProcessing}
                    >
                      キャンセル
                    </Button>
                  </TooltipTrigger>
                  <SavedTabsResponsiveTooltipContent side='top'>
                    キャンセル
                  </SavedTabsResponsiveTooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild={true}>
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={handleDeleteProject}
                      disabled={isProcessing}
                    >
                      <Trash size={14} />
                      <SavedTabsResponsiveLabel>削除</SavedTabsResponsiveLabel>
                    </Button>
                  </TooltipTrigger>
                  <SavedTabsResponsiveTooltipContent side='top'>
                    プロジェクトを削除
                  </SavedTabsResponsiveTooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { projectNameSchema }
