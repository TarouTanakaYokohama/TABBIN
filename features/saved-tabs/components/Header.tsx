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
import { Plus, Wrench } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CategoryModal } from './CategoryModal'
import { ViewModeToggle } from './ViewModeToggle'

type HeaderProps = {
  tabGroups: TabGroup[]
  currentMode: ViewMode
  onModeChange: (mode: ViewMode) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onOpenFilter?: () => void
  customProjects: CustomProject[]
  onAddCategory: (projectId: string, categoryName: string) => void
}

export const Header = ({
  tabGroups,
  currentMode,
  onModeChange,
  searchQuery,
  onSearchChange,
  customProjects = [],
  onAddCategory = () => {},
}: HeaderProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCustomCategoryModalOpen, setIsCustomCategoryModalOpen] =
    useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  return (
    <div className='mb-4 flex items-center gap-4'>
      <div className='flex flex-1 items-center gap-4'>
        <h1 className='whitespace-nowrap font-bold text-3xl text-foreground'>
          TABBIN
        </h1>
        <Input
          type='text'
          placeholder='検索'
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className='h-9 w-full'
        />
      </div>
      <div className='flex flex-shrink-0 items-center gap-1 whitespace-nowrap'>
        {currentMode === 'domain' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsModalOpen(true)}
                className='flex h-9 cursor-pointer items-center gap-2'
                title='親カテゴリ管理'
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
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsCustomCategoryModalOpen(true)}
                className='flex h-9 cursor-pointer items-center gap-2'
                title='カテゴリ追加'
              >
                <Plus size={16} />
                <span className='hidden lg:inline'>カテゴリ追加</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='block lg:hidden'>
              カテゴリ追加
            </TooltipContent>
          </Tooltip>
        )}
        <ViewModeToggle currentMode={currentMode} onChange={onModeChange} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='outline'
              className='flex h-9 cursor-pointer items-center gap-2'
              title='設定'
              onClick={() =>
                window.open(chrome.runtime.getURL('options.html'), '_blank')
              }
            >
              <Wrench size={16} />
              <span className='hidden lg:inline'>設定</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side='top' className='block lg:hidden'>
            設定
          </TooltipContent>
        </Tooltip>
        <div className='space-x-4 text-muted-foreground text-sm'>
          <p>
            タブ:
            {tabGroups.reduce((sum, group) => sum + group.urls.length, 0)}
          </p>
          <p>ドメイン: {tabGroups.length}</p>
        </div>
      </div>

      {currentMode === 'domain' && isModalOpen && (
        <CategoryModal
          onClose={() => setIsModalOpen(false)}
          tabGroups={tabGroups}
        />
      )}
      {currentMode === 'custom' && isCustomCategoryModalOpen && (
        <Dialog
          open={isCustomCategoryModalOpen}
          onOpenChange={setIsCustomCategoryModalOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいカテゴリを追加</DialogTitle>
            </DialogHeader>
            <Input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const name = newCategoryName.trim()
                  if (!name) {
                    toast.error('カテゴリ名を入力してください')
                    return
                  }
                  if (customProjects[0].categories.includes(name)) {
                    toast.error('同じカテゴリ名は追加できません')
                    return
                  }
                  onAddCategory(customProjects[0].id, name)
                  toast.success(`カテゴリ「${name}」を追加しました`)
                  setNewCategoryName('')
                  setIsCustomCategoryModalOpen(false)
                }
              }}
              placeholder='カテゴリ名'
              className='mb-2 w-full'
              autoFocus
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
