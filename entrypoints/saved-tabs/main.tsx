import '@/assets/global.css'
import { Profiler } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  SavedTabsApp,
  handleSavedTabsRender,
  isDevProfileEnabled,
} from '@/features/saved-tabs/app/SavedTabsApp'

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app')
  if (!appContainer) {
    throw new Error('Failed to find the app container')
  }

  const root = createRoot(appContainer)
  root.render(
    <ThemeProvider defaultTheme='system' storageKey='tab-manager-theme'>
      <TooltipProvider>
        {isDevProfileEnabled ? (
          <Profiler id='SavedTabs' onRender={handleSavedTabsRender}>
            <SavedTabsApp />
          </Profiler>
        ) : (
          <SavedTabsApp />
        )}
      </TooltipProvider>
    </ThemeProvider>,
  )
})
