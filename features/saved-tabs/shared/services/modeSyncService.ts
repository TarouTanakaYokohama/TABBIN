import type { Dispatch, RefObject, SetStateAction } from 'react'
import { invalidateUrlCache } from '@/lib/storage/urls'
import type {
  CustomProject,
  ParentCategory,
  TabGroup,
  UserSettings,
  ViewMode,
} from '@/types/storage'
import type { ModeSyncEvent } from '../types/mode'

interface SyncStorageChangesParams {
  changes: Record<string, chrome.storage.StorageChange>
  viewModeRef: RefObject<ViewMode>
  refreshTabGroupsWithUrls: (nextGroups?: TabGroup[]) => Promise<TabGroup[]>
  syncDomainDataToCustomProjects: () => Promise<CustomProject[]>
  setSettings: Dispatch<SetStateAction<UserSettings>>
  setCategories: Dispatch<SetStateAction<ParentCategory[]>>
  setCustomProjects: Dispatch<SetStateAction<CustomProject[]>>
}

const resolveSyncEvents = (
  changes: Record<string, chrome.storage.StorageChange>,
): ModeSyncEvent[] => {
  const events: ModeSyncEvent[] = []
  if (changes.savedTabs) {
    events.push({
      type: 'savedTabsUpdated',
    })
  }
  if (changes.customProjects) {
    events.push({
      type: 'customProjectsUpdated',
    })
  }
  if (changes.urls) {
    events.push({
      type: 'urlsUpdated',
    })
  }
  if (changes.userSettings) {
    events.push({
      type: 'settingsUpdated',
    })
  }
  if (changes.parentCategories) {
    events.push({
      type: 'categoriesUpdated',
    })
  }
  return events
}

const applyUserSettingsChange = (
  changes: Record<string, chrome.storage.StorageChange>,
  setSettings: Dispatch<SetStateAction<UserSettings>>,
): void => {
  if (!changes.userSettings) {
    return
  }
  const nextSettings = changes.userSettings.newValue as
    | Partial<UserSettings>
    | undefined
  setSettings(prev => ({
    ...prev,
    ...(nextSettings ?? {}),
  }))
}

const applyCategoryChange = (
  changes: Record<string, chrome.storage.StorageChange>,
  setCategories: Dispatch<SetStateAction<ParentCategory[]>>,
): void => {
  if (!changes.parentCategories) {
    return
  }
  const nextCategories = Array.isArray(changes.parentCategories.newValue)
    ? (changes.parentCategories.newValue as ParentCategory[])
    : []
  setCategories(nextCategories)
}

const applyProjectChange = (
  changes: Record<string, chrome.storage.StorageChange>,
  viewModeRef: RefObject<ViewMode>,
  setCustomProjects: Dispatch<SetStateAction<CustomProject[]>>,
): void => {
  if (!(changes.customProjects && viewModeRef.current === 'custom')) {
    return
  }
  const nextCustomProjects = Array.isArray(changes.customProjects.newValue)
    ? (changes.customProjects.newValue as CustomProject[])
    : []
  setCustomProjects(nextCustomProjects)
}

const applyTabsAndUrlsChanges = async (
  changes: Record<string, chrome.storage.StorageChange>,
  refreshTabGroupsWithUrls: (nextGroups?: TabGroup[]) => Promise<TabGroup[]>,
  syncDomainDataToCustomProjects: () => Promise<CustomProject[]>,
): Promise<void> => {
  const hasSavedTabsChange = Boolean(changes.savedTabs)
  const hasUrlsChange = Boolean(changes.urls)

  if (hasUrlsChange) {
    invalidateUrlCache()
  }

  if (hasSavedTabsChange) {
    const nextSavedTabs = Array.isArray(changes.savedTabs.newValue)
      ? (changes.savedTabs.newValue as TabGroup[])
      : []
    await refreshTabGroupsWithUrls(nextSavedTabs)
    await syncDomainDataToCustomProjects()
    return
  }

  if (hasUrlsChange) {
    await refreshTabGroupsWithUrls()
  }
}

const syncStorageChanges = async ({
  changes,
  viewModeRef,
  refreshTabGroupsWithUrls,
  syncDomainDataToCustomProjects,
  setSettings,
  setCategories,
  setCustomProjects,
}: SyncStorageChangesParams): Promise<ModeSyncEvent[]> => {
  const events = resolveSyncEvents(changes)

  await applyTabsAndUrlsChanges(
    changes,
    refreshTabGroupsWithUrls,
    syncDomainDataToCustomProjects,
  )
  applyUserSettingsChange(changes, setSettings)
  applyCategoryChange(changes, setCategories)
  applyProjectChange(changes, viewModeRef, setCustomProjects)

  return events
}

export { syncStorageChanges }
export type { SyncStorageChangesParams }
