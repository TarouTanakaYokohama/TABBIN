// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { redirectToApp } from './main'

describe('saved-tabs legacy redirect', () => {
  it('saved-tabs.html から mode を維持して app.html へ redirect する', () => {
    const replace = vi.fn()

    expect(redirectToApp('/saved-tabs.html', '?mode=custom', replace)).toBe(
      'app.html#/saved-tabs?mode=custom',
    )
    expect(replace).toHaveBeenCalledWith('app.html#/saved-tabs?mode=custom')
  })

  it('不正な mode は domain として redirect する', () => {
    const replace = vi.fn()

    expect(redirectToApp('/saved-tabs.html', '?mode=invalid', replace)).toBe(
      'app.html#/saved-tabs?mode=domain',
    )
    expect(replace).toHaveBeenCalledWith('app.html#/saved-tabs?mode=domain')
  })
})
