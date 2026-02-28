import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ProjectUrlItem } from '@/features/saved-tabs/components/ProjectUrlItem'
import { useProjectCard } from './ProjectCardContext'

/**
 * ProjectCard の未分類URLエリア
 * 未分類URLの一覧表示と空のドロップゾーンを含む
 */
export const ProjectCardUncategorizedArea = () => {
  const {
    hookState,
    project,
    settings,
    isUncategorizedOver,
    setUncategorizedDropRef,
    handlers,
  } = useProjectCard()
  const { urls } = hookState

  // 未分類URLがある場合
  if (urls.projectUrls.length > 0 && urls.uncategorizedUrls.length > 0) {
    return (
      <section
        className={`uncategorized-area uncategorized-drop-zone mt-4 overflow-x-hidden p-4 ${
          isUncategorizedOver
            ? 'rounded border-2 border-primary bg-primary/10 shadow-sm'
            : 'rounded border border-muted border-dashed'
        }`}
        ref={setUncategorizedDropRef}
        id={`uncategorized-${project.id}`}
        data-type='uncategorized'
        data-project-id={project.id}
        data-is-drop-area='true'
        data-uncategorized-area='true'
        data-uncategorized-container='true'
        aria-label='未分類URLエリア'
      >
        {project.categories.length > 0 && (
          <h3
            className='uncategorized-heading mb-2 px-2 font-semibold text-md'
            data-type='uncategorized'
            data-uncategorized-area='true'
          >
            未分類のURL
            {isUncategorizedOver && (
              <span className='text-primary' data-type='uncategorized'>
                {' '}
                (ドロップでカテゴリ解除)
              </span>
            )}
          </h3>
        )}

        <SortableContext
          items={urls.uncategorizedUrls.map(item => item.url)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            className='uncategorized-area uncategorized-list space-y-2'
            data-type='uncategorized'
            data-parent-id={`uncategorized-${project.id}`}
            data-uncategorized-area='true'
            data-uncategorized-list='true'
            style={{ overflow: 'hidden' }}
          >
            {urls.uncategorizedUrls.map(item => (
              <ProjectUrlItem
                key={item.url}
                item={item}
                projectId={project.id}
                handleOpenUrl={handlers.handleOpenUrl}
                handleDeleteUrl={handlers.handleDeleteUrl}
                handleSetCategory={handlers.handleSetUrlCategory}
                isInUncategorizedArea={true}
                parentType='uncategorized'
                settings={settings}
              />
            ))}
          </ul>
        </SortableContext>
      </section>
    )
  }

  // 空の未分類エリア（ドロップ可能）
  if (
    urls.projectUrls.length > 0 &&
    urls.uncategorizedUrls.length === 0 &&
    project.categories.length > 0
  ) {
    return (
      <button
        className={`uncategorized-area uncategorized-drop-zone uncategorized-empty mt-4 w-full cursor-pointer rounded border-2 border-dashed p-8 text-left ${
          isUncategorizedOver
            ? 'border-primary bg-primary/10 shadow-md'
            : 'border-muted hover:border-muted-foreground hover:bg-accent/5'
        }`}
        ref={setUncategorizedDropRef}
        id={`uncategorized-${project.id}`}
        data-type='uncategorized'
        data-project-id={project.id}
        data-is-drop-area='true'
        data-uncategorized-area='true'
        data-uncategorized-container='true'
        data-empty-container='true'
        aria-label='URLをここにドロップして未分類に移動'
        onClick={() => {
          const selectedUrl = window.getSelection()?.toString()
          if (
            selectedUrl &&
            urls.projectUrls.some(u => u.url === selectedUrl)
          ) {
            handlers.handleSetUrlCategory(project.id, selectedUrl, undefined)
          }
        }}
        type='button'
      >
        <div className='text-center font-medium'>
          <span
            className={
              isUncategorizedOver ? 'text-primary' : 'text-muted-foreground'
            }
          >
            URLをここにドロップして<strong>未分類</strong>に移動
          </span>
        </div>
      </button>
    )
  }

  return null
}
