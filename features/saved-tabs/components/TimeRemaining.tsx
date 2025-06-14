import type { CategorySectionProps } from '@/types/saved-tabs'
import type { TabGroup } from '@/types/storage'
import type { DragEndEvent } from '@dnd-kit/core'
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
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableUrlItem } from './SortableUrlItem'

// 新しく追加: カテゴリセクションコンポーネント
export const CategorySection = ({
  categoryName,
  urls = [],
  groupId,
  handleDeleteUrl,
  handleOpenTab,
  handleUpdateUrls,
  settings,
}: CategorySectionProps) => {
  // DnDのセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // カテゴリ内でのドラッグ&ドロップハンドラ
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // このカテゴリ内のURLsを取得
      const { savedTabs = [] } = await chrome.storage.local.get('savedTabs')
      const currentGroup = savedTabs.find(
        (group: TabGroup) => group.id === groupId,
      )

      if (!currentGroup) return

      // 現在のグループのすべてのURLを取得
      const allUrls = [...currentGroup.urls]

      // ドラッグ元とドラッグ先のインデックスを特定
      const oldIndex = allUrls.findIndex(item => item.url === active.id)
      const newIndex = allUrls.findIndex(item => item.url === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        // 並び替えた新しい配列を作成
        const newUrls = arrayMove(allUrls, oldIndex, newIndex)

        // 親コンポーネント経由でストレージに保存
        handleUpdateUrls(groupId, newUrls)
      }
    }
  }

  // 表示名を設定

  return (
    <div className='category-section mb-1'>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        id={`category-${categoryName}-${groupId}`}
      >
        <SortableContext
          items={urls.map(item => item.url)}
          strategy={verticalListSortingStrategy}
        >
          <ul className='space-y-0.5'>
            {urls.map(item => (
              <SortableUrlItem
                key={item.url}
                url={item.url}
                title={item.title}
                id={item.url}
                groupId={groupId}
                subCategory={item.subCategory}
                savedAt={item.savedAt}
                autoDeletePeriod={settings.autoDeletePeriod}
                handleDeleteUrl={handleDeleteUrl}
                handleOpenTab={handleOpenTab}
                handleUpdateUrls={handleUpdateUrls}
                categoryContext={`category-${categoryName}-${groupId}`}
                settings={settings}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}
