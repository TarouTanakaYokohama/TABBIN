// filepath: features/saved-tabs/types/CustomProjectSection.types.ts
import type { CustomProject, UserSettings } from '@/utils/storage'

export interface CustomProjectSectionProps {
  projects: CustomProject[]
  handleOpenUrl: (url: string) => void
  handleDeleteUrl: (projectId: string, url: string) => void
  handleAddUrl: (
    projectId: string,
    url: string,
    title: string,
    category?: string,
  ) => void
  handleCreateProject: (name: string, description?: string) => void
  handleDeleteProject: (projectId: string) => void
  handleRenameProject: (projectId: string, newName: string) => void
  handleAddCategory: (projectId: string, categoryName: string) => void
  handleDeleteCategory: (projectId: string, categoryName: string) => void
  handleRenameCategory?: (
    projectId: string,
    oldCategoryName: string,
    newCategoryName: string,
  ) => void
  handleSetUrlCategory: (
    projectId: string,
    url: string,
    category?: string,
  ) => void
  handleUpdateCategoryOrder: (projectId: string, newOrder: string[]) => void
  handleReorderUrls: (projectId: string, urls: CustomProject['urls']) => void
  handleReorderProjects?: (projectIds: string[]) => void
  handleOpenAllUrls?: (urls: { url: string; title: string }[]) => void
  handleMoveUrlBetweenProjects?: (
    sourceProjectId: string,
    targetProjectId: string,
    url: string,
  ) => void
  handleMoveUrlsBetweenCategories?: (
    projectId: string,
    sourceCategoryName: string,
    targetCategoryName: string,
  ) => void
  settings: UserSettings
}
