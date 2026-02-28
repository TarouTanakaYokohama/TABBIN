import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { TabGroup } from '@/types/storage'
import { useCategoryModalContext } from './CategoryModalContext'

interface DomainCategoryInfo {
  id: string
  name: string
}

interface DomainSelectionState {
  selectedCategoryId: string | null
}

interface DomainState {
  domainCategories: Record<string, DomainCategoryInfo | null>
  selectedDomains: Record<string, boolean>
  toggleDomainSelection: (domainId: string) => void
}

const sortTabGroups = (
  tabGroups: TabGroup[],
  domainCategories: DomainState['domainCategories'],
): TabGroup[] => {
  return [...tabGroups].sort((a, b) => {
    const aHasCategory = Boolean(domainCategories[a.id])
    const bHasCategory = Boolean(domainCategories[b.id])
    if (!aHasCategory && bHasCategory) {
      return -1
    }
    if (aHasCategory && !bHasCategory) {
      return 1
    }
    return a.domain.localeCompare(b.domain)
  })
}

const getVisibleTabGroups = ({
  tabGroups,
  selectedCategoryId,
  domainCategories,
}: {
  tabGroups: TabGroup[]
  selectedCategoryId: string | null
  domainCategories: DomainState['domainCategories']
}): TabGroup[] => {
  if (selectedCategoryId !== 'uncategorized') {
    return tabGroups
  }
  return tabGroups.filter(group => !domainCategories[group.id])
}

const getDomainRowClass = (
  belongsToCategory: DomainCategoryInfo | null,
  isInCurrentCategory: boolean,
): string => {
  const categoryClass = isInCurrentCategory ? 'bg-primary/10' : ''
  const uncategorizedClass = !belongsToCategory ? 'bg-muted/50' : ''
  return `flex items-center space-x-2 rounded border-b p-2 last:border-0 ${categoryClass} ${uncategorizedClass}`
}

const DomainCategoryStatus = ({
  belongsToCategory,
  selectedCategoryId,
  onToggle,
  disabled,
}: {
  belongsToCategory: DomainCategoryInfo | null
  selectedCategoryId: string | null
  onToggle: () => void
  disabled: boolean
}) => {
  if (!belongsToCategory) {
    return (
      <button
        type='button'
        className='mt-1 flex w-full cursor-pointer items-center border-0 bg-transparent p-0 text-left text-muted-foreground text-xs hover:text-foreground'
        onClick={onToggle}
        disabled={disabled}
        aria-label='未分類のドメイン'
      >
        <span className='mr-1 inline-block h-2 w-2 rounded-full bg-muted-foreground' />
        <span>未分類</span>
      </button>
    )
  }

  const isCurrentCategory = selectedCategoryId === belongsToCategory.id
  return (
    <button
      type='button'
      className='mt-1 flex w-full cursor-pointer items-center border-0 bg-transparent p-0 text-left text-muted-foreground text-xs hover:text-foreground'
      onClick={onToggle}
      disabled={disabled}
      aria-label={`${isCurrentCategory ? '現在選択中のカテゴリ' : '所属カテゴリ'}: ${belongsToCategory.name}`}
    >
      <span className='mr-1 inline-block h-2 w-2 rounded-full bg-primary' />
      <span>
        {isCurrentCategory ? '現在選択中のカテゴリ: ' : '所属カテゴリ: '}
        {belongsToCategory.name}
      </span>
    </button>
  )
}

const renderDomainRow = (params: {
  group: TabGroup
  selection: DomainSelectionState
  domains: DomainState
  isLoading: boolean
}) => {
  const { group, selection, domains, isLoading } = params
  const belongsToCategory = domains.domainCategories[group.id]
  const isInCurrentCategory =
    selection.selectedCategoryId !== null &&
    selection.selectedCategoryId !== 'uncategorized' &&
    belongsToCategory?.id === selection.selectedCategoryId
  const disabled = isLoading || !selection.selectedCategoryId
  const checkboxId = `domain-${group.id}`
  const onToggle = () => domains.toggleDomainSelection(group.id)

  return (
    <div
      data-testid='domain-row'
      className={getDomainRowClass(belongsToCategory, isInCurrentCategory)}
    >
      <Checkbox
        id={checkboxId}
        checked={domains.selectedDomains[group.id]}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
      <div className='flex-1'>
        <Label htmlFor={checkboxId} className='flex-1 cursor-pointer'>
          {group.domain}
        </Label>
        <DomainCategoryStatus
          belongsToCategory={belongsToCategory}
          selectedCategoryId={selection.selectedCategoryId}
          onToggle={onToggle}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

/**
 * ドメイン選択リスト
 * ドメインをカテゴリに割り当てるためのチェックボックスリスト
 */
export const DomainSelectionList = () => {
  const { state, tabGroups } = useCategoryModalContext()
  const { selection, domains, isLoading } = state
  const scrollElementRef = useRef<HTMLDivElement>(null)

  const sortedTabGroups = useMemo(
    () => sortTabGroups(tabGroups, domains.domainCategories),
    [tabGroups, domains.domainCategories],
  )

  const visibleTabGroups = useMemo(
    () =>
      getVisibleTabGroups({
        tabGroups: sortedTabGroups,
        selectedCategoryId: selection.selectedCategoryId,
        domainCategories: domains.domainCategories,
      }),
    [sortedTabGroups, selection.selectedCategoryId, domains.domainCategories],
  )

  const rowVirtualizer = useVirtualizer({
    count: visibleTabGroups.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 56,
    overscan: 8,
    observeElementRect: (_instance, cb) => {
      cb({
        width: 0,
        height: 560,
      })
      return () => {}
    },
    initialRect: {
      width: 0,
      height: 560,
    },
  })

  if (selection.categories.length === 0) {
    return null
  }

  let listContent: React.ReactNode
  if (tabGroups.length === 0) {
    listContent = (
      <div className='py-8 text-center text-muted-foreground'>
        保存されたドメインがありません
      </div>
    )
  } else if (visibleTabGroups.length === 0) {
    listContent = (
      <div className='py-8 text-center text-muted-foreground'>
        すべてのドメインがカテゴリに分類されています
      </div>
    )
  } else {
    listContent = (
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualItem => {
          const group = visibleTabGroups[virtualItem.index]

          return (
            <div
              key={group.id}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderDomainRow({
                group,
                selection,
                domains,
                isLoading,
              })}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <Label>
        ドメイン選択
        {selection.selectedCategoryId === 'uncategorized' &&
          '（未割り当てドメインのみ表示）'}
      </Label>
      <div
        ref={scrollElementRef}
        className='mt-3 h-[calc(70vh-150px)] overflow-auto rounded border p-2'
      >
        {listContent}
      </div>
    </div>
  )
}
