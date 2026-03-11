import '@/assets/global.css'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppRouter } from '@/features/navigation/app/AppRouter'

const AppPage = () => {
  return (
    <TooltipProvider>
      <AppRouter />
    </TooltipProvider>
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
      <AppPage />
    </ThemeProvider>,
  )
})

export { AppPage }
