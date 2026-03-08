import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import type { CustomProject, TabGroup, ViewMode } from '@/types/storage'
import { CategoryModal } from './CategoryModal'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from './shared/SavedTabsResponsive'
import { ViewModeToggle } from './ViewModeToggle'

interface HeaderProps {
  tabGroups: TabGroup[]
  filteredTabGroups?: TabGroup[]
  currentMode: ViewMode
  onModeChange: (mode: ViewMode) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onOpenFilter?: () => void
  customProjects: CustomProject[]
  filteredCustomProjects?: CustomProject[]
  onCreateProject: (name: string) => void
  showSidebarTrigger?: boolean
}

export const Header = ({
  tabGroups,
  filteredTabGroups,
  currentMode,
  onModeChange,
  searchQuery,
  onSearchChange,
  customProjects = [],
  filteredCustomProjects,
  onCreateProject = () => {},
  showSidebarTrigger = false,
}: HeaderProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCustomProjectModalOpen, setIsCustomProjectModalOpen] =
    useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const normalizedSearchQuery = searchQuery.trim()
  const groupsForDisplay = filteredTabGroups || tabGroups
  const customGroupsForDisplay = filteredCustomProjects || customProjects
  const domainTabCount = groupsForDisplay.reduce((sum, group) => {
    if (group.urls) {
      return sum + group.urls.length
    }
    if (group.urlIds) {
      return sum + group.urlIds.length
    }
    return sum
  }, 0)

  const customTabCount = customGroupsForDisplay.reduce((sum, project) => {
    if (normalizedSearchQuery.length === 0 && project.urlIds) {
      return sum + project.urlIds.length
    }
    if (project.urls) {
      return sum + project.urls.length
    }
    if (project.urlIds) {
      return sum + project.urlIds.length
    }
    return sum
  }, 0)

  const tabCount = currentMode === 'custom' ? customTabCount : domainTabCount
  const handleCustomProjectEnter = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== 'Enter') {
      return
    }

    const isComposing =
      event.nativeEvent.isComposing ||
      (event as unknown as { isComposing?: boolean }).isComposing ||
      event.keyCode === 229
    if (isComposing) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const name = newProjectName.trim()
    if (!name) {
      toast.error('プロジェクト名を入力してください')
      return
    }

    const exists = customProjects.some(
      project => project.name.toLowerCase() === name.toLowerCase(),
    )
    if (exists) {
      toast.error('同じプロジェクト名は追加できません')
      return
    }

    onCreateProject(name)
    toast.success(`プロジェクト「${name}」を追加しました`)
    setNewProjectName('')
    setIsCustomProjectModalOpen(false)
  }

  return (
    <div className='mb-4 flex items-center gap-4'>
      <div className='flex flex-1 items-center gap-1'>
        {showSidebarTrigger ? (
          <SidebarTrigger className='mr-1 size-9 cursor-pointer' />
        ) : null}
        <div className='relative w-full min-w-24'>
          <Input
            type='text'
            placeholder='検索'
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className='h-9 w-full pr-9'
          />
          {searchQuery && (
            <Button
              type='button'
              variant='ghost'
              onClick={() => onSearchChange('')}
              className='absolute top-1/2 right-0 mr-0.5 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center'
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </div>
      <div className='flex shrink-0 items-center gap-1 whitespace-nowrap'>
        {currentMode === 'domain' && (
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsModalOpen(true)}
                className='flex h-9 cursor-pointer items-center gap-2'
              >
                <Plus size={16} />
                <SavedTabsResponsiveLabel>
                  親カテゴリ管理
                </SavedTabsResponsiveLabel>
              </Button>
            </TooltipTrigger>
            <SavedTabsResponsiveTooltipContent side='top'>
              親カテゴリ管理
            </SavedTabsResponsiveTooltipContent>
          </Tooltip>
        )}
        {currentMode === 'custom' && (
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsCustomProjectModalOpen(true)}
                className='flex h-9 cursor-pointer items-center gap-2'
              >
                <Plus size={16} />
                <SavedTabsResponsiveLabel>
                  プロジェクト追加
                </SavedTabsResponsiveLabel>
              </Button>
            </TooltipTrigger>
            <SavedTabsResponsiveTooltipContent side='top'>
              プロジェクト追加
            </SavedTabsResponsiveTooltipContent>
          </Tooltip>
        )}
        <ViewModeToggle currentMode={currentMode} onChange={onModeChange} />
        <div className='space-x-4 text-muted-foreground text-sm'>
          <p>タブ:{tabCount}</p>
          {currentMode === 'custom' ? (
            <p>プロジェクト:{customGroupsForDisplay.length}</p>
          ) : (
            <p>ドメイン:{groupsForDisplay.length}</p>
          )}
        </div>
      </div>

      {currentMode === 'domain' && isModalOpen && (
        <CategoryModal
          onClose={() => setIsModalOpen(false)}
          tabGroups={tabGroups}
        />
      )}
      {currentMode === 'custom' && isCustomProjectModalOpen && (
        <Dialog
          open={isCustomProjectModalOpen}
          onOpenChange={setIsCustomProjectModalOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいプロジェクトを追加</DialogTitle>
            </DialogHeader>
            <Input
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={handleCustomProjectEnter}
              placeholder='例: 仕事、調査、後で読む'
              className='mb-2 w-full'
              autoFocus={true}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
