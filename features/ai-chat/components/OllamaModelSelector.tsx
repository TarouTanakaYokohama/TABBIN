import { useMemo } from 'react'
import {
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
} from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface OllamaModelOption {
  label: string
  name: string
}

interface OllamaModelSelectorProps {
  errorMessage?: string
  fetchOnOpen?: boolean
  helperText?: string
  hideFetchButton?: boolean
  isCompactLayout?: boolean
  isLoading: boolean
  isSaving?: boolean
  models: OllamaModelOption[]
  onFetchModels: () => void
  onSelectModel: (modelName: string) => Promise<boolean> | boolean
  selectedModel?: string
}

const EMPTY_MODEL_VALUE = '__empty__'

const getSelectableModels = (
  models: OllamaModelOption[],
  selectedModel?: string,
): OllamaModelOption[] => {
  if (!selectedModel) {
    return models
  }

  const hasSelectedModel = models.some(model => model.name === selectedModel)
  if (hasSelectedModel) {
    return models
  }

  return [
    {
      label: selectedModel,
      name: selectedModel,
    },
    ...models,
  ]
}

const getEmptyStateLabel = (isLoading: boolean): string =>
  isLoading ? 'モデル一覧を取得しています...' : 'モデルが見つかりませんでした'

const getTriggerDisabled = ({
  fetchOnOpen,
  isLoading,
  isSaving,
  selectableModels,
}: {
  fetchOnOpen: boolean
  isLoading: boolean
  isSaving: boolean
  selectableModels: OllamaModelOption[]
}): boolean =>
  isSaving || (!fetchOnOpen && (isLoading || selectableModels.length === 0))

const OllamaModelSelector = ({
  errorMessage,
  fetchOnOpen = false,
  helperText,
  hideFetchButton = false,
  isCompactLayout = false,
  isLoading,
  isSaving = false,
  models,
  onFetchModels,
  onSelectModel,
  selectedModel,
}: OllamaModelSelectorProps) => {
  const selectableModels = useMemo(
    () => getSelectableModels(models, selectedModel),
    [models, selectedModel],
  )
  const isTriggerDisabled = getTriggerDisabled({
    fetchOnOpen,
    isLoading,
    isSaving,
    selectableModels,
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && fetchOnOpen) {
      onFetchModels()
    }
  }

  const handleValueChange = (nextValue: string) => {
    if (nextValue === EMPTY_MODEL_VALUE) {
      return
    }

    void onSelectModel(nextValue)
  }

  return (
    <div className='space-y-3'>
      <div
        className={cn(
          'flex gap-2',
          isCompactLayout ? 'flex-col' : 'flex-col sm:flex-row',
        )}
      >
        {!hideFetchButton ? (
          <Button
            type='button'
            variant='outline'
            onClick={onFetchModels}
            disabled={isLoading || isSaving}
            className={cn(
              'w-full cursor-pointer',
              !isCompactLayout && 'sm:w-auto',
            )}
          >
            {isLoading ? '取得中...' : 'モデル一覧を取得'}
          </Button>
        ) : null}

        <PromptInputSelect
          defaultValue={selectedModel}
          onOpenChange={handleOpenChange}
          onValueChange={handleValueChange}
          key={selectedModel || 'no-model-selected'}
        >
          <PromptInputSelectTrigger
            aria-label={selectedModel || 'モデルを選択'}
            disabled={isTriggerDisabled}
            className={cn(
              'w-full border border-input bg-background px-3 py-2 text-sm shadow-sm',
              !hideFetchButton && !isCompactLayout && 'sm:w-[220px]',
            )}
          >
            <PromptInputSelectValue placeholder='モデルを選択' />
          </PromptInputSelectTrigger>
          <PromptInputSelectContent>
            {selectableModels.length > 0 ? (
              selectableModels.map(model => (
                <PromptInputSelectItem key={model.name} value={model.name}>
                  {model.label}
                </PromptInputSelectItem>
              ))
            ) : (
              <PromptInputSelectItem disabled value={EMPTY_MODEL_VALUE}>
                {getEmptyStateLabel(isLoading)}
              </PromptInputSelectItem>
            )}
          </PromptInputSelectContent>
        </PromptInputSelect>
      </div>

      {helperText ? (
        <p className='wrap-break-word whitespace-pre-line text-muted-foreground text-sm'>
          {helperText}
        </p>
      ) : null}

      {errorMessage ? (
        <p className='wrap-break-word whitespace-pre-line text-destructive text-sm'>
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}

export type { OllamaModelOption }
export { OllamaModelSelector }
