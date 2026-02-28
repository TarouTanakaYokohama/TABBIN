// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomProjectCardProps } from '@/features/saved-tabs/types/CustomProjectCard.types'
import type { UserSettings } from '@/types/storage'

const {
  useSortableMock,
  useDroppableMock,
  projectDragListenerMock,
  useCustomProjectCardMock,
  registerHandlersMock,
  unregisterHandlersMock,
} = vi.hoisted(() => ({
  useSortableMock: vi.fn(),
  useDroppableMock: vi.fn(),
  projectDragListenerMock: vi.fn(),
  useCustomProjectCardMock: vi.fn(),
  registerHandlersMock: vi.fn(),
  unregisterHandlersMock: vi.fn(),
}))

vi.mock('@dnd-kit/sortable', () => ({
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: useSortableMock,
}))

vi.mock('@dnd-kit/core', () => ({
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useDroppable: useDroppableMock,
  useSensor: vi.fn(() => 'sensor'),
  useSensors: vi.fn(() => ['sensor']),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid='card' {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='card-content'>{children}</div>
  ),
  CardHeader: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid='card-header' {...props}>
      {children}
    </div>
  ),
}))

vi.mock('../../hooks/useCustomProjectCard', () => ({
  useCustomProjectCard: useCustomProjectCardMock,
}))

vi.mock('./ProjectCardContext', () => ({
  ProjectCardContext: ({
    children,
  }: {
    children: React.ReactNode
    value: unknown
  }) => <>{children}</>,
}))

vi.mock('../../contexts/DragHandlersContext', () => ({
  useDragHandlers: () => ({
    registerHandlers: registerHandlersMock,
    unregisterHandlers: unregisterHandlersMock,
  }),
}))

import { ProjectCardRoot } from './ProjectCardRoot'

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

const createProps = (overrides?: Partial<CustomProjectCardProps>) => {
  const project: CustomProjectCardProps['project'] = {
    id: 'project-1',
    name: 'Project A',
    description: 'Project Description',
    categories: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides?.project,
  }

  return {
    project,
    settings: defaultSettings,
    handlers: {
      handleOpenUrl: vi.fn(),
      handleDeleteUrl: vi.fn(),
      handleAddCategory: vi.fn(),
      handleDeleteCategory: vi.fn(),
      handleRenameCategory: vi.fn(),
      handleSetUrlCategory: vi.fn(),
      handleOpenAllUrls: vi.fn(),
    },
    hookHandlers: {
      handleDeleteUrl: vi.fn(),
      handleSetUrlCategory: vi.fn(),
      handleUpdateCategoryOrder: vi.fn(),
      handleReorderUrls: vi.fn(),
    },
    draggedItem: overrides?.draggedItem,
    isDropTarget: overrides?.isDropTarget,
    isProjectReorderMode: overrides?.isProjectReorderMode,
  }
}

const createHookState = (params?: {
  isLoadingUrls?: boolean
  projectUrlsLength?: number
  isDraggingCategory?: boolean
}) => ({
  urls: {
    projectUrls: Array.from({ length: params?.projectUrlsLength ?? 0 }, () => ({
      url: 'https://example.com',
      title: 'Example',
    })),
    setProjectUrls: vi.fn(),
    isLoadingUrls: params?.isLoadingUrls ?? false,
    uncategorizedUrls: [],
  },
  dnd: {
    collisionDetectionStrategy: vi.fn(),
    isDraggingCategory: params?.isDraggingCategory ?? false,
    draggedCategoryName: null,
    activeId: null,
    draggedOverCategory: null,
    setDraggedOverCategory: vi.fn(),
    setActiveId: vi.fn(),
    handleDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleUrlDragEnd: vi.fn(),
    handleCategoryDragEnd: vi.fn(),
  },
  categoryOrder: [],
})

describe('ProjectCardRoot', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useSortableMock.mockReturnValue({
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
      attributes: {
        'data-sortable-attr': 'project',
      },
      listeners: {
        onPointerDown: projectDragListenerMock,
      },
    })

    useDroppableMock.mockReturnValue({
      setNodeRef: vi.fn(),
      isOver: false,
    })

    useCustomProjectCardMock.mockReturnValue(createHookState())
  })

  afterEach(() => {
    cleanup()
  })

  it('プロジェクト名とドラッグハンドルを表示し、DnD コールバックを呼び出す', () => {
    const props = createProps()
    const hookState = createHookState()
    useCustomProjectCardMock.mockReturnValue(hookState)

    render(
      <ProjectCardRoot {...props}>
        <div>children</div>
      </ProjectCardRoot>,
    )

    expect(screen.getByText('Project A')).toBeTruthy()
    expect(screen.getByText('Project Description')).toBeTruthy()

    // 以前はbutton要素でしたが、CardGroupTitle内でdiv要素に変更され、
    // aria-labelなどは付与されていないため、親の attributes から取得した属性で検証します
    const dragHandle = screen
      .getByText('Project A')
      .closest('div[data-sortable-attr="project"]')
    expect(dragHandle).toBeTruthy()
    if (dragHandle) {
      fireEvent.pointerDown(dragHandle)
    }
    expect(projectDragListenerMock).toHaveBeenCalled()

    expect(registerHandlersMock).toHaveBeenCalledWith(
      props.project.id,
      expect.objectContaining({
        handleDragOver: hookState.dnd.handleDragOver,
        handleUrlDragEnd: hookState.dnd.handleUrlDragEnd,
      }),
    )
  })

  it('カテゴリ並び替え中は handleCategoryDragEnd を呼ぶためのハンドラが登録される', () => {
    const props = createProps()
    const hookState = createHookState({
      isDraggingCategory: true,
    })
    useCustomProjectCardMock.mockReturnValue(hookState)

    render(
      <ProjectCardRoot {...props}>
        <div>children</div>
      </ProjectCardRoot>,
    )

    expect(registerHandlersMock).toHaveBeenCalledWith(
      props.project.id,
      expect.objectContaining({
        handleCategoryDragEnd: hookState.dnd.handleCategoryDragEnd,
      }),
    )
  })

  it('外部アイテムのドロップ誘導・ローディング表示・空状態の分岐を描画する', () => {
    useDroppableMock
      .mockReturnValueOnce({
        setNodeRef: vi.fn(),
        isOver: true,
      })
      .mockReturnValueOnce({
        setNodeRef: vi.fn(),
        isOver: true,
      })
    useCustomProjectCardMock.mockReturnValue(
      createHookState({
        isLoadingUrls: true,
      }),
    )

    render(
      <ProjectCardRoot
        {...createProps({
          draggedItem: {
            url: 'https://external.example.com',
            title: 'External URL',
            projectId: 'project-2',
          },
          isDropTarget: true,
        })}
      >
        <div>children</div>
      </ProjectCardRoot>,
    )

    expect(screen.getByText('をここにドロップして追加')).toBeTruthy()
    expect(screen.getByText('URLを読み込み中...')).toBeTruthy()
    expect(
      screen.queryByText('このプロジェクトにはURLがありません。'),
    ).toBeNull()
  })

  it('ドラッグ中スタイルと外部ドロップ誘導のタイトルfallbackを表示する', () => {
    useSortableMock.mockReturnValueOnce({
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: true,
      attributes: {},
      listeners: {},
    })
    useDroppableMock
      .mockReturnValueOnce({
        setNodeRef: vi.fn(),
        isOver: true,
      })
      .mockReturnValueOnce({
        setNodeRef: vi.fn(),
        isOver: false,
      })
    useCustomProjectCardMock.mockReturnValue(
      createHookState({
        isLoadingUrls: false,
      }),
    )

    render(
      <ProjectCardRoot
        {...createProps({
          draggedItem: {
            url: 'https://fallback.example.com',
            title: '',
            projectId: 'project-2',
          },
          isDropTarget: true,
        })}
      >
        <div>children</div>
      </ProjectCardRoot>,
    )

    expect(screen.getByTestId('card').style.opacity).toBe('0.5')
    expect(screen.getByText('URL')).toBeTruthy()
  })

  it('プロジェクト並び替えモードではカテゴリ表示を折りたたむ', () => {
    render(
      <ProjectCardRoot
        {...createProps({
          isProjectReorderMode: true,
        })}
      >
        <div>children</div>
      </ProjectCardRoot>,
    )

    expect(
      screen.getByText(/並び替え中のためカテゴリを折りたたんでいます/),
    ).toBeTruthy()
    expect(screen.queryByText('children')).toBeNull()
  })
})
