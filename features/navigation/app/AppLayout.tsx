import { Outlet, useLocation } from 'react-router-dom'
import { ExtensionPageShell } from '@/features/navigation/components/ExtensionPageShell'

export const AppLayout = () => {
  const location = useLocation()

  return (
    <ExtensionPageShell pathname={location.pathname} search={location.search}>
      <div
        className='flex min-h-0 flex-1 flex-col overflow-hidden'
        data-testid='app-layout'
      >
        <Outlet />
      </div>
    </ExtensionPageShell>
  )
}
