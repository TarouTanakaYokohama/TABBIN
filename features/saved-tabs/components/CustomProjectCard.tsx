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
export const CustomProjectCard = ({
  project,
  handleOpenUrl,
  handleDeleteUrl,
  handleAddCategory,
  handleDeleteCategory,
  handleRenameCategory,
  handleSetUrlCategory,
  handleUpdateCategoryOrder,
  handleReorderUrls,
  handleOpenAllUrls,
  settings,
  draggedItem,
  isDropTarget = false,
}: CustomProjectCardProps) => (
  <ProjectCardRoot
    project={project}
    settings={settings}
    draggedItem={draggedItem}
    isDropTarget={isDropTarget}
    handlers={{
      handleOpenUrl,
      handleDeleteUrl,
      handleAddCategory,
      handleDeleteCategory,
      handleRenameCategory,
      handleSetUrlCategory,
      handleOpenAllUrls,
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
)
