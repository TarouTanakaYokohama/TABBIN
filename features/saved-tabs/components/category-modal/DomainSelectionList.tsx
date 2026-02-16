import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCategoryModalContext } from './CategoryModalContext'

/**
 * ドメイン選択リスト
 * ドメインをカテゴリに割り当てるためのチェックボックスリスト
 */
export const DomainSelectionList = () => {
  const { state, tabGroups } = useCategoryModalContext()
  const { selection, domains, isLoading } = state

  if (selection.categories.length === 0) {
    return null
  }

  return (
    <div>
      <Label>
        ドメイン選択
        {selection.selectedCategoryId === 'uncategorized' &&
          '（未割り当てドメインのみ表示）'}
      </Label>
      <ScrollArea className='mt-3 h-[calc(70vh-150px)] rounded border p-2'>
        {tabGroups.length > 0 ? (
          [...tabGroups]
            .sort((a, b) => {
              const aHasCategory = !!domains.domainCategories[a.id]
              const bHasCategory = !!domains.domainCategories[b.id]

              if (!aHasCategory && bHasCategory) return -1
              if (aHasCategory && !bHasCategory) return 1

              return a.domain.localeCompare(b.domain)
            })
            .map(group => {
              const belongsToCategory = domains.domainCategories[group.id]
              const isInCurrentCategory =
                selection.selectedCategoryId &&
                selection.selectedCategoryId !== 'uncategorized' &&
                belongsToCategory?.id === selection.selectedCategoryId
              const isUncategorized = !belongsToCategory

              if (
                selection.selectedCategoryId === 'uncategorized' &&
                belongsToCategory
              ) {
                return null
              }

              return (
                <div
                  key={group.id}
                  className={`flex items-center space-x-2 rounded border-b p-2 last:border-0 ${
                    isInCurrentCategory ? 'bg-primary/10' : ''
                  } ${isUncategorized ? 'bg-muted/50' : ''}`}
                >
                  <Checkbox
                    id={`domain-${group.id}`}
                    checked={domains.selectedDomains[group.id] || false}
                    onCheckedChange={() =>
                      domains.toggleDomainSelection(group.id)
                    }
                    disabled={isLoading || !selection.selectedCategoryId}
                  />
                  <div className='flex-1'>
                    <Label
                      htmlFor={`domain-${group.id}`}
                      className='flex-1 cursor-pointer'
                    >
                      {group.domain}
                    </Label>
                    {belongsToCategory && (
                      <button
                        type='button'
                        className='mt-1 flex w-full cursor-pointer items-center border-0 bg-transparent p-0 text-left text-muted-foreground text-xs hover:text-foreground'
                        onClick={() => domains.toggleDomainSelection(group.id)}
                        disabled={isLoading || !selection.selectedCategoryId}
                        aria-label={`${selection.selectedCategoryId === belongsToCategory.id ? '現在選択中のカテゴリ' : '所属カテゴリ'}: ${belongsToCategory.name}`}
                      >
                        <span className='mr-1 inline-block h-2 w-2 rounded-full bg-primary' />
                        <span>
                          {selection.selectedCategoryId === belongsToCategory.id
                            ? '現在選択中のカテゴリ: '
                            : '所属カテゴリ: '}
                          {belongsToCategory.name}
                        </span>
                      </button>
                    )}

                    {!belongsToCategory && (
                      <button
                        type='button'
                        className='mt-1 flex w-full cursor-pointer items-center border-0 bg-transparent p-0 text-left text-muted-foreground text-xs hover:text-foreground'
                        onClick={() => domains.toggleDomainSelection(group.id)}
                        disabled={isLoading || !selection.selectedCategoryId}
                        aria-label='未分類のドメイン'
                      >
                        <span className='mr-1 inline-block h-2 w-2 rounded-full bg-muted-foreground' />
                        <span>未分類</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
            .filter(Boolean)
        ) : (
          <div className='py-8 text-center text-muted-foreground'>
            保存されたドメインがありません
          </div>
        )}
        {selection.selectedCategoryId === 'uncategorized' &&
          tabGroups.every(group => domains.domainCategories[group.id]) && (
            <div className='py-8 text-center text-muted-foreground'>
              すべてのドメインがカテゴリに分類されています
            </div>
          )}
      </ScrollArea>
    </div>
  )
}
