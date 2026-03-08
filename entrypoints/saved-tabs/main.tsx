import '@/assets/global.css'
import { Profiler, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SavedTabsChatWidget } from '@/features/ai-chat/components/SavedTabsChatWidget'
import { ExtensionPageShell } from '@/features/navigation/components/ExtensionPageShell'
import { getSavedTabsModeFromLocation } from '@/features/navigation/lib/pageNavigation'
import {
  SavedTabsApp,
  handleSavedTabsRender,
  isDevProfileEnabled,
} from '@/features/saved-tabs/app/SavedTabsApp'
import { SavedTabsResponsiveLayoutProvider } from '@/features/saved-tabs/contexts/SavedTabsResponsiveLayoutContext'

const LEFT_PANE_COMPACT_BREAKPOINT = 1024

const SavedTabsPage = () => {
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false)
  const [leftPaneWidth, setLeftPaneWidth] = useState(() => window.innerWidth)
  const leftPaneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = leftPaneRef.current as HTMLDivElement

    const updateLeftPaneWidth = (width: number) => {
      const roundedWidth = Math.round(width)
      if (!Number.isFinite(roundedWidth) || roundedWidth <= 0) {
        return
      }

      setLeftPaneWidth(currentWidth =>
        currentWidth === roundedWidth ? currentWidth : roundedWidth,
      )
    }

    updateLeftPaneWidth(element.getBoundingClientRect().width)

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => {
        updateLeftPaneWidth(element.getBoundingClientRect().width)
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }

    const observer = new ResizeObserver(entries => {
      updateLeftPaneWidth(entries[0]?.contentRect.width ?? Number.NaN)
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  const isCompactLeftPaneLayout = leftPaneWidth < LEFT_PANE_COMPACT_BREAKPOINT
  const initialViewMode = getSavedTabsModeFromLocation(window.location.search)

  return (
    <ExtensionPageShell>
      <div
        className='flex h-screen items-stretch overflow-hidden'
        data-testid='saved-tabs-page-layout'
      >
        <div
          ref={leftPaneRef}
          className='min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain'
          data-saved-tabs-layout={isCompactLeftPaneLayout ? 'compact' : 'full'}
          data-testid='saved-tabs-left-pane'
        >
          <SavedTabsResponsiveLayoutProvider
            isCompactLayout={isCompactLeftPaneLayout}
          >
            {isDevProfileEnabled ? (
              <Profiler id='SavedTabs' onRender={handleSavedTabsRender}>
                <SavedTabsApp
                  initialViewMode={initialViewMode}
                  isAiSidebarOpen={isAiSidebarOpen}
                />
              </Profiler>
            ) : (
              <SavedTabsApp
                initialViewMode={initialViewMode}
                isAiSidebarOpen={isAiSidebarOpen}
              />
            )}
          </SavedTabsResponsiveLayoutProvider>
        </div>
        <SavedTabsChatWidget onOpenChange={setIsAiSidebarOpen} />
      </div>
    </ExtensionPageShell>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app')
  if (!appContainer) {
    throw new Error('Failed to find the app container')
  }

  const root = createRoot(appContainer)
  root.render(
    <ThemeProvider defaultTheme='system' storageKey='tab-manager-theme'>
      <TooltipProvider>
        <SavedTabsPage />
      </TooltipProvider>
    </ThemeProvider>,
  )
})

export { SavedTabsPage }
