// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { redirectToApp } from './main'

describe('ai-chat legacy redirect', () => {
  it('ai-chat.html から app.html の ai-chat route へ redirect する', () => {
    const replace = vi.fn()

    expect(redirectToApp('/ai-chat.html', '', replace)).toBe(
      'app.html#/ai-chat',
    )
    expect(replace).toHaveBeenCalledWith('app.html#/ai-chat')
  })
})
