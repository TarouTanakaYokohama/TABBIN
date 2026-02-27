// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomProjectSectionProps } from '@/features/saved-tabs/types/CustomProjectSection.types'
import type { UserSettings } from '@/types/storage'

const { dndContextPropsRef, customProjectCardSpy, arrayMoveMock } = vi.hoisted(
  () => ({
    dndContextPropsRef: {
      current: {} as {
        onDragStart?: (event: unknown) => void
        onDragOver?: (event: unknown) => void
        onDragEnd?: (event: unknown) => void
      },
    },
    customProjectCardSpy: vi.fn(),
    arrayMoveMock: vi.fn((arr: string[], from: number, to: number) => {
      const next = [...arr]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    }),
  }),
)

vi.mock('@dnd-kit/core', () => ({
  closestCenter: 'closestCenter',
  DndContext: ({
    children,
    onDragStart,
    onDragOver,
    onDragEnd,
  }: {
    children: React.ReactNode
    onDragStart?: (event: unknown) => void
    onDragOver?: (event: unknown) => void
    onDragEnd?: (event: unknown) => void
  }) => {
    dndContextPropsRef.current = { onDragStart, onDragOver, onDragEnd }
    return <div data-testid='dnd-context'>{children}</div>
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='drag-overlay'>{children}</div>
  ),
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: arrayMoveMock,
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='sortable-context'>{children}</div>
  ),
  verticalListSortingStrategy: 'verticalListSortingStrategy',
}))

vi.mock('./CustomProjectCard', () => ({
  CustomProjectCard: (props: {
    project: { id: string; name: string }
    draggedItem?: { url: string; projectId: string; title: string } | null
    isDropTarget?: boolean
  }) => {
    customProjectCardSpy(props)
    return (
      <div
        data-testid={`project-card-${props.project.id}`}
        data-drop-target={props.isDropTarget ? 'true' : 'false'}
        data-dragged-item={props.draggedItem ? props.draggedItem.url : ''}
      >
        {props.project.name}
      </div>
    )
  },
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
  }) => (
    <div data-testid='dialog-root'>
      <button onClick={() => onOpenChange?.(true)} type='button'>
        dialog-open
      </button>
      <button onClick={() => onOpenChange?.(false)} type='button'>
        dialog-close
      </button>
      {open ? children : null}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='dialog-content'>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

import { CustomProjectSection } from './CustomProjectSection'

const defaultSettings: UserSettings = {
  removeTabAfterOpen: true,
  removeTabAfterExternalDrop: true,
  excludePatterns: [],
  enableCategories: true,
  autoDeletePeriod: 'never',
  showSavedTime: false,
  clickBehavior: 'saveSameDomainTabs',
  excludePinnedTabs: false,
  openUrlInBackground: true,
  openAllInNewWindow: false,
  confirmDeleteAll: false,
  confirmDeleteEach: false,
  colors: {},
}

const createProjects = () => [
  {
    id: 'project-1',
    name: 'Project One',
    description: 'Desc 1',
    categories: ['CatA'],
    createdAt: 1,
    updatedAt: 2,
    urls: [],
  },
  {
    id: 'project-2',
    name: 'Project Two',
    description: 'Desc 2',
    categories: [],
    createdAt: 3,
    updatedAt: 4,
    urls: [],
  },
]

const createProps = (
  overrides: Partial<CustomProjectSectionProps> = {},
): CustomProjectSectionProps => ({
  projects: createProjects(),
  handleOpenUrl: vi.fn(),
  handleDeleteUrl: vi.fn(),
  handleAddUrl: vi.fn(),
  handleCreateProject: vi.fn(),
  handleDeleteProject: vi.fn(),
  handleRenameProject: vi.fn(),
  handleAddCategory: vi.fn(),
  handleDeleteCategory: vi.fn(),
  handleRenameCategory: vi.fn(),
  handleSetUrlCategory: vi.fn(),
  handleUpdateCategoryOrder: vi.fn(),
  handleReorderUrls: vi.fn(),
  handleReorderProjects: vi.fn(),
  handleOpenAllUrls: vi.fn(),
  handleMoveUrlBetweenProjects: vi.fn(),
  handleMoveUrlsBetweenCategories: vi.fn(),
  settings: defaultSettings,
  ...overrides,
})

describe('CustomProjectSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dndContextPropsRef.current = {}
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('プロジェクトがない場合は空状態を描画する', () => {
    render(<CustomProjectSection {...createProps({ projects: [] })} />)

    expect(screen.getByText('プロジェクトがありません')).toBeTruthy()
    expect(screen.getByText(/デフォルトプロジェクトが必要です/)).toBeTruthy()
    expect(screen.queryByTestId('dnd-context')).toBeNull()
  })

  it('作成ダイアログで空入力・重複・成功・キャンセルの分岐を処理する', async () => {
    const handleCreateProject = vi.fn()
    render(
      <CustomProjectSection
        {...createProps({
          handleCreateProject,
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'dialog-open' }))
    expect(screen.getByTestId('dialog-content')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => {
      expect(screen.getByText('プロジェクト名を入力してください')).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('プロジェクト名 *'), {
      target: { value: '   ' },
    })

    fireEvent.change(screen.getByLabelText('プロジェクト名 *'), {
      target: { value: 'Project One' },
    })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => {
      expect(
        screen.getByText('そのプロジェクト名は既に使用されています'),
      ).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('プロジェクト名 *'), {
      target: { value: 'New Project' },
    })
    await waitFor(() => {
      expect(
        screen.queryByText('そのプロジェクト名は既に使用されています'),
      ).toBeNull()
    })

    fireEvent.change(screen.getByLabelText('説明（オプション）'), {
      target: { value: 'new desc' },
    })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))

    await waitFor(() => {
      expect(handleCreateProject).toHaveBeenCalledWith(
        'New Project',
        'new desc',
      )
    })
    await waitFor(() => {
      expect(screen.queryByTestId('dialog-content')).toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'dialog-open' }))
    fireEvent.change(screen.getByLabelText('プロジェクト名 *'), {
      target: { value: 'Tmp' },
    })
    fireEvent.change(screen.getByLabelText('説明（オプション）'), {
      target: { value: 'Tmp desc' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    await waitFor(() => {
      expect(screen.queryByTestId('dialog-content')).toBeNull()
    })
  })

  it('プロジェクト名入力で Enter を押すと作成を実行する', async () => {
    const handleCreateProject = vi.fn()
    render(
      <CustomProjectSection
        {...createProps({
          handleCreateProject,
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'dialog-open' }))

    fireEvent.change(screen.getByLabelText('プロジェクト名 *'), {
      target: { value: 'Enter Created Project' },
    })
    fireEvent.change(screen.getByLabelText('説明（オプション）'), {
      target: { value: 'created by enter' },
    })

    fireEvent.keyDown(screen.getByLabelText('プロジェクト名 *'), {
      key: 'Enter',
      code: 'Enter',
    })

    await waitFor(() => {
      expect(handleCreateProject).toHaveBeenCalledWith(
        'Enter Created Project',
        'created by enter',
      )
    })
  })

  it('Enter以外のキーでは送信せず、ダイアログcloseイベントでフォームをリセットする', async () => {
    const handleCreateProject = vi.fn()
    render(
      <CustomProjectSection
        {...createProps({
          handleCreateProject,
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'dialog-open' }))

    fireEvent.change(screen.getByLabelText('プロジェクト名 *'), {
      target: { value: 'Temporary Name' },
    })
    fireEvent.change(screen.getByLabelText('説明（オプション）'), {
      target: { value: 'Temporary Description' },
    })
    fireEvent.keyDown(screen.getByLabelText('プロジェクト名 *'), {
      key: 'Escape',
      code: 'Escape',
    })

    expect(handleCreateProject).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'dialog-close' }))
    fireEvent.click(screen.getByRole('button', { name: 'dialog-open' }))

    await waitFor(() => {
      expect(
        (screen.getByLabelText('プロジェクト名 *') as HTMLInputElement).value,
      ).toBe('')
    })
    expect(
      (screen.getByLabelText('説明（オプション）') as HTMLTextAreaElement)
        .value,
    ).toBe('')
  })

  it('URLドラッグ開始/オーバー/終了でプロジェクト間移動を処理し状態をリセットする', async () => {
    const handleMoveUrlBetweenProjects = vi.fn()
    render(
      <CustomProjectSection
        {...createProps({
          handleMoveUrlBetweenProjects,
        })}
      />,
    )

    await act(async () => {
      dndContextPropsRef.current.onDragStart?.({
        active: {
          data: {
            current: {
              type: 'url',
              url: 'https://a.com',
              projectId: 'project-1',
              title: 'URL A',
            },
          },
        },
      })
    })

    expect(screen.getByText('URL A')).toBeTruthy()
    expect(
      screen
        .getByTestId('project-card-project-1')
        .getAttribute('data-dragged-item'),
    ).toBe('https://a.com')

    await act(async () => {
      dndContextPropsRef.current.onDragOver?.({
        active: { data: { current: { type: 'url' } } },
        over: { data: { current: { projectId: 'project-1' } } },
      })
    })
    expect(
      screen
        .getByTestId('project-card-project-2')
        .getAttribute('data-drop-target'),
    ).toBe('false')

    await act(async () => {
      dndContextPropsRef.current.onDragOver?.({
        active: { data: { current: { type: 'url' } } },
        over: { data: { current: { projectId: 'project-2' } } },
      })
    })
    expect(
      screen
        .getByTestId('project-card-project-2')
        .getAttribute('data-drop-target'),
    ).toBe('true')

    await act(async () => {
      dndContextPropsRef.current.onDragEnd?.({
        active: {
          id: 'https://a.com',
          data: { current: { type: 'url', projectId: 'project-1' } },
        },
        over: {
          data: { current: { type: 'project', projectId: 'project-2' } },
        },
      })
    })

    expect(handleMoveUrlBetweenProjects).toHaveBeenCalledWith(
      'project-1',
      'project-2',
      'https://a.com',
    )
    expect(screen.queryByText('URL A')).toBeNull()
    expect(
      screen
        .getByTestId('project-card-project-2')
        .getAttribute('data-drop-target'),
    ).toBe('false')
  })

  it('プロジェクトドラッグの順序変更を処理し、無効ケースでは何もしない', () => {
    const handleReorderProjects = vi.fn()
    render(
      <CustomProjectSection
        {...createProps({
          handleReorderProjects,
        })}
      />,
    )

    act(() => {
      dndContextPropsRef.current.onDragStart?.({
        active: {
          data: { current: { type: 'project', projectId: 'project-1' } },
        },
      })
    })
    expect(screen.getAllByText('Project One').length).toBe(2)
    expect(screen.getByText('Desc 1')).toBeTruthy()

    act(() => {
      dndContextPropsRef.current.onDragEnd?.({
        active: {
          id: 'project-1',
          data: { current: { type: 'project' } },
        },
        over: { id: 'project-2' },
      })
    })

    expect(arrayMoveMock).toHaveBeenCalledWith(['project-1', 'project-2'], 0, 1)
    expect(handleReorderProjects).toHaveBeenCalledWith([
      'project-2',
      'project-1',
    ])

    act(() => {
      dndContextPropsRef.current.onDragEnd?.({
        active: { id: 'project-1', data: { current: { type: 'project' } } },
        over: { id: 'project-1' },
      })
    })
    expect(handleReorderProjects).toHaveBeenCalledTimes(1)
  })

  it('各種DnDの早期return分岐（dataなし・別タイプ・同一プロジェクト・overなし・handlerなし）を通す', () => {
    render(
      <CustomProjectSection
        {...createProps({
          handleReorderProjects: undefined,
          handleMoveUrlBetweenProjects: undefined,
        })}
      />,
    )

    act(() => {
      dndContextPropsRef.current.onDragStart?.({ active: { data: {} } })
      dndContextPropsRef.current.onDragStart?.({
        active: {
          data: { current: { type: 'project', projectId: 'missing' } },
        },
      })
      dndContextPropsRef.current.onDragStart?.({
        active: {
          data: { current: { type: 'url', url: 'https://untitled.com' } },
        },
      })
      dndContextPropsRef.current.onDragOver?.({
        active: { data: { current: { type: 'project' } } },
        over: { data: { current: { projectId: 'project-2' } } },
      })
      dndContextPropsRef.current.onDragStart?.({
        active: {
          data: {
            current: {
              type: 'url',
              url: 'https://untitled.com',
              projectId: 'project-1',
              title: '',
            },
          },
        },
      })
    })
    expect(
      screen
        .getByTestId('project-card-project-2')
        .getAttribute('data-drop-target'),
    ).toBe('false')

    act(() => {
      dndContextPropsRef.current.onDragEnd?.({
        active: {
          id: 'project-1',
          data: { current: { type: 'project' } },
        },
        over: { id: 'project-2' },
      })

      dndContextPropsRef.current.onDragEnd?.({
        active: {
          id: 'https://same.com',
          data: { current: { type: 'url', projectId: 'project-1' } },
        },
        over: {
          data: { current: { type: 'project', projectId: 'project-1' } },
        },
      })

      dndContextPropsRef.current.onDragEnd?.({
        active: {
          id: 'https://none.com',
          data: { current: { type: 'url', projectId: 'project-1' } },
        },
        over: undefined,
      })

      dndContextPropsRef.current.onDragEnd?.({
        active: {
          id: 'https://x.com',
          data: { current: { type: 'url', projectId: 'project-1' } },
        },
        over: {
          data: { current: { type: 'project', projectId: 'project-2' } },
        },
      })

      dndContextPropsRef.current.onDragEnd?.({
        active: {
          id: 'https://x.com',
          data: { current: { type: 'url', projectId: 'project-1' } },
        },
        over: { data: { current: { type: 'url', projectId: 'project-2' } } },
      })
    })

    expect(screen.queryByText('https://x.com')).toBeNull()
  })
})
