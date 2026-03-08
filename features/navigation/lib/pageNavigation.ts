import type { ViewMode } from '@/types/storage'

type SidebarItemId =
  | 'ai-chat'
  | 'periodic-execution'
  | 'saved-tabs-domain'
  | 'saved-tabs-custom'

interface SidebarState {
  expandedGroup: 'tab-list'
  item: SidebarItemId
}

const getNormalizedPathname = (pathname: string): string => {
  const parts = pathname.split('/')
  return parts.at(-1) || 'saved-tabs.html'
}

const getSavedTabsModeFromLocation = (search: string): ViewMode => {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')

  return mode === 'custom' ? 'custom' : 'domain'
}

const getSidebarStateFromLocation = (
  pathname: string,
  search: string,
): SidebarState => {
  const normalizedPathname = getNormalizedPathname(pathname)

  if (normalizedPathname === 'ai-chat.html') {
    return {
      expandedGroup: 'tab-list',
      item: 'ai-chat',
    }
  }

  if (normalizedPathname === 'periodic-execution.html') {
    return {
      expandedGroup: 'tab-list',
      item: 'periodic-execution',
    }
  }

  return {
    expandedGroup: 'tab-list',
    item:
      getSavedTabsModeFromLocation(search) === 'custom'
        ? 'saved-tabs-custom'
        : 'saved-tabs-domain',
  }
}

const getPageHref = (item: SidebarItemId): string => {
  switch (item) {
    case 'ai-chat':
      return 'ai-chat.html'
    case 'periodic-execution':
      return 'periodic-execution.html'
    case 'saved-tabs-custom':
      return 'saved-tabs.html?mode=custom'
    case 'saved-tabs-domain':
      return 'saved-tabs.html?mode=domain'
  }
}

const getSavedTabsHrefForMode = (mode: ViewMode): string =>
  getPageHref(mode === 'custom' ? 'saved-tabs-custom' : 'saved-tabs-domain')

export type { SidebarItemId, SidebarState }
export {
  getPageHref,
  getSavedTabsHrefForMode,
  getSavedTabsModeFromLocation,
  getSidebarStateFromLocation,
}
