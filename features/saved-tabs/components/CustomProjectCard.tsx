import { memo } from 'react'
import type { CustomProjectCardProps } from '../types/CustomProjectCard.types'
import { ProjectCardCategoryList } from './project-card/ProjectCardCategoryList'
import { ProjectCardDragOverlay } from './project-card/ProjectCardDragOverlay'
import { ProjectCardRoot } from './project-card/ProjectCardRoot'
import { ProjectCardUncategorizedArea } from './project-card/ProjectCardUncategorizedArea'

/**
 * カスタムプロジェクトカードコンポーネント
 * 複合コンポーネントパターンで構成される薄いラッパー
 * @param props CustomProjectCardProps
 */
const CustomProjectCard = memo(
  ({
    project,
    handleOpenUrl,
    handleDeleteUrl,
    handleDeleteUrlsFromProject,
    handleAddCategory,
    handleDeleteCategory,
    handleRenameCategory,
    handleSetUrlCategory,
    handleUpdateCategoryOrder,
    handleReorderUrls,
    handleOpenAllUrls,
    handleDeleteProject,
    handleRenameProject,
    settings,
    draggedItem,
    isDropTarget = false,
    isProjectReorderMode = false,
  }: CustomProjectCardProps) => (
    <ProjectCardRoot
      project={project}
      settings={settings}
      draggedItem={draggedItem}
      isDropTarget={isDropTarget}
      isProjectReorderMode={isProjectReorderMode}
      handlers={{
        handleOpenUrl,
        handleDeleteUrl,
        handleAddCategory,
        handleDeleteCategory,
        handleRenameCategory,
        handleSetUrlCategory,
        handleOpenAllUrls,
        handleDeleteProject,
        handleRenameProject,
        handleDeleteUrlsFromProject,
      }}
      hookHandlers={{
        handleDeleteUrl,
        handleSetUrlCategory,
        handleUpdateCategoryOrder,
        handleReorderUrls,
      }}
    >
      <ProjectCardCategoryList />
      <ProjectCardUncategorizedArea />
      <ProjectCardDragOverlay />
    </ProjectCardRoot>
  ),
)

CustomProjectCard.displayName = 'CustomProjectCard'

export { CustomProjectCard }
