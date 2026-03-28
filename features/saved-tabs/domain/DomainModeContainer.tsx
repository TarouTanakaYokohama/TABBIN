import {
  DndContext as DndKitContext,
  type DragEndEvent,
  closestCenter,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check, X } from 'lucide-react'
import { type ComponentProps, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '@/features/i18n/context/I18nProvider'
import { CategoryGroup } from '@/features/saved-tabs/components/CategoryGroup'
import { SortableDomainCard } from '@/features/saved-tabs/components/SortableDomainCard'
import {
  SavedTabsResponsiveLabel,
  SavedTabsResponsiveTooltipContent,
} from '@/features/saved-tabs/components/shared/SavedTabsResponsive'
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
  handleDeleteGroups?: (ids: string[]) => Promise<void>
  handleDeleteUrl: (groupId: string, url: string) => Promise<void>
  handleDeleteUrls?: (groupId: string, urls: string[]) => Promise<void>
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
  handleDeleteGroups,
  handleDeleteUrl,
  handleDeleteUrls,
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
  const { t } = useI18n()
  const categoryMap = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories],
  )
  const handleMoveDomainToCategoryWithTabGroups = useCallback(
    (domainId: string, fromCategoryId: string | null, toCategoryId: string) =>
      handleMoveDomainToCategory(
        domainId,
        fromCategoryId,
        toCategoryId,
        tabGroups,
      ),
    [handleMoveDomainToCategory, tabGroups],
  )

  if (isLoading) {
    return <LoadingState />
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
                const category = categoryMap.get(categoryId)
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
                    handleDeleteGroups={handleDeleteGroups}
                    handleDeleteUrl={handleDeleteUrl}
                    handleDeleteUrls={handleDeleteUrls}
                    handleOpenTab={handleOpenTab}
                    handleUpdateUrls={handleUpdateUrls}
                    handleUpdateDomainsOrder={handleUpdateDomainsOrder}
                    handleMoveDomainToCategory={
                      handleMoveDomainToCategoryWithTabGroups
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
            {t('savedTabs.uncategorizedDomainsTitle')}
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
                    aria-label={t('savedTabs.reorder.cancelAria')}
                  >
                    <X size={14} />
                    <SavedTabsResponsiveLabel>
                      {t('savedTabs.reorder.cancel')}
                    </SavedTabsResponsiveLabel>
                  </Button>
                </TooltipTrigger>
                <SavedTabsResponsiveTooltipContent side='top'>
                  {t('savedTabs.reorder.cancelAria')}
                </SavedTabsResponsiveTooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild={true}>
                  <Button
                    variant='default'
                    size='sm'
                    onClick={handleConfirmUncategorizedReorder}
                    className='flex cursor-pointer items-center gap-1'
                    aria-label={t('savedTabs.reorder.confirmAria')}
                  >
                    <Check size={14} />
                    <SavedTabsResponsiveLabel>
                      {t('savedTabs.reorder.confirm')}
                    </SavedTabsResponsiveLabel>
                  </Button>
                </TooltipTrigger>
                <SavedTabsResponsiveTooltipContent side='top'>
                  {t('savedTabs.reorder.confirmAria')}
                </SavedTabsResponsiveTooltipContent>
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
                  handleDeleteGroups={handleDeleteGroups}
                  handleDeleteUrl={handleDeleteUrl}
                  handleDeleteUrls={handleDeleteUrls}
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
            {t('savedTabs.emptyTitle')}
          </div>
          <div className='text-muted-foreground'>
            {t('savedTabs.emptyDescription')}
          </div>
        </div>
      )}
    </>
  )
}
