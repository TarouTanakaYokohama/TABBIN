import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, Wrench } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { CustomProject, TabGroup, ViewMode } from '../../../utils/storage'
import { CategoryModal } from './CategoryModal'
import { ViewModeToggle } from './ViewModeToggle'

type HeaderProps = {
  tabGroups: TabGroup[]
  currentMode: ViewMode
  onModeChange: (mode: ViewMode) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onOpenFilter: () => void
  customProjects: CustomProject[]
  onAddCategory: (projectId: string, categoryName: string) => void
}

export const Header = ({
  tabGroups,
  currentMode,
  onModeChange,
  searchQuery,
  onSearchChange,
  onOpenFilter,
  customProjects = [],
  onAddCategory = () => {},
}: HeaderProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCustomCategoryModalOpen, setIsCustomCategoryModalOpen] =
    useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  return (
    <div className='flex items-center mb-4 gap-4'>
      <div className='flex items-center gap-4 flex-1'>
        <h1 className='text-3xl font-bold text-foreground whitespace-nowrap'>
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
      <div className='flex items-center gap-1 whitespace-nowrap flex-shrink-0'>
        {currentMode === 'domain' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsModalOpen(true)}
                className='flex items-center gap-2 cursor-pointer h-9'
                title='親カテゴリ管理'
              >
                <Plus size={16} />
                <span className='lg:inline hidden'>親カテゴリ管理</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='lg:hidden block'>
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
                className='flex items-center gap-2 cursor-pointer h-9'
                title='カテゴリ追加'
              >
                <Plus size={16} />
                <span className='lg:inline hidden'>カテゴリ追加</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side='top' className='lg:hidden block'>
              カテゴリ追加
            </TooltipContent>
          </Tooltip>
        )}
        <ViewModeToggle currentMode={currentMode} onChange={onModeChange} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='sm'
              onClick={() => chrome.runtime.openOptionsPage()}
              className='flex items-center gap-2 cursor-pointer h-9'
              title='設定'
            >
              <Wrench size={16} />
              <span className='lg:inline hidden'>設定</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side='top' className='lg:hidden block'>
            設定
          </TooltipContent>
        </Tooltip>
        <div className='text-sm text-muted-foreground space-x-4'>
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
              className='w-full mb-2'
              autoFocus
            />
            {/* エラーメッセージは toast で表示 */}
            <DialogFooter>
              <Button
                variant='ghost'
                onClick={() => setIsCustomCategoryModalOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={() => {
                  if (customProjects.length === 0) return
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
                }}
              >
                追加
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
