import { LoadingState } from '@/components/ui/loading-state'
import { CustomProjectSection } from '@/features/saved-tabs/components/CustomProjectSection'
import type {
  CustomProject,
  ProjectKeywordSettings,
  UserSettings,
} from '@/types/storage'

interface CustomModeContainerProps {
  isLoading: boolean
  projects: CustomProject[]
  settings: UserSettings
  handleOpenUrl: (url: string) => Promise<void>
  handleDeleteUrl: (projectId: string, url: string) => Promise<void>
  handleDeleteUrlsFromProject: (
    projectId: string,
    urls: string[],
  ) => Promise<void>
  handleAddUrl: (projectId: string, url: string, title: string) => Promise<void>
  handleCreateProject: (name: string) => Promise<void>
  handleDeleteProject: (projectId: string) => Promise<void>
  handleRenameProject: (projectId: string, newName: string) => Promise<void>
  handleUpdateProjectKeywords: (
    projectId: string,
    projectKeywords: ProjectKeywordSettings,
  ) => Promise<void>
  handleAddCategory: (projectId: string, categoryName: string) => Promise<void>
  handleDeleteCategory: (
    projectId: string,
    categoryName: string,
  ) => Promise<void>
  handleSetUrlCategory: (
    projectId: string,
    url: string,
    category?: string,
  ) => Promise<void>
  handleUpdateCategoryOrder: (
    projectId: string,
    newOrder: string[],
  ) => Promise<void>
  handleReorderUrls: (
    projectId: string,
    urls: CustomProject['urls'],
  ) => Promise<void>
  handleOpenAllUrls: (urls: { url: string; title: string }[]) => Promise<void>
  handleMoveUrlBetweenProjects: (
    sourceProjectId: string,
    targetProjectId: string,
    url: string,
  ) => Promise<string | null>
  handleMoveUrlsBetweenCategories: (
    projectId: string,
    sourceCategoryName: string,
    targetCategoryName: string,
  ) => Promise<void>
  handleReorderProjects: (newOrder: string[]) => Promise<void>
  handleRenameCategory: (
    projectId: string,
    oldCategoryName: string,
    newCategoryName: string,
  ) => Promise<void>
}

export const CustomModeContainer = ({
  isLoading,
  projects,
  settings,
  handleOpenUrl,
  handleDeleteUrl,
  handleDeleteUrlsFromProject,
  handleAddUrl,
  handleCreateProject,
  handleDeleteProject,
  handleRenameProject,
  handleUpdateProjectKeywords,
  handleAddCategory,
  handleDeleteCategory,
  handleSetUrlCategory,
  handleUpdateCategoryOrder,
  handleReorderUrls,
  handleOpenAllUrls,
  handleMoveUrlBetweenProjects,
  handleMoveUrlsBetweenCategories,
  handleReorderProjects,
  handleRenameCategory,
}: CustomModeContainerProps) => {
  if (isLoading) {
    return <LoadingState />
  }

  return (
    <CustomProjectSection
      projects={projects}
      handleOpenUrl={handleOpenUrl}
      handleDeleteUrl={handleDeleteUrl}
      handleDeleteUrlsFromProject={handleDeleteUrlsFromProject}
      handleAddUrl={handleAddUrl}
      handleCreateProject={handleCreateProject}
      handleDeleteProject={handleDeleteProject}
      handleRenameProject={handleRenameProject}
      handleUpdateProjectKeywords={handleUpdateProjectKeywords}
      handleAddCategory={handleAddCategory}
      handleDeleteCategory={handleDeleteCategory}
      handleSetUrlCategory={handleSetUrlCategory}
      handleUpdateCategoryOrder={handleUpdateCategoryOrder}
      handleReorderUrls={handleReorderUrls}
      handleOpenAllUrls={handleOpenAllUrls}
      handleMoveUrlBetweenProjects={handleMoveUrlBetweenProjects}
      handleMoveUrlsBetweenCategories={handleMoveUrlsBetweenCategories}
      handleReorderProjects={handleReorderProjects}
      handleRenameCategory={handleRenameCategory}
      settings={settings}
    />
  )
}
