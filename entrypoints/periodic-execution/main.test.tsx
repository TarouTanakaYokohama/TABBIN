// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { redirectToApp } from './main'

describe('periodic-execution legacy redirect', () => {
  it('periodic-execution.html から app.html の route へ redirect する', () => {
    const replace = vi.fn()

    expect(redirectToApp('/periodic-execution.html', '', replace)).toBe(
      'app.html#/periodic-execution',
    )
    expect(replace).toHaveBeenCalledWith('app.html#/periodic-execution')
  })
})
