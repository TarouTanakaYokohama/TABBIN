import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    <Select value={currentMode} onValueChange={onChange}>
      <SelectTrigger className='flex items-center gap-2'>
        <SelectValue placeholder='表示モード' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='domain'>
          <div className='flex items-center gap-2'>
            <Globe size={16} />
            <span className='hidden md:inline'>ドメインモード</span>
            <span className='md:hidden'>ドメイン</span>
          </div>
        </SelectItem>
        <SelectItem value='custom'>
          <div className='flex items-center gap-2'>
            <Folder size={16} />
            <span className='hidden md:inline'>カスタムモード</span>
            <span className='md:hidden'>PJ</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
