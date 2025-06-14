import type { CustomProject, UserSettings } from '@/types/storage'

export interface CustomProjectCardProps {
  project: CustomProject
  handleOpenUrl: (url: string) => void
  handleDeleteUrl: (projectId: string, url: string) => void
  handleAddUrl: (
    projectId: string,
    url: string,
    title: string,
    category?: string,
  ) => void
  handleDeleteProject: (projectId: string) => void
  handleRenameProject: (projectId: string, newName: string) => void
  handleAddCategory: (projectId: string, categoryName: string) => void
  handleDeleteCategory: (projectId: string, categoryName: string) => void
  handleSetUrlCategory: (
    projectId: string,
    url: string,
    category?: string,
  ) => void
  handleUpdateCategoryOrder: (projectId: string, newOrder: string[]) => void
  handleReorderUrls: (projectId: string, urls: CustomProject['urls']) => void
  handleOpenAllUrls?: (urls: { url: string; title: string }[]) => void
  settings: UserSettings
  draggedItem?: { url: string; projectId: string; title: string } | null
  handleMoveUrlsBetweenCategories?: (
    projectId: string,
    sourceCategoryName: string,
    targetCategoryName: string,
  ) => void
  isDropTarget?: boolean
  handleMoveUrlBetweenProjects?: (
    sourceProjectId: string,
    targetProjectId: string,
    url: string,
  ) => void
  handleRenameCategory?: (
    projectId: string,
    oldCategoryName: string,
    newCategoryName: string,
  ) => void
}
