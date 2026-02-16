import { describe, expect, it } from 'vitest'
import { isPeriodShortening } from './isPeriodShortening'

describe('isPeriodShortening additional cases', () => {
  it('handles second and minute durations', () => {
    expect(isPeriodShortening('1min', '30sec')).toBe(true)
    expect(isPeriodShortening('30sec', '1min')).toBe(false)
  })

  it('handles longer duration mappings', () => {
    expect(isPeriodShortening('30days', '14days')).toBe(true)
    expect(isPeriodShortening('365days', '180days')).toBe(true)
    expect(isPeriodShortening('180days', '365days')).toBe(false)
  })
})
