import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/options/hooks/useSettings', () => ({
  useSettings: () => ({
    addExcludePattern: vi.fn(),
    excludePatternInput: '',
    handleExcludePatternInputChange: vi.fn(),
    settings: {
      aiChatEnabled: false,
      aiProvider: 'none',
      autoDeletePeriod: 'never',
      clickBehavior: 'saveSameDomainTabs',
      colors: {},
      confirmDeleteAll: false,
      confirmDeleteEach: false,
      enableCategories: true,
      excludePatterns: ['chrome://'],
      excludePinnedTabs: true,
      ollamaModel: '',
      openAllInNewWindow: false,
      openUrlInBackground: true,
      removeTabAfterExternalDrop: true,
      removeTabAfterOpen: true,
      showSavedTime: false,
    },
    removeExcludePattern: vi.fn(),
    setSettings: vi.fn(),
    setExcludePatternInput: vi.fn(),
    isLoading: false,
    updateSetting: vi.fn(),
  }),
}))

vi.mock('@/features/options/hooks/useColorSettings', () => ({
  useColorSettings: () => ({
    handleColorChange: vi.fn(),
    handleResetColors: vi.fn(),
  }),
}))

vi.mock('@/features/options/hooks/useCategories', () => ({
  useCategories: () => ({
    handleCategoryKeyDown: vi.fn(),
  }),
}))

vi.mock('@/features/options/hooks/useAutoDeletePeriod', () => ({
  useAutoDeletePeriod: () => ({
    pendingAutoDeletePeriod: null,
    confirmationState: {
      isOpen: false,
    },
    hideConfirmation: vi.fn(),
    handleAutoDeletePeriodChange: vi.fn(),
    prepareAutoDeletePeriod: vi.fn(),
  }),
}))

vi.mock('@/features/options/ImportExportSettings', () => ({
  ImportExportSettings: () =>
    createElement('div', null, 'ImportExportSettings'),
}))

vi.mock('@/components/mode-toggle', () => ({
  ModeToggle: () => createElement('div', null, 'ModeToggle'),
}))

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => createElement('div', null, 'Toaster'),
}))

import { OptionsPage } from '@/features/options/routes/OptionsRoute'

describe('オプションページ', () => {
  it('AI チャット設定セクションを表示しない', () => {
    render(createElement(OptionsPage))

    expect(screen.queryByText('AI チャット')).toBeNull()
  })
})
