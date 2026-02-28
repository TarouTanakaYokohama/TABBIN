// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TabGroup } from '@/types/storage'
import { DomainSelectionList } from './DomainSelectionList'

const { useCategoryModalContextMock } = vi.hoisted(() => ({
  useCategoryModalContextMock: vi.fn(),
}))

vi.mock('./CategoryModalContext', () => ({
  useCategoryModalContext: useCategoryModalContextMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const createTabGroups = (count: number): TabGroup[] =>
  Array.from({ length: count }, (_, idx) => ({
    id: `group-${idx}`,
    domain: `domain-${String(idx).padStart(3, '0')}.example.com`,
    urlIds: [],
  }))

const setCategoryModalContext = ({
  tabGroups,
  selectedCategoryId,
  categories = [{ id: 'cat-1', name: 'カテゴリ1' }],
  domainCategories,
  toggleDomainSelection = vi.fn(),
}: {
  tabGroups: TabGroup[]
  selectedCategoryId: string | null
  categories?: Array<{ id: string; name: string }>
  domainCategories: Record<string, { id: string; name: string } | null>
  toggleDomainSelection?: (domainId: string) => void
}) => {
  const selectedDomains = Object.fromEntries(tabGroups.map(g => [g.id, false]))

  useCategoryModalContextMock.mockReturnValue({
    state: {
      selection: {
        categories,
        selectedCategoryId,
      },
      domains: {
        domainCategories,
        selectedDomains,
        toggleDomainSelection,
      },
      isLoading: false,
    },
    tabGroups,
  })
}

describe('DomainSelectionList', () => {
  it('カテゴリ一覧が空なら何も描画しない', () => {
    setCategoryModalContext({
      tabGroups: createTabGroups(1),
      selectedCategoryId: null,
      categories: [],
      domainCategories: {
        'group-0': null,
      },
    })

    const { container } = render(<DomainSelectionList />)
    expect(container.textContent).toBe('')
  })

  it('大量ドメインでも初期表示は仮想化された行だけを描画する', async () => {
    const tabGroups = createTabGroups(120)
    const domainCategories = Object.fromEntries(
      tabGroups.map(g => [g.id, null]),
    ) as Record<string, { id: string; name: string } | null>

    setCategoryModalContext({
      tabGroups,
      selectedCategoryId: 'cat-1',
      domainCategories,
    })

    render(<DomainSelectionList />)

    await waitFor(() => {
      expect(screen.getByText('domain-000.example.com')).toBeTruthy()
    })
    expect(screen.queryByText('domain-119.example.com')).toBeNull()
  })

  it('タブが0件なら空メッセージを表示する', () => {
    setCategoryModalContext({
      tabGroups: [],
      selectedCategoryId: 'cat-1',
      domainCategories: {},
    })

    render(<DomainSelectionList />)

    expect(screen.getByText('保存されたドメインがありません')).toBeTruthy()
  })

  it('未分類選択で全ドメインが分類済みなら分類済みメッセージを表示する', () => {
    const tabGroups = createTabGroups(2)
    const domainCategories = Object.fromEntries(
      tabGroups.map(g => [g.id, { id: 'cat-1', name: 'カテゴリ1' }]),
    ) as Record<string, { id: string; name: string } | null>

    setCategoryModalContext({
      tabGroups,
      selectedCategoryId: 'uncategorized',
      domainCategories,
    })

    render(<DomainSelectionList />)

    expect(
      screen.getByText('すべてのドメインがカテゴリに分類されています'),
    ).toBeTruthy()
  })

  it('カテゴリ所属ドメインは現在カテゴリ/所属カテゴリラベルを表示する', async () => {
    const tabGroups = createTabGroups(1)
    const domainCategories = {
      [tabGroups[0].id]: { id: 'cat-1', name: 'カテゴリ1' },
    }

    setCategoryModalContext({
      tabGroups,
      selectedCategoryId: 'cat-1',
      domainCategories,
    })
    const { rerender } = render(<DomainSelectionList />)

    await waitFor(() => {
      expect(screen.getByText(/現在選択中のカテゴリ/)).toBeTruthy()
    })

    setCategoryModalContext({
      tabGroups,
      selectedCategoryId: 'cat-2',
      categories: [
        { id: 'cat-1', name: 'カテゴリ1' },
        { id: 'cat-2', name: 'カテゴリ2' },
      ],
      domainCategories,
    })
    rerender(<DomainSelectionList />)

    await waitFor(() => {
      expect(screen.getByText(/所属カテゴリ/)).toBeTruthy()
    })
  })

  it('分類済み/未分類のソート順を安定して適用する（分類済み→未分類順）', async () => {
    const tabGroups: TabGroup[] = [
      { id: 'cat-domain', domain: 'cat.example.com', urlIds: [] },
      { id: 'uncat-domain', domain: 'uncat.example.com', urlIds: [] },
    ]
    const domainCategories = {
      'cat-domain': { id: 'cat-1', name: 'カテゴリ1' },
      'uncat-domain': null,
    }

    setCategoryModalContext({
      tabGroups,
      selectedCategoryId: 'cat-1',
      domainCategories,
    })

    render(<DomainSelectionList />)

    await waitFor(() => {
      const rows = screen.getAllByTestId('domain-row')
      expect(rows[0]?.textContent).toContain('uncat.example.com')
      expect(rows[1]?.textContent).toContain('cat.example.com')
    })
  })

  it('分類済み/未分類のソート順を安定して適用する（未分類→分類済み順）', async () => {
    const tabGroups: TabGroup[] = [
      { id: 'uncat-domain', domain: 'uncat.example.com', urlIds: [] },
      { id: 'cat-domain', domain: 'cat.example.com', urlIds: [] },
    ]
    const domainCategories = {
      'cat-domain': { id: 'cat-1', name: 'カテゴリ1' },
      'uncat-domain': null,
    }

    setCategoryModalContext({
      tabGroups,
      selectedCategoryId: 'cat-1',
      domainCategories,
    })

    render(<DomainSelectionList />)

    await waitFor(() => {
      const rows = screen.getAllByTestId('domain-row')
      expect(rows[0]?.textContent).toContain('uncat.example.com')
      expect(rows[1]?.textContent).toContain('cat.example.com')
    })
  })

  it('チェックボックス操作でドメイン選択トグルを呼び出す', async () => {
    const tabGroups = createTabGroups(1)
    const toggleDomainSelection = vi.fn()

    setCategoryModalContext({
      tabGroups,
      selectedCategoryId: 'cat-1',
      domainCategories: {
        'group-0': null,
      },
      toggleDomainSelection,
    })

    render(<DomainSelectionList />)

    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('checkbox'))

    expect(toggleDomainSelection).toHaveBeenCalledWith('group-0')
  })
})
