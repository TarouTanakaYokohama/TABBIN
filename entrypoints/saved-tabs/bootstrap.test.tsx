// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  createRoot: vi.fn(),
  handleSavedTabsRender: vi.fn(),
  renderRoot: vi.fn(),
  savedTabsProfileEnabled: false,
}))

vi.mock('react-dom/client', () => ({
  createRoot: mocked.createRoot,
}))

vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@/features/ai-chat/components/SavedTabsChatWidget', () => ({
  SavedTabsChatWidget: () => createElement('div', null, 'SavedTabsChatWidget'),
}))

vi.mock('@/features/saved-tabs/app/SavedTabsApp', () => ({
  SavedTabsApp: () => createElement('div', null, 'SavedTabsApp'),
  handleSavedTabsRender: mocked.handleSavedTabsRender,
  get isDevProfileEnabled() {
    return mocked.savedTabsProfileEnabled
  },
}))

const importModule = async () => {
  vi.resetModules()
  mocked.createRoot.mockReturnValue({
    render: mocked.renderRoot,
  })
  return import('./main')
}

describe('saved-tabs bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dev profile 有効時も SavedTabsPage を描画できる', async () => {
    mocked.savedTabsProfileEnabled = true
    const { SavedTabsPage } = await importModule()

    render(createElement(SavedTabsPage))

    expect(screen.getByText('SavedTabsApp')).toBeTruthy()
    expect(screen.getByText('SavedTabsChatWidget')).toBeTruthy()
  })

  it('DOMContentLoaded で app 要素へ render する', async () => {
    let domReadyHandler: EventListener | undefined

    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      callback: EventListenerOrEventListenerObject | null,
    ) => {
      if (type === 'DOMContentLoaded' && typeof callback === 'function') {
        domReadyHandler = callback
      }
    }) as typeof document.addEventListener)

    await importModule()
    document.body.innerHTML = '<div id="app"></div>'
    domReadyHandler?.(new Event('DOMContentLoaded'))

    expect(mocked.createRoot).toHaveBeenCalledWith(
      document.getElementById('app'),
    )
    expect(mocked.renderRoot).toHaveBeenCalledTimes(1)
  })

  it('app 要素が無ければ例外を投げる', async () => {
    let domReadyHandler: EventListener | undefined

    vi.spyOn(document, 'addEventListener').mockImplementation(((
      type: string,
      callback: EventListenerOrEventListenerObject | null,
    ) => {
      if (type === 'DOMContentLoaded' && typeof callback === 'function') {
        domReadyHandler = callback
      }
    }) as typeof document.addEventListener)

    await importModule()

    expect(() => domReadyHandler?.(new Event('DOMContentLoaded'))).toThrow(
      'Failed to find the app container',
    )
  })
})
