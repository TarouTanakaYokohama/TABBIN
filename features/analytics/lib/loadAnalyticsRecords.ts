import { buildAiSavedUrlRecords } from '@/features/ai-chat/lib/buildAiContext'
import type { AiSavedUrlRecord } from '@/features/ai-chat/types'
import { getParentCategories } from '@/lib/storage/categories'
import { getCustomProjects } from '@/lib/storage/projects'
import { getUrlRecords } from '@/lib/storage/urls'
import type { TabGroup } from '@/types/storage'

const loadAnalyticsRecords = async (): Promise<AiSavedUrlRecord[]> => {
  const [urlRecords, customProjects, parentCategories, savedTabsResult] =
    await Promise.all([
      getUrlRecords(),
      getCustomProjects(),
      getParentCategories(),
      chrome.storage.local.get('savedTabs'),
    ])

  return buildAiSavedUrlRecords({
    customProjects,
    parentCategories,
    savedTabs: Array.isArray(savedTabsResult.savedTabs)
      ? (savedTabsResult.savedTabs as TabGroup[])
      : [],
    urlRecords,
  })
}

export { loadAnalyticsRecords }
