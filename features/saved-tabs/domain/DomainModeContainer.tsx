import {
  DndContext as DndKitContext,
  type DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check, X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CategoryGroup } from '@/features/saved-tabs/components/CategoryGroup'
import { SortableDomainCard } from '@/features/saved-tabs/components/SortableDomainCard'
import type { ParentCategory, TabGroup, UserSettings } from '@/types/storage'

type DndSensors = ComponentProps<typeof DndKitContext>['sensors']

interface DomainModeContainerProps {
  isLoading: boolean
  settings: UserSettings
  categories: ParentCategory[]
  categorized: Record<string, TabGroup[]>
  categoryOrderForDisplay: string[]
  tabGroups: TabGroup[]
  isCategoryReorderMode: boolean
  searchQuery: string
  sensors: DndSensors
  handleCategoryDragEnd: (event: DragEndEvent) => void
  handleOpenAllTabs: (urls: { url: string; title: string }[]) => Promise<void>
  handleDeleteGroup: (id: string) => Promise<void>
  handleDeleteUrl: (groupId: string, url: string) => Promise<void>
  handleOpenTab: (url: string) => Promise<void>
  handleUpdateUrls: (
    groupId: string,
    updatedUrls: TabGroup['urls'],
  ) => Promise<void>
  handleUpdateDomainsOrder: (
    categoryId: string,
    updatedDomains: TabGroup[],
  ) => Promise<void>
  handleMoveDomainToCategory: (
    domainId: string,
    fromCategoryId: string | null,
    toCategoryId: string,
    tabGroups: TabGroup[],
  ) => Promise<void>
  handleDeleteCategory: (groupId: string, categoryName: string) => Promise<void>
  shouldShowUncategorizedSectionHeader: boolean
  hasVisibleCategoryGroups: boolean
  isUncategorizedReorderMode: boolean
  handleCancelUncategorizedReorder: () => void
  handleConfirmUncategorizedReorder: () => Promise<void>
  shouldShowUncategorizedList: boolean
  uncategorizedForDisplay: TabGroup[]
  handleUncategorizedDragEnd: (event: DragEndEvent) => void
  hasContentTabGroupsCount: number
}

export const DomainModeContainer = ({
  isLoading,
  settings,
  categories,
  categorized,
  categoryOrderForDisplay,
  tabGroups,
  isCategoryReorderMode,
  searchQuery,
  sensors,
  handleCategoryDragEnd,
  handleOpenAllTabs,
  handleDeleteGroup,
  handleDeleteUrl,
  handleOpenTab,
  handleUpdateUrls,
  handleUpdateDomainsOrder,
  handleMoveDomainToCategory,
  handleDeleteCategory,
  shouldShowUncategorizedSectionHeader,
  hasVisibleCategoryGroups,
  isUncategorizedReorderMode,
  handleCancelUncategorizedReorder,
  handleConfirmUncategorizedReorder,
  shouldShowUncategorizedList,
  uncategorizedForDisplay,
  handleUncategorizedDragEnd,
  hasContentTabGroupsCount,
}: DomainModeContainerProps) => {
  if (isLoading) {
    return (
      <div className='flex min-h-[200px] items-center justify-center'>
        <div className='text-foreground text-xl'>読み込み中...</div>
      </div>
    )
  }

  return (
    <>
      {settings.enableCategories && Object.keys(categorized).length > 0 && (
        <DndKitContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext
            items={categoryOrderForDisplay}
            strategy={verticalListSortingStrategy}
          >
            <div className='flex flex-col gap-1'>
              {categoryOrderForDisplay.map(categoryId => {
                if (!categoryId) {
                  return null
                }
                const category = categories.find(c => c.id === categoryId)
                if (!category) {
                  return null
                }
                const domainGroups = categorized[categoryId] || []
                if (domainGroups.length === 0) {
                  return null
                }
                return (
                  <CategoryGroup
                    key={categoryId}
                    category={category}
                    domains={domainGroups}
                    handleOpenAllTabs={handleOpenAllTabs}
                    handleDeleteGroup={handleDeleteGroup}
                    handleDeleteUrl={handleDeleteUrl}
                    handleOpenTab={handleOpenTab}
                    handleUpdateUrls={handleUpdateUrls}
                    handleUpdateDomainsOrder={handleUpdateDomainsOrder}
                    handleMoveDomainToCategory={(
                      domainId,
                      fromCategoryId,
                      toCategoryId,
                    ) =>
                      handleMoveDomainToCategory(
                        domainId,
                        fromCategoryId,
                        toCategoryId,
                        tabGroups,
                      )
                    }
                    handleDeleteCategory={handleDeleteCategory}
                    settings={settings}
                    isCategoryReorderMode={isCategoryReorderMode}
                    searchQuery={searchQuery}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndKitContext>
      )}

      {shouldShowUncategorizedSectionHeader && (
        <div
          className={`sticky top-0 z-50 flex items-center justify-between bg-card ${hasVisibleCategoryGroups ? 'mt-6' : 'mt-2'}`}
        >
          <h2 className='font-bold text-foreground text-xl'>
            未分類のドメイン
          </h2>

          {isUncategorizedReorderMode && (
            <div className='pointer-events-auto ml-2 flex shrink-0 gap-2'>
              <Tooltip>
                <TooltipTrigger asChild={true}>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleCancelUncategorizedReorder}
                    className='flex cursor-pointer items-center gap-1'
                    aria-label='並び替えをキャンセル'
                  >
                    <X size={14} />
                    <span className='hidden lg:inline'>キャンセル</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side='top' className='block lg:hidden'>
                  並び替えをキャンセル
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild={true}>
                  <Button
                    variant='default'
                    size='sm'
                    onClick={handleConfirmUncategorizedReorder}
                    className='flex cursor-pointer items-center gap-1'
                    aria-label='並び替えを確定'
                  >
                    <Check size={14} />
                    <span className='hidden lg:inline'>確定</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side='top' className='block lg:hidden'>
                  並び替えを確定
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      )}

      {shouldShowUncategorizedList && (
        <DndKitContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleUncategorizedDragEnd}
        >
          <SortableContext
            items={uncategorizedForDisplay.map(group => group.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className='mt-2 flex flex-col gap-1'>
              {uncategorizedForDisplay.map(group => (
                <SortableDomainCard
                  key={group.id}
                  group={group}
                  handleOpenAllTabs={handleOpenAllTabs}
                  handleDeleteGroup={handleDeleteGroup}
                  handleDeleteUrl={handleDeleteUrl}
                  handleOpenTab={handleOpenTab}
                  handleUpdateUrls={handleUpdateUrls}
                  handleDeleteCategory={handleDeleteCategory}
                  settings={settings}
                  isReorderMode={isUncategorizedReorderMode}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          </SortableContext>
        </DndKitContext>
      )}

      {hasContentTabGroupsCount === 0 && (
        <div className='flex min-h-[200px] flex-col items-center justify-center gap-4'>
          <div className='text-2xl text-foreground'>
            保存されたタブはありません
          </div>
          <div className='text-muted-foreground'>
            タブを右クリックして保存するか、拡張機能のアイコンをクリックしてください
          </div>
        </div>
      )}
    </>
  )
}
