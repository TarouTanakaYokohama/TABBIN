import { useEffect } from 'react'
import {
  HashRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { AiChatRoute } from '@/features/ai-chat/routes/AiChatRoute'
import { AnalyticsRoute } from '@/features/analytics/routes/AnalyticsRoute'
import {
  getSavedTabsEntryRoute,
  getSavedTabsHrefForMode,
} from '@/features/navigation/lib/pageNavigation'
import { OptionsRoute } from '@/features/options/routes/OptionsRoute'
import { PeriodicExecutionRoute } from '@/features/periodic-execution/routes/PeriodicExecutionRoute'
import { SavedTabsRoute } from '@/features/saved-tabs/routes/SavedTabsRoute'
import { getViewMode } from '@/lib/storage/projects'
import type { ViewMode } from '@/types/storage'
import { AppLayout } from './AppLayout'

interface AppRouterProps {
  initialEntries?: string[]
}

const SavedTabsRoutePage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const hasModeQuery = new URLSearchParams(location.search).has('mode')

  const handleViewModeNavigate = (mode: 'custom' | 'domain') => {
    const nextRoute = getSavedTabsHrefForMode(mode)
    const currentRoute = `${location.pathname}${location.search}`

    if (currentRoute === nextRoute) {
      return
    }

    navigate(nextRoute, { replace: true })
  }

  useEffect(() => {
    if (hasModeQuery) {
      return
    }

    let isCancelled = false

    const resolveViewMode = async () => {
      const mode = await getViewMode().catch((): ViewMode => 'domain')
      const nextRoute = getSavedTabsHrefForMode(mode)
      const currentRoute = `${location.pathname}${location.search}`

      if (isCancelled || currentRoute === nextRoute) {
        return
      }

      navigate(nextRoute, { replace: true })
    }

    void resolveViewMode()

    return () => {
      isCancelled = true
    }
  }, [hasModeQuery, location.pathname, location.search, navigate])

  if (!hasModeQuery) {
    return null
  }

  return (
    <SavedTabsRoute
      search={location.search}
      onViewModeNavigate={handleViewModeNavigate}
    />
  )
}

const AppRoutes = () => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route
        index
        element={<Navigate to={getSavedTabsEntryRoute()} replace={true} />}
      />
      <Route path='/saved-tabs' element={<SavedTabsRoutePage />} />
      <Route path='/ai-chat' element={<AiChatRoute />} />
      <Route path='/analytics' element={<AnalyticsRoute />} />
      <Route path='/options' element={<OptionsRoute />} />
      <Route path='/periodic-execution' element={<PeriodicExecutionRoute />} />
      <Route
        path='*'
        element={<Navigate to={getSavedTabsEntryRoute()} replace={true} />}
      />
    </Route>
  </Routes>
)

export const AppRouter = ({ initialEntries }: AppRouterProps) => {
  if (initialEntries) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AppRoutes />
      </MemoryRouter>
    )
  }

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
