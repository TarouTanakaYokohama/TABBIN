import { Edit, Trash, Trash2, X } from 'lucide-react'
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
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
import { useI18n } from '@/features/i18n/context/I18nProvider'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from '@/features/saved-tabs/components/shared/SavedTabsResponsive'
import { CUSTOM_UNCATEGORIZED_PROJECT_ID } from '@/lib/storage/projects'
import type { CustomProject, ProjectKeywordSettings } from '@/types/storage'

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

const createProjectNameSchema = (
  validationMessages: { empty: string; maxLength: string } = {
    empty: 'プロジェクト名を入力してください',
    maxLength: 'プロジェクト名は50文字以下で入力してください',
  },
) =>
  z
    .string()
    .trim()
    .min(1, {
      message: validationMessages.empty,
    })
    .max(50, {
      message: validationMessages.maxLength,
    })

const projectNameSchema = {
  schema: createProjectNameSchema(),
  safeParse(value: string) {
    return this.schema.safeParse(value)
  },
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
}: ProjectKeywordSectionProps) => {
  const { t } = useI18n()

  return (
    <div className='space-y-2'>
      <Label htmlFor={inputId}>{label}</Label>
      <p className='text-muted-foreground text-xs'>{description}</p>
      <Input
        id={inputId}
        aria-label={label}
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
          <p className='text-muted-foreground text-sm'>
            {t('savedTabs.keywords.empty')}
          </p>
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
                aria-label={t('savedTabs.keywords.deleteAria')}
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
}

export const ProjectManagementModal = ({
  isOpen,
  onClose,
  project,
  onRenameProject,
  onUpdateProjectKeywords,
  onDeleteProject,
}: ProjectManagementModalProps) => {
  const { t } = useI18n()
  const localizedProjectNameSchema = useMemo(
    () =>
      createProjectNameSchema({
        empty: t('savedTabs.projectNameRequired'),
        maxLength: t('savedTabs.projectNameMaxLength'),
      }),
    [t],
  )
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
    projectNameSchema.schema = localizedProjectNameSchema
    const result = projectNameSchema.safeParse(name)
    if (!result.success) {
      const issue = result.error.issues[0]
      if (issue?.code === 'too_small') {
        setProjectNameError(t('savedTabs.projectNameRequired'))
      } else if (issue?.code === 'too_big') {
        setProjectNameError(t('savedTabs.projectNameMaxLength'))
      } else {
        setProjectNameError(t('savedTabs.projectNameRequired'))
      }
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
          <DialogTitle>
            {t('savedTabs.projectManagement.title', undefined, {
              name: localProjectName,
            })}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          {/* プロジェクト名変更セクション */}
          <div className='mb-4'>
            <div className='mb-2 flex items-center justify-between'>
              <Label>{t('savedTabs.projectManagement.nameLabel')}</Label>
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
                          {t('savedTabs.projectManagement.renameAction')}
                        </SavedTabsResponsiveLabel>
                      </Button>
                    </TooltipTrigger>
                    <SavedTabsResponsiveTooltipContent side='top'>
                      {t('savedTabs.projectManagement.renameAction')}
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
                          {t('savedTabs.projectManagement.deleteAction')}
                        </SavedTabsResponsiveLabel>
                      </Button>
                    </TooltipTrigger>
                    <SavedTabsResponsiveTooltipContent side='top'>
                      {t('savedTabs.projectManagement.deleteAction')}
                    </SavedTabsResponsiveTooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>

            {isRenaming ? (
              <div className='mt-2 w-full rounded border p-3'>
                <div className='mb-2 text-gray-300 text-sm'>
                  {t('savedTabs.projectManagement.renamePrompt')}
                </div>
                <Input
                  ref={inputRef}
                  value={newProjectName}
                  onChange={handleProjectNameChange}
                  placeholder={t(
                    'savedTabs.projectManagement.renamePlaceholder',
                  )}
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
              <Button
                onClick={() => {
                  if (isUncategorizedProject) {
                    return
                  }
                  handleStartRenaming()
                }}
                className='w-full justify-start rounded border bg-secondary/20 p-2 hover:bg-secondary/30'
                disabled={isUncategorizedProject}
                type='button'
                variant='outline'
              >
                {localProjectName}
              </Button>
            )}
          </div>

          <div className='rounded border p-3'>
            <div className='mb-3 space-y-1'>
              <Label>{t('savedTabs.projectManagement.autoAssignLabel')}</Label>
              <p className='text-muted-foreground text-xs'>
                {t('savedTabs.projectManagement.autoAssignDescription')}
              </p>
            </div>

            <div className='space-y-3'>
              <ProjectKeywordSection
                label={t('savedTabs.projectManagement.keywordTitleLabel')}
                description={t(
                  'savedTabs.projectManagement.keywordTitleDescription',
                )}
                inputId='project-title-keywords'
                placeholder={t(
                  'savedTabs.projectManagement.keywordTitlePlaceholder',
                )}
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
                label={t('savedTabs.projectManagement.keywordUrlLabel')}
                description={t(
                  'savedTabs.projectManagement.keywordUrlDescription',
                )}
                inputId='project-url-keywords'
                placeholder={t(
                  'savedTabs.projectManagement.keywordUrlPlaceholder',
                )}
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
                label={t('savedTabs.projectManagement.keywordDomainLabel')}
                description={t(
                  'savedTabs.projectManagement.keywordDomainDescription',
                )}
                inputId='project-domain-keywords'
                placeholder={t(
                  'savedTabs.projectManagement.keywordDomainPlaceholder',
                )}
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
                {t(
                  'savedTabs.projectManagement.deleteConfirmDescription',
                  undefined,
                  {
                    name: localProjectName,
                  },
                )}
                <span className='mt-1 block max-w-full truncate text-xs'>
                  {t('savedTabs.projectManagement.deleteConfirmHint')}
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
                      {t('common.cancel')}
                    </Button>
                  </TooltipTrigger>
                  <SavedTabsResponsiveTooltipContent side='top'>
                    {t('common.cancel')}
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
                      <SavedTabsResponsiveLabel>
                        {t('common.delete')}
                      </SavedTabsResponsiveLabel>
                    </Button>
                  </TooltipTrigger>
                  <SavedTabsResponsiveTooltipContent side='top'>
                    {t('savedTabs.projectManagement.deleteAction')}
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
