import type { Dispatch, SetStateAction } from 'react'
import { useCategoryManagement } from '@/features/saved-tabs/hooks/useCategoryManagement'
import { useProjectManagement } from '@/features/saved-tabs/hooks/useProjectManagement'
import { useTabData } from '@/features/saved-tabs/hooks/useTabData'
import type { UserSettings } from '@/types/storage'

const useSavedTabsCore = (
  settings: UserSettings,
  setSettings: Dispatch<SetStateAction<UserSettings>>,
) => {
  const categoryState = useCategoryManagement([], settings)
  const tabDataState = useTabData(categoryState.setCategories, setSettings)
  const projectState = useProjectManagement(tabDataState.tabGroups, settings)

  return {
    categoryState,
    tabDataState,
    projectState,
  }
}

export { useSavedTabsCore }
