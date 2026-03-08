import { describe, expect, it } from 'vitest'
import {
  getPageHref,
  getSavedTabsHrefForMode,
  getSavedTabsModeFromLocation,
  getSidebarStateFromLocation,
} from './pageNavigation'

describe('pageNavigation', () => {
  it('saved-tabs の mode クエリを解釈する', () => {
    expect(getSavedTabsModeFromLocation('?mode=custom')).toBe('custom')
    expect(getSavedTabsModeFromLocation('?mode=domain')).toBe('domain')
    expect(getSavedTabsModeFromLocation('?mode=invalid')).toBe('domain')
    expect(getSavedTabsModeFromLocation('')).toBe('domain')
  })

  it('location から現在のサイドバー状態を判定する', () => {
    expect(
      getSidebarStateFromLocation('/saved-tabs.html', '?mode=custom'),
    ).toEqual({
      expandedGroup: 'tab-list',
      item: 'saved-tabs-custom',
    })

    expect(getSidebarStateFromLocation('/ai-chat.html', '')).toEqual({
      expandedGroup: 'tab-list',
      item: 'ai-chat',
    })

    expect(getSidebarStateFromLocation('/periodic-execution.html', '')).toEqual(
      {
        expandedGroup: 'tab-list',
        item: 'periodic-execution',
      },
    )
  })

  it('各ページへの href を組み立てる', () => {
    expect(getPageHref('ai-chat')).toBe('ai-chat.html')
    expect(getPageHref('periodic-execution')).toBe('periodic-execution.html')
    expect(getPageHref('saved-tabs-domain')).toBe('saved-tabs.html?mode=domain')
    expect(getPageHref('saved-tabs-custom')).toBe('saved-tabs.html?mode=custom')
  })

  it('saved-tabs の href を mode に合わせて差し替える', () => {
    expect(getSavedTabsHrefForMode('domain')).toBe(
      'saved-tabs.html?mode=domain',
    )
    expect(getSavedTabsHrefForMode('custom')).toBe(
      'saved-tabs.html?mode=custom',
    )
  })
})
