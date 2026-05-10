import { Edit, Trash, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
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
  setKeywords: (keywords: string[]) => void
  clearInput: () => void
}

interface ProjectManagementModalState {
  isRenaming: boolean
  newProjectName: string
  isProcessing: boolean
  isSaving: boolean
  localProjectName: string
  projectNameError: string | null
  showDeleteConfirm: boolean
  titleKeywords: string[]
  urlKeywords: string[]
  domainKeywords: string[]
  newTitleKeyword: string
  newUrlKeyword: string
  newDomainKeyword: string
}

const createProjectManagementModalState = (
  project: CustomProject,
): ProjectManagementModalState => ({
  isRenaming: false,
  newProjectName: project.name,
  isProcessing: false,
  isSaving: false,
  localProjectName: project.name,
  projectNameError: null,
  showDeleteConfirm: false,
  titleKeywords: project.projectKeywords?.titleKeywords || [],
  urlKeywords: project.projectKeywords?.urlKeywords || [],
  domainKeywords: project.projectKeywords?.domainKeywords || [],
  newTitleKeyword: '',
  newUrlKeyword: '',
  newDomainKeyword: '',
})

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
    <div className='gap-y-2'>
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

const useProjectManagementModalView = ({
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
  const [modalState, setModalState] = useState(() =>
    createProjectManagementModalState(project),
  )
  const {
    isRenaming,
    newProjectName,
    isProcessing,
    isSaving,
    localProjectName,
    projectNameError,
    showDeleteConfirm,
    titleKeywords,
    urlKeywords,
    domainKeywords,
    newTitleKeyword,
    newUrlKeyword,
    newDomainKeyword,
  } = modalState
  const updateModalState = (updates: Partial<ProjectManagementModalState>) => {
    setModalState(current => ({ ...current, ...updates }))
  }

  const inputRef = useRef<HTMLInputElement>(null)

  // 入力値バリデーション関数
  const validateProjectName = (name: string) => {
    projectNameSchema.schema = localizedProjectNameSchema
    const result = projectNameSchema.safeParse(name)
    if (!result.success) {
      const issue = result.error.issues[0]
      if (issue?.code === 'too_small') {
        updateModalState({
          projectNameError: t('savedTabs.projectNameRequired'),
        })
      } else if (issue?.code === 'too_big') {
        updateModalState({
          projectNameError: t('savedTabs.projectNameMaxLength'),
        })
      } else {
        updateModalState({
          projectNameError: t('savedTabs.projectNameRequired'),
        })
      }
      return false
    }
    updateModalState({ projectNameError: null })
    return true
  }

  // リネーム処理を開始
  const handleStartRenaming = () => {
    updateModalState({
      isRenaming: true,
      newProjectName: localProjectName,
      projectNameError: null,
    })
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    })
  }

  // リネームをキャンセル
  const handleCancelRenaming = () => {
    updateModalState({
      isRenaming: false,
      newProjectName: localProjectName,
      projectNameError: null,
    })
  }

  // 入力変更時の処理
  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateModalState({ newProjectName: value })
    validateProjectName(value)
  }

  // 名前変更の保存処理
  const handleSaveRenaming = async (trimmedName: string) => {
    updateModalState({ isProcessing: true, isSaving: true })

    try {
      if (!onRenameProject) {
        throw new Error('プロジェクト名変更機能が利用できません')
      }

      await onRenameProject(project.id, trimmedName)

      updateModalState({
        isRenaming: false,
        localProjectName: trimmedName,
      })
    } catch (error) {
      console.error('プロジェクト名の更新に失敗:', error)
      // エラー表示は useProjectManagement 側で行われることが多いため、ここでは最小限に
    } finally {
      updateModalState({ isProcessing: false, isSaving: false })
    }
  }

  // プロジェクト削除処理
  const handleDeleteProject = async () => {
    if (isProcessing) {
      return
    }

    updateModalState({ isProcessing: true })
    try {
      if (!onDeleteProject) {
        throw new Error('プロジェクト削除機能が利用できません')
      }

      await onDeleteProject(project.id)
      onClose()
    } catch (error) {
      console.error('プロジェクトの削除に失敗しました:', error)
    } finally {
      updateModalState({ isProcessing: false })
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
    setKeywords: (keywords: string[]) => void,
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

        <div className='gap-y-4'>
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
                        onClick={() =>
                          updateModalState({ showDeleteConfirm: true })
                        }
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
                <div className='mb-2 text-sm text-zinc-300'>
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
            <div className='mb-3 gap-y-1'>
              <Label>{t('savedTabs.projectManagement.autoAssignLabel')}</Label>
              <p className='text-muted-foreground text-xs'>
                {t('savedTabs.projectManagement.autoAssignDescription')}
              </p>
            </div>

            <div className='gap-y-3'>
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
                onKeywordChange={value =>
                  updateModalState({ newTitleKeyword: value })
                }
                onAddKeyword={() =>
                  addKeyword({
                    keyword: newTitleKeyword,
                    keywords: titleKeywords,
                    section: 'titleKeywords',
                    setKeywords: keywords =>
                      updateModalState({ titleKeywords: keywords }),
                    clearInput: () => updateModalState({ newTitleKeyword: '' }),
                  })
                }
                onBlurKeyword={() =>
                  addKeyword({
                    keyword: newTitleKeyword,
                    keywords: titleKeywords,
                    section: 'titleKeywords',
                    setKeywords: keywords =>
                      updateModalState({ titleKeywords: keywords }),
                    clearInput: () => updateModalState({ newTitleKeyword: '' }),
                  })
                }
                onRemoveKeyword={keyword =>
                  removeKeyword(
                    keyword,
                    'titleKeywords',
                    keywords => updateModalState({ titleKeywords: keywords }),
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
                onKeywordChange={value =>
                  updateModalState({ newUrlKeyword: value })
                }
                onAddKeyword={() =>
                  addKeyword({
                    keyword: newUrlKeyword,
                    keywords: urlKeywords,
                    section: 'urlKeywords',
                    setKeywords: keywords =>
                      updateModalState({ urlKeywords: keywords }),
                    clearInput: () => updateModalState({ newUrlKeyword: '' }),
                  })
                }
                onBlurKeyword={() =>
                  addKeyword({
                    keyword: newUrlKeyword,
                    keywords: urlKeywords,
                    section: 'urlKeywords',
                    setKeywords: keywords =>
                      updateModalState({ urlKeywords: keywords }),
                    clearInput: () => updateModalState({ newUrlKeyword: '' }),
                  })
                }
                onRemoveKeyword={keyword =>
                  removeKeyword(
                    keyword,
                    'urlKeywords',
                    keywords => updateModalState({ urlKeywords: keywords }),
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
                onKeywordChange={value =>
                  updateModalState({ newDomainKeyword: value })
                }
                onAddKeyword={() =>
                  addKeyword({
                    keyword: newDomainKeyword,
                    keywords: domainKeywords,
                    section: 'domainKeywords',
                    setKeywords: keywords =>
                      updateModalState({ domainKeywords: keywords }),
                    clearInput: () =>
                      updateModalState({ newDomainKeyword: '' }),
                  })
                }
                onBlurKeyword={() =>
                  addKeyword({
                    keyword: newDomainKeyword,
                    keywords: domainKeywords,
                    section: 'domainKeywords',
                    setKeywords: keywords =>
                      updateModalState({ domainKeywords: keywords }),
                    clearInput: () =>
                      updateModalState({ newDomainKeyword: '' }),
                  })
                }
                onRemoveKeyword={keyword =>
                  removeKeyword(
                    keyword,
                    'domainKeywords',
                    keywords => updateModalState({ domainKeywords: keywords }),
                    domainKeywords,
                  )
                }
              />
            </div>
          </div>

          {showDeleteConfirm && (
            <div className='mt-1 mb-3 rounded border p-3'>
              <p className='mb-2 text-zinc-700 dark:text-zinc-300'>
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
                      onClick={() =>
                        updateModalState({ showDeleteConfirm: false })
                      }
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

const ProjectManagementModalContent = (props: ProjectManagementModalProps) =>
  useProjectManagementModalView(props)

export const ProjectManagementModal = (props: ProjectManagementModalProps) => {
  if (!props.isOpen) {
    return null
  }

  return (
    <ProjectManagementModalContent
      key={`${props.project.id}:${props.project.name}`}
      {...props}
    />
  )
}

export { projectNameSchema }
