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
import { getSavedTabsHrefForMode } from '@/features/navigation/lib/pageNavigation'
import { PeriodicExecutionRoute } from '@/features/periodic-execution/routes/PeriodicExecutionRoute'
import { SavedTabsRoute } from '@/features/saved-tabs/routes/SavedTabsRoute'
import { AppLayout } from './AppLayout'

interface AppRouterProps {
  initialEntries?: string[]
}

const SavedTabsRoutePage = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const handleViewModeNavigate = (mode: 'custom' | 'domain') => {
    const nextRoute = getSavedTabsHrefForMode(mode)
    const currentRoute = `${location.pathname}${location.search}`

    if (currentRoute === nextRoute) {
      return
    }

    navigate(nextRoute, { replace: true })
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
        element={<Navigate to='/saved-tabs?mode=domain' replace={true} />}
      />
      <Route path='/saved-tabs' element={<SavedTabsRoutePage />} />
      <Route path='/ai-chat' element={<AiChatRoute />} />
      <Route path='/periodic-execution' element={<PeriodicExecutionRoute />} />
      <Route
        path='*'
        element={<Navigate to='/saved-tabs?mode=domain' replace={true} />}
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
