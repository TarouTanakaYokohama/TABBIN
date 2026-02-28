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
import { useEffect, useState } from 'react'
import { reorderTabGroupUrls } from '@/lib/storage/tabs'
import type { CategorySectionProps } from '@/types/saved-tabs'
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
  const [displayUrls, setDisplayUrls] = useState(urls)

  useEffect(() => {
    setDisplayUrls(urls)
  }, [urls])

  // DnDのセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // カテゴリ内でのドラッグ&ドロップハンドラ（新形式対応）
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      // 現在のURL配列から新しい順序を作成
      const oldIndex = displayUrls.findIndex(item => item.url === active.id)
      const newIndex = displayUrls.findIndex(item => item.url === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        // 並び替えた新しい配列を作成
        const previousUrls = displayUrls
        const newUrls = arrayMove(displayUrls, oldIndex, newIndex)

        // 保存完了を待たずに先に表示を更新し、スナップバックを防ぐ
        setDisplayUrls(newUrls)

        try {
          // 新形式のURL並び替え関数を呼び出し
          await reorderTabGroupUrls(
            groupId,
            newUrls.map(item => item.url),
          )

          // 親コンポーネントに通知してUIを更新
          handleUpdateUrls(groupId, newUrls)
        } catch (error) {
          console.error('URL順序の保存に失敗しました:', error)
          setDisplayUrls(previousUrls)
        }
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
          items={displayUrls.map(item => item.url)}
          strategy={verticalListSortingStrategy}
        >
          <ul className='space-y-0.5'>
            {displayUrls.map(item => (
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
