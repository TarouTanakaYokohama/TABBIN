import { describe, expect, it } from 'vitest'
import { formatLocalizedDate } from './date-format'

describe('formatLocalizedDate', () => {
  it('ja では日本語の年月日形式で返す', () => {
    expect(formatLocalizedDate('ja', '2026-03-14')).toBe('2026年3月14日')
  })

  it('en では英語の月日形式で返す', () => {
    expect(formatLocalizedDate('en', '2026-03-14')).toBe('March 14, 2026')
  })
})
