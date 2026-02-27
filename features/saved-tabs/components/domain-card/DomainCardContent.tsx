import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CardContent } from '@/components/ui/card'
import { SortableCategorySection } from '../SortableCategorySection'
import { CategorySection } from '../TimeRemaining'
import { useDomainCard } from './DomainCardContext'

/**
 * DomainCard の展開時コンテンツ
 * カテゴリセクション一覧を DndContext 付きで表示する
 * 折りたたみ時は何も表示しない
 */
export const DomainCardContent = () => {
  const { state, group, settings, categoryId, handlers } = useDomainCard()
  const { collapse, categoryReorder, computed, categoryActions } = state

  // DnDのセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // 親カテゴリの有無に応じてsticky位置を動的に設定
  const categorySectionStickyTop = categoryId ? 'top-20' : 'top-18'

  if (collapse.isCollapsed) {
    return null
  }

  return (
    <CardContent className='space-y-1 p-2'>
      {(group.urls?.length || 0) > 0 ? (
        categoryReorder.allCategoryIds.length > 1 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={categoryReorder.handleCategoryDragEnd}
          >
            <SortableContext
              items={
                categoryReorder.isCategoryReorderMode
                  ? categoryReorder.tempCategoryOrder
                  : categoryReorder.allCategoryIds
              }
              strategy={verticalListSortingStrategy}
            >
              {(categoryReorder.isCategoryReorderMode
                ? categoryReorder.tempCategoryOrder
                : categoryReorder.allCategoryIds
              ).map(categoryName => {
                const urls = computed.categorizedUrls[categoryName] || []
                if (urls.length === 0) {
                  return null
                }
                return (
                  <SortableCategorySection
                    key={categoryName}
                    id={categoryName}
                    categoryName={categoryName}
                    urls={urls}
                    groupId={group.id}
                    handleDeleteUrl={handlers.handleDeleteUrl}
                    handleOpenTab={handlers.handleOpenTab}
                    handleUpdateUrls={handlers.handleUpdateUrls}
                    handleOpenAllTabs={handlers.handleOpenAllTabs}
                    handleDeleteAllTabs={urls =>
                      categoryActions.handleDeleteAllTabsInCategory(
                        categoryName,
                        urls,
                      )
                    }
                    settings={settings}
                    stickyTop={categorySectionStickyTop}
                    isReorderMode={categoryReorder.isCategoryReorderMode}
                  />
                )
              })}
            </SortableContext>
          </DndContext>
        ) : (
          <CategorySection
            categoryName={
              categoryReorder.allCategoryIds[0] ?? '__uncategorized'
            }
            urls={
              computed.categorizedUrls[
                categoryReorder.allCategoryIds[0] ?? '__uncategorized'
              ]
            }
            groupId={group.id}
            handleDeleteUrl={handlers.handleDeleteUrl}
            handleOpenTab={handlers.handleOpenTab}
            handleUpdateUrls={handlers.handleUpdateUrls}
            handleOpenAllTabs={handlers.handleOpenAllTabs}
            settings={settings}
          />
        )
      ) : (
        <div className='py-4 text-center text-gray-400'>
          {(group.urls?.length || 0) === 0
            ? 'このドメインにはタブがありません'
            : 'カテゴリを追加するにはカテゴリ管理から行ってください'}
        </div>
      )}
    </CardContent>
  )
}
