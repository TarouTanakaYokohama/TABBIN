import { Button } from '@/components/ui/button'
import type { SortableUrlItemProps } from '@/types/saved-tabs'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

// URL項目用のソータブルコンポーネント - 型定義を修正
export const SortableUrlItem = ({
  url,
  title,
  id,
  groupId,
  savedAt,
  autoDeletePeriod,
  handleDeleteUrl,
  handleOpenTab,
  categoryContext,
  settings,
}: SortableUrlItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      data: {
        categoryContext, // カテゴリコンテキストをデータに追加
      },
    })

  const [isDragging, setIsDragging] = useState(false)
  const [leftWindow, setLeftWindow] = useState(false)
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isDeleteButtonVisible, setIsDeleteButtonVisible] = useState(false)
  const buttonTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ドラッグが開始されたとき
  const handleDragStart = (e: React.DragEvent<HTMLElement>, url: string) => {
    setIsDragging(true)
    setLeftWindow(false)
    // URLをテキストとして設定
    e.dataTransfer.setData('text/plain', url)
    // URI-listとしても設定（多くのブラウザやアプリがこのフォーマットを認識）
    e.dataTransfer.setData('text/uri-list', url)

    console.log('ドラッグ開始:', url)

    // ドキュメント全体のmouseleaveイベントを監視
    document.addEventListener('mouseleave', handleMouseLeave)

    // ドラッグ開始をバックグラウンドに通知
    chrome.runtime.sendMessage(
      {
        action: 'urlDragStarted',
        url: url,
        groupId: groupId,
      },
      response => {
        console.log('ドラッグ開始通知の応答:', response)
      },
    )
  }

  // 外部ウィンドウへのドロップ処理
  const handleExternalDrop = useCallback(() => {
    // 外部へのドロップ時にタブを削除するよう通知
    chrome.runtime.sendMessage(
      {
        action: 'urlDropped',
        url: url,
        groupId: groupId,
        fromExternal: true,
      },
      response => {
        console.log('外部ドロップ後の応答:', response)
      },
    )
  }, [url, groupId])

  const handleDragEnd = (e: React.DragEvent<HTMLElement>) => {
    // リスナーをクリーンアップ
    document.removeEventListener('mouseleave', handleMouseLeave)

    // タイムアウトをクリア
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current)
      dragTimeoutRef.current = null
    }

    setIsDragging(false)
    console.log('ドラッグ終了:', e.dataTransfer.dropEffect)

    // 内部で完了した場合は、leftWindowフラグをリセット
    setLeftWindow(false)
  }

  // マウスリーブハンドラをメモ化
  const handleMouseLeave = useCallback(() => {
    // マウスがウィンドウを出たことを記録
    setLeftWindow(true)
    console.log('マウスがウィンドウから出ました')

    // windowに戻ってこなければ、タイムアウト後に外部ウィンドウへのドロップと判定
    if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current)
    // ドラッグの外部ウィンドウタイムアウト検出（1秒）
    dragTimeoutRef.current = setTimeout(() => {
      if (isDragging && leftWindow) {
        console.log('外部ウィンドウへのドラッグを検出:', url)
        handleExternalDrop()
      }
    }, 1000)
  }, [isDragging, leftWindow, url, handleExternalDrop])

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current)
      }
    }
  }, [handleMouseLeave])

  // マウスイベントの処理を改善
  const handleMouseEnter = () => {
    setIsDeleteButtonVisible(true)
    // タイマーをクリア
    if (buttonTimeoutRef.current) {
      clearTimeout(buttonTimeoutRef.current)
      buttonTimeoutRef.current = null
    }
  }

  const handleUIMouseLeave = () => {
    // ボタンの非表示を少し遅らせて、ボタンへのマウス移動を可能にする
    // 削除ボタンの遅延非表示（300ms）
    buttonTimeoutRef.current = setTimeout(() => {
      setIsDeleteButtonVisible(false)
    }, 300)
  }

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    return () => {
      if (buttonTimeoutRef.current) {
        clearTimeout(buttonTimeoutRef.current)
      }
    }
  }, [])

  // 削除ボタンのマウスイベント処理
  const handleDeleteButtonMouseEnter = () => {
    // タイマーをクリアして非表示にならないようにする
    if (buttonTimeoutRef.current) {
      clearTimeout(buttonTimeoutRef.current)
      buttonTimeoutRef.current = null
    }
    setIsDeleteButtonVisible(true)
  }

  const handleDeleteButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (
      !settings.confirmDeleteEach ||
      window.confirm('このURLを削除しますか？')
    ) {
      handleDeleteUrl(groupId, url)
    }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className='relative flex items-center overflow-hidden pb-1 last:border-0 last:pb-0'
      data-category-context={categoryContext} // カテゴリコンテキストをdata属性に追加
    >
      <div
        className='z-10 flex-shrink-0 cursor-grab px-2.5 text-muted-foreground/40 hover:cursor-grab active:cursor-grabbing'
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden='true' />
      </div>
      <div className='relative min-w-0 flex-1'>
        <Button
          asChild
          variant='ghost'
          size='sm'
          className='ml-2 flex h-full cursor-pointer items-center justify-start gap-1 overflow-hidden bg-transparent px-1 py-2 pr-8 text-foreground hover:text-foreground'
        >
          <a
            href={url as string}
            target='_blank'
            rel='noopener noreferrer'
            draggable
            onDragStart={e => handleDragStart(e, url as string)}
            onDragEnd={handleDragEnd}
            onClick={e => {
              e.preventDefault()
              handleOpenTab(url)
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleUIMouseLeave}
          >
            <div className='flex w-full flex-col truncate'>
              <span className='truncate'>{title}</span>
              {/* 保存日時と残り時間を表示 - settings.showSavedTime に基づき条件分岐 */}
              {savedAt && (
                <div className='flex items-center gap-2 text-xs'>
                  {settings.showSavedTime && (
                    <span className='text-muted-foreground'>
                      {formatDatetime(savedAt)}
                    </span>
                  )}
                  {autoDeletePeriod && autoDeletePeriod !== 'never' && (
                    <TimeRemaining
                      savedAt={savedAt}
                      autoDeletePeriod={autoDeletePeriod}
                    />
                  )}
                </div>
              )}
            </div>
          </a>
        </Button>
        {isDeleteButtonVisible && (
          <Button
            variant='ghost'
            size='icon'
            onClick={handleDeleteButtonClick}
            onMouseEnter={handleDeleteButtonMouseEnter}
            className='absolute top-0 right-0 bottom-0 my-auto flex-shrink-0 cursor-pointer'
            title='タブを削除'
            aria-label='タブを削除'
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </li>
  )
}
