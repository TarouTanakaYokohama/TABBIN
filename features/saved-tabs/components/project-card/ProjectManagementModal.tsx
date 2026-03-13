import { Edit, Trash, Trash2, X } from 'lucide-react'
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
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
import { CUSTOM_UNCATEGORIZED_PROJECT_ID } from '@/lib/storage/projects'
import type { CustomProject, ProjectKeywordSettings } from '@/types/storage'

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
  onUpdateProjectKeywords?: (
    projectId: string,
    projectKeywords: ProjectKeywordSettings,
  ) => Promise<void> | void
  onDeleteProject?: (projectId: string) => Promise<void> | void
}

const normalizeKeyword = (value: string): string => value.trim()

interface ProjectKeywordSectionProps {
  label: string
  description: string
  inputId: string
  placeholder: string
  keywords: string[]
  newKeyword: string
  disabled: boolean
  onKeywordChange: (value: string) => void
  onAddKeyword: () => void
  onBlurKeyword: () => void
  onRemoveKeyword: (keyword: string) => void
}

interface KeywordUpdateParams {
  keyword: string
  keywords: string[]
  section: keyof ProjectKeywordSettings
  setKeywords: Dispatch<SetStateAction<string[]>>
  clearInput: () => void
}

const ProjectKeywordSection = ({
  label,
  description,
  inputId,
  placeholder,
  keywords,
  newKeyword,
  disabled,
  onKeywordChange,
  onAddKeyword,
  onBlurKeyword,
  onRemoveKeyword,
}: ProjectKeywordSectionProps) => (
  <div className='space-y-2'>
    <Label htmlFor={inputId}>{label}</Label>
    <p className='text-muted-foreground text-xs'>{description}</p>
    <Input
      id={inputId}
      aria-label={`${label}入力`}
      value={newKeyword}
      onChange={e => onKeywordChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onAddKeyword()
        }
      }}
      onBlur={() => {
        if (newKeyword.trim()) {
          onBlurKeyword()
        }
      }}
    />

    <div className='flex min-h-12 flex-wrap gap-2 rounded border p-2'>
      {keywords.length === 0 ? (
        <p className='text-muted-foreground text-sm'>キーワードがありません</p>
      ) : (
        keywords.map(keyword => (
          <Badge
            key={keyword}
            variant='outline'
            className='flex items-center gap-1 rounded px-2 py-1'
          >
            {keyword}
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => onRemoveKeyword(keyword)}
              className='h-5 px-1'
              aria-label='キーワードを削除'
              disabled={disabled}
            >
              <X size={14} />
            </Button>
          </Badge>
        ))
      )}
    </div>
  </div>
)

export const ProjectManagementModal = ({
  isOpen,
  onClose,
  project,
  onRenameProject,
  onUpdateProjectKeywords,
  onDeleteProject,
}: ProjectManagementModalProps) => {
  const isUncategorizedProject = project.id === CUSTOM_UNCATEGORIZED_PROJECT_ID
  const [isRenaming, setIsRenaming] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [localProjectName, setLocalProjectName] = useState('')
  const [projectNameError, setProjectNameError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [titleKeywords, setTitleKeywords] = useState<string[]>([])
  const [urlKeywords, setUrlKeywords] = useState<string[]>([])
  const [domainKeywords, setDomainKeywords] = useState<string[]>([])
  const [newTitleKeyword, setNewTitleKeyword] = useState('')
  const [newUrlKeyword, setNewUrlKeyword] = useState('')
  const [newDomainKeyword, setNewDomainKeyword] = useState('')

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
      setTitleKeywords(project.projectKeywords?.titleKeywords || [])
      setUrlKeywords(project.projectKeywords?.urlKeywords || [])
      setDomainKeywords(project.projectKeywords?.domainKeywords || [])
      setNewTitleKeyword('')
      setNewUrlKeyword('')
      setNewDomainKeyword('')
    }
  }, [isOpen, project.name, project.projectKeywords])

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

  const handleSaveProjectKeywords = async (
    nextProjectKeywords: ProjectKeywordSettings = {
      titleKeywords,
      urlKeywords,
      domainKeywords,
    },
  ) => {
    try {
      if (!onUpdateProjectKeywords) {
        throw new Error('プロジェクトキーワード更新機能が利用できません')
      }

      await onUpdateProjectKeywords(project.id, {
        titleKeywords: nextProjectKeywords.titleKeywords,
        urlKeywords: nextProjectKeywords.urlKeywords,
        domainKeywords: nextProjectKeywords.domainKeywords,
      })
    } catch (error) {
      console.error('プロジェクトキーワードの更新に失敗:', error)
    }
  }

  const addKeyword = ({
    keyword,
    keywords,
    section,
    setKeywords,
    clearInput,
  }: KeywordUpdateParams) => {
    const normalizedKeyword = normalizeKeyword(keyword)
    if (!normalizedKeyword) {
      return
    }
    const isDuplicate = keywords.some(
      currentKeyword =>
        currentKeyword.toLowerCase() === normalizedKeyword.toLowerCase(),
    )
    if (isDuplicate) {
      clearInput()
      return
    }
    const updatedKeywords = [...keywords, normalizedKeyword]
    setKeywords(updatedKeywords)
    clearInput()
    void handleSaveProjectKeywords({
      titleKeywords:
        section === 'titleKeywords' ? updatedKeywords : titleKeywords,
      urlKeywords: section === 'urlKeywords' ? updatedKeywords : urlKeywords,
      domainKeywords:
        section === 'domainKeywords' ? updatedKeywords : domainKeywords,
    })
  }

  const removeKeyword = (
    keywordToRemove: string,
    section: keyof ProjectKeywordSettings,
    setKeywords: Dispatch<SetStateAction<string[]>>,
    keywords: string[],
  ) => {
    const updatedKeywords = keywords.filter(
      keyword => keyword !== keywordToRemove,
    )
    setKeywords(updatedKeywords)
    void handleSaveProjectKeywords({
      titleKeywords:
        section === 'titleKeywords' ? updatedKeywords : titleKeywords,
      urlKeywords: section === 'urlKeywords' ? updatedKeywords : urlKeywords,
      domainKeywords:
        section === 'domainKeywords' ? updatedKeywords : domainKeywords,
    })
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
              {!isRenaming && !isUncategorizedProject && (
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
                onClick={() => {
                  if (isUncategorizedProject) {
                    return
                  }
                  handleStartRenaming()
                }}
                className='flex w-full cursor-pointer justify-start rounded border bg-secondary/20 p-2'
                disabled={isUncategorizedProject}
              >
                {localProjectName}
              </button>
            )}
          </div>

          <div className='rounded border p-3'>
            <div className='mb-3 space-y-1'>
              <Label>自動振り分けキーワード</Label>
              <p className='text-muted-foreground text-xs'>
                新規保存されたタブだけが対象です。複数キーワードはカンマ区切りで入力します。
              </p>
            </div>

            <div className='space-y-3'>
              <ProjectKeywordSection
                label='タイトルキーワード'
                description='タイトルにキーワードが含まれていると、このプロジェクトに振り分けます'
                inputId='project-title-keywords'
                placeholder='例: release'
                keywords={titleKeywords}
                newKeyword={newTitleKeyword}
                disabled={isProcessing}
                onKeywordChange={setNewTitleKeyword}
                onAddKeyword={() =>
                  addKeyword({
                    keyword: newTitleKeyword,
                    keywords: titleKeywords,
                    section: 'titleKeywords',
                    setKeywords: setTitleKeywords,
                    clearInput: () => setNewTitleKeyword(''),
                  })
                }
                onBlurKeyword={() =>
                  addKeyword({
                    keyword: newTitleKeyword,
                    keywords: titleKeywords,
                    section: 'titleKeywords',
                    setKeywords: setTitleKeywords,
                    clearInput: () => setNewTitleKeyword(''),
                  })
                }
                onRemoveKeyword={keyword =>
                  removeKeyword(
                    keyword,
                    'titleKeywords',
                    setTitleKeywords,
                    titleKeywords,
                  )
                }
              />

              <ProjectKeywordSection
                label='URLキーワード'
                description='URL にキーワードが含まれていると、このプロジェクトに振り分けます'
                inputId='project-url-keywords'
                placeholder='例: docs'
                keywords={urlKeywords}
                newKeyword={newUrlKeyword}
                disabled={isProcessing}
                onKeywordChange={setNewUrlKeyword}
                onAddKeyword={() =>
                  addKeyword({
                    keyword: newUrlKeyword,
                    keywords: urlKeywords,
                    section: 'urlKeywords',
                    setKeywords: setUrlKeywords,
                    clearInput: () => setNewUrlKeyword(''),
                  })
                }
                onBlurKeyword={() =>
                  addKeyword({
                    keyword: newUrlKeyword,
                    keywords: urlKeywords,
                    section: 'urlKeywords',
                    setKeywords: setUrlKeywords,
                    clearInput: () => setNewUrlKeyword(''),
                  })
                }
                onRemoveKeyword={keyword =>
                  removeKeyword(
                    keyword,
                    'urlKeywords',
                    setUrlKeywords,
                    urlKeywords,
                  )
                }
              />

              <ProjectKeywordSection
                label='ドメインキーワード'
                description='ドメインにキーワードが含まれていると、このプロジェクトに振り分けます'
                inputId='project-domain-keywords'
                placeholder='例: github.com'
                keywords={domainKeywords}
                newKeyword={newDomainKeyword}
                disabled={isProcessing}
                onKeywordChange={setNewDomainKeyword}
                onAddKeyword={() =>
                  addKeyword({
                    keyword: newDomainKeyword,
                    keywords: domainKeywords,
                    section: 'domainKeywords',
                    setKeywords: setDomainKeywords,
                    clearInput: () => setNewDomainKeyword(''),
                  })
                }
                onBlurKeyword={() =>
                  addKeyword({
                    keyword: newDomainKeyword,
                    keywords: domainKeywords,
                    section: 'domainKeywords',
                    setKeywords: setDomainKeywords,
                    clearInput: () => setNewDomainKeyword(''),
                  })
                }
                onRemoveKeyword={keyword =>
                  removeKeyword(
                    keyword,
                    'domainKeywords',
                    setDomainKeywords,
                    domainKeywords,
                  )
                }
              />
            </div>
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
