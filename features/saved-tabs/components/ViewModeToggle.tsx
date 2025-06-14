import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ViewMode } from '@/types/storage'
import { Folder, Globe } from 'lucide-react'

interface ViewModeToggleProps {
  currentMode: ViewMode
  onChange: (mode: ViewMode) => void
}

export const ViewModeToggle = ({
  currentMode,
  onChange,
}: ViewModeToggleProps) => {
  const renderSelectedValue = () => {
    if (currentMode === 'domain') {
      return (
        <div className='flex items-center gap-2'>
          <Globe size={16} />
          <span className='hidden lg:inline'>ドメインモード</span>
        </div>
      )
    }
    if (currentMode === 'custom') {
      return (
        <div className='flex items-center gap-2'>
          <Folder size={16} />
          <span className='hidden lg:inline'>(preview)カスタムモード</span>
        </div>
      )
    }
    return '表示モード'
  }

  return (
    <Select value={currentMode} onValueChange={onChange}>
      <SelectTrigger className='flex h-9 items-center gap-2'>
        <SelectValue placeholder='表示モード'>
          {renderSelectedValue()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='domain'>
          <div className='flex items-center gap-2'>
            <Globe size={16} />
            <span>ドメインモード</span>
          </div>
        </SelectItem>
        <SelectItem value='custom'>
          <div className='flex items-center gap-2'>
            <Folder size={16} />
            <span>(preview)カスタムモード</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
