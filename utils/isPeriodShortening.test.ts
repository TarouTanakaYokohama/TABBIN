import { describe, expect, it } from 'vitest'
import { isPeriodShortening } from './isPeriodShortening'

describe('isPeriodShortening', () => {
  it('treats change from never as shortening', () => {
    expect(isPeriodShortening('never', '30days')).toBe(true)
  })

  it('treats change to never as not shortening', () => {
    expect(isPeriodShortening('30days', 'never')).toBe(false)
  })

  it('returns true when new period is shorter', () => {
    expect(isPeriodShortening('30days', '7days')).toBe(true)
    expect(isPeriodShortening('1day', '1hour')).toBe(true)
  })

  it('returns false when new period is same or longer', () => {
    expect(isPeriodShortening('7days', '7days')).toBe(false)
    expect(isPeriodShortening('1hour', '1day')).toBe(false)
  })

  it('handles unknown values safely', () => {
    expect(isPeriodShortening('unknown', '1day')).toBe(true)
    expect(isPeriodShortening('1day', 'unknown')).toBe(false)
  })
})
