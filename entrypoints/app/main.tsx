import '@/assets/global.css'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppRouter } from '@/features/navigation/app/AppRouter'
import { mountToElement } from '@/lib/react/render-root'

const AppPage = () => {
  return (
    <TooltipProvider>
      <AppRouter />
    </TooltipProvider>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  mountToElement(
    'app',
    <ThemeProvider defaultTheme='system' storageKey='tab-manager-theme'>
      <AppPage />
    </ThemeProvider>,
    'Failed to find the app container',
  )
})

export { AppPage }
