import { Button } from '@/components/ui/button'
import type { ViewMode } from '@/utils/storage'
import { Folder, Globe } from 'lucide-react'

interface ViewModeToggleProps {
  currentMode: ViewMode
  onChange: (mode: ViewMode) => void
}

export const ViewModeToggle = ({
  currentMode,
  onChange,
}: ViewModeToggleProps) => {
  return (
    <div className='flex gap-2 items-center'>
      <Button
        variant={currentMode === 'domain' ? 'default' : 'outline'}
        onClick={() => onChange('domain')}
        size='sm'
        className='flex items-center gap-2'
      >
        <Globe size={16} />
        <span className='hidden md:inline'>ドメインモード</span>
        <span className='md:hidden'>ドメイン</span>
      </Button>

      <Button
        variant={currentMode === 'custom' ? 'default' : 'outline'}
        onClick={() => onChange('custom')}
        size='sm'
        className='flex items-center gap-2'
      >
        <Folder size={16} />
        <span className='hidden md:inline'>カスタムモード</span>
        <span className='md:hidden'>PJ</span>
      </Button>
    </div>
  )
}
