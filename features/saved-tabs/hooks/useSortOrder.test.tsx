// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSortOrder } from './useSortOrder'

type Item = { domain: string }

const items: Item[] = [
  { domain: 'zeta.example.com' },
  { domain: 'alpha.example.com' },
  { domain: 'beta.example.com' },
]

describe('useSortOrder', () => {
  it('returns original order by default', () => {
    const { result } = renderHook(() =>
      useSortOrder(items, item => item.domain),
    )

    expect(result.current.sortOrder).toBe('default')
    expect(result.current.sortedItems).toEqual(items)
  })

  it('sorts ascending when sortOrder is asc', () => {
    const { result } = renderHook(() =>
      useSortOrder(items, item => item.domain),
    )

    act(() => {
      result.current.setSortOrder('asc')
    })

    expect(result.current.sortedItems.map(item => item.domain)).toEqual([
      'alpha.example.com',
      'beta.example.com',
      'zeta.example.com',
    ])
  })

  it('sorts descending when sortOrder is desc', () => {
    const { result } = renderHook(() =>
      useSortOrder(items, item => item.domain),
    )

    act(() => {
      result.current.setSortOrder('desc')
    })

    expect(result.current.sortedItems.map(item => item.domain)).toEqual([
      'zeta.example.com',
      'beta.example.com',
      'alpha.example.com',
    ])
  })
})
