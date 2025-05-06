// filepath: features/saved-tabs/hooks/useSortOrder.ts
import { useMemo, useState } from 'react'

/**
 * ソート順とソート済みリストを管理するカスタムフック
 * @param items ソート対象の配列
 * @param getKey ソートキー取得関数（例: item => item.domain）
 */
export function useSortOrder<T>(items: T[], getKey: (item: T) => string) {
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>(
    'default',
  )

  const sortedItems = useMemo(() => {
    if (sortOrder === 'default') return items
    const arr = [...items]
    arr.sort((a, b) => getKey(a).localeCompare(getKey(b)))
    if (sortOrder === 'desc') arr.reverse()
    return arr
  }, [items, sortOrder, getKey])

  return { sortOrder, setSortOrder, sortedItems }
}
