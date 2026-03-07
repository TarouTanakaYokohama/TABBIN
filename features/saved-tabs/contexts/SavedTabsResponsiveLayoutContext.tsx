import { type PropsWithChildren, createContext, useContext } from 'react'

interface SavedTabsResponsiveLayoutContextValue {
  isCompactLayout: boolean
}

const SavedTabsResponsiveLayoutContext =
  createContext<SavedTabsResponsiveLayoutContextValue>({
    isCompactLayout: false,
  })

interface SavedTabsResponsiveLayoutProviderProps extends PropsWithChildren {
  isCompactLayout: boolean
}

export const SavedTabsResponsiveLayoutProvider = ({
  isCompactLayout,
  children,
}: SavedTabsResponsiveLayoutProviderProps) => (
  <SavedTabsResponsiveLayoutContext.Provider value={{ isCompactLayout }}>
    {children}
  </SavedTabsResponsiveLayoutContext.Provider>
)

export const useSavedTabsResponsiveLayout = () =>
  useContext(SavedTabsResponsiveLayoutContext)
