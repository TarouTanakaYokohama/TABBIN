import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CustomProjectCategory } from '../CustomProjectCategory'
import { useProjectCard } from './ProjectCardContext'

/**
 * ProjectCard のカテゴリ表示部分
 * SortableContext でカテゴリの並び替えを提供する
 */
export const ProjectCardCategoryList = () => {
  const { hookState, project, settings, categoryOrder, handlers } =
    useProjectCard()
  const { urls, dnd } = hookState

  if (project.categories.length === 0) {
    return null
  }

  return (
    <SortableContext
      items={categoryOrder}
      strategy={verticalListSortingStrategy}
    >
      {categoryOrder.map((categoryName, idx) => (
        <div key={`${project.id}-${idx}`} className='mb-4'>
          <CustomProjectCategory
            projectId={project.id}
            category={categoryName}
            urls={urls.projectUrls}
            handleOpenUrl={handlers.handleOpenUrl}
            handleDeleteUrl={handlers.handleDeleteUrl}
            handleDeleteCategory={handlers.handleDeleteCategory}
            handleSetUrlCategory={handlers.handleSetUrlCategory}
            handleAddCategory={handlers.handleAddCategory}
            handleRenameCategory={handlers.handleRenameCategory}
            settings={settings}
            handleOpenAllUrls={handlers.handleOpenAllUrls}
            dragData={{ type: 'category' }}
            isHighlighted={dnd.draggedOverCategory === categoryName}
            isDraggingCategory={dnd.isDraggingCategory}
            draggedCategoryName={dnd.draggedCategoryName}
            isCategoryReorder={true}
          />
        </div>
      ))}
    </SortableContext>
  )
}
