import { Plus, Wrench, X } from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CustomProject, TabGroup, ViewMode } from '@/types/storage'
import { CategoryModal } from './CategoryModal'
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
  onCreateProject: (name: string) => void
}

export const Header = ({
  tabGroups,
  filteredTabGroups,
  currentMode,
  onModeChange,
  searchQuery,
  onSearchChange,
  customProjects = [],
  onCreateProject = () => {},
}: HeaderProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCustomProjectModalOpen, setIsCustomProjectModalOpen] =
    useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const groupsForDisplay = filteredTabGroups || tabGroups
  const tabCount = groupsForDisplay.reduce((sum, group) => {
    if (group.urls) {
      return sum + group.urls.length
    }
    if (group.urlIds) {
      return sum + group.urlIds.length
    }
    return sum
  }, 0)
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
        <h1 className='whitespace-nowrap font-bold text-3xl text-foreground'>
          TABBIN
        </h1>
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
                <span className='hidden lg:inline'>親カテゴリ管理</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              親カテゴリ管理
            </TooltipContent>
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
                <span className='hidden lg:inline'>プロジェクト追加</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              プロジェクト追加
            </TooltipContent>
          </Tooltip>
        )}
        <ViewModeToggle currentMode={currentMode} onChange={onModeChange} />
        <Tooltip>
          <TooltipTrigger asChild={true}>
            <Button
              type='button'
              variant='outline'
              className='flex h-9 cursor-pointer items-center gap-2'
              onClick={() =>
                window.open(chrome.runtime.getURL('options.html'), '_blank')
              }
            >
              <Wrench size={16} />
              <span className='hidden lg:inline'>オプション</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side='top' className='block lg:hidden'>
            オプション
          </TooltipContent>
        </Tooltip>
        <div className='space-x-4 text-muted-foreground text-sm'>
          <p>タブ:{tabCount}</p>
          <p>ドメイン:{groupsForDisplay.length}</p>
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
