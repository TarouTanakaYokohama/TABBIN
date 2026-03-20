import { Folder, Globe } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/features/i18n/context/I18nProvider'
import type { ViewMode } from '@/types/storage'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from './shared/SavedTabsResponsive'

interface ViewModeToggleProps {
  currentMode: ViewMode
  onChange: (mode: ViewMode) => void
}

export const ViewModeToggle = ({
  currentMode,
  onChange,
}: ViewModeToggleProps) => {
  const { t } = useI18n()
  const renderSelectedValue = () => {
    if (currentMode === 'domain') {
      return (
        <div className='flex items-center gap-2'>
          <Globe size={16} />
          <SavedTabsResponsiveLabel>
            {t('savedTabs.viewMode.domain')}
          </SavedTabsResponsiveLabel>
        </div>
      )
    }
    if (currentMode === 'custom') {
      return (
        <div className='flex items-center gap-2'>
          <Folder size={16} />
          <SavedTabsResponsiveLabel>
            {t('savedTabs.viewMode.custom')}
          </SavedTabsResponsiveLabel>
        </div>
      )
    }
    return t('savedTabs.viewMode.placeholder')
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        <div>
          <Select value={currentMode} onValueChange={onChange}>
            <SelectTrigger
              aria-label={t('savedTabs.viewMode.tooltip')}
              className='flex h-9 items-center gap-2'
            >
              <SelectValue
                placeholder={t('savedTabs.viewMode.selectPlaceholder')}
              >
                {renderSelectedValue()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='domain'>
                <div className='flex items-center gap-2'>
                  <Globe size={16} />
                  <span>{t('savedTabs.viewMode.domain')}</span>
                </div>
              </SelectItem>
              <SelectItem value='custom'>
                <div className='flex items-center gap-2'>
                  <Folder size={16} />
                  <span>{t('savedTabs.viewMode.custom')}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TooltipTrigger>
      <SavedTabsResponsiveTooltipContent side='top'>
        {t('savedTabs.viewMode.tooltip')}
      </SavedTabsResponsiveTooltipContent>
    </Tooltip>
  )
}
