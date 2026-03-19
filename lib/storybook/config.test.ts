// @vitest-environment node
import { describe, expect, it } from 'vitest'
import mainConfig from '../../.storybook/main'

describe('Storybook main config', () => {
  it('discovers real component and feature stories', () => {
    expect(mainConfig.stories).toEqual(
      expect.arrayContaining([
        '../components/**/*.stories.@(js|jsx|mjs|ts|tsx)',
        '../features/**/*.stories.@(js|jsx|mjs|ts|tsx)',
      ]),
    )
  })
})
