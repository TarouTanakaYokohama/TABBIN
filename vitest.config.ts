import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing'

export default defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    environment: 'node',
    include: [
      'entrypoints/**/*.test.ts',
      'components/**/*.test.ts',
      'components/**/*.test.tsx',
      'features/**/*.test.ts',
      'features/**/*.test.tsx',
      'hooks/**/*.test.ts',
      'hooks/**/*.test.tsx',
      'lib/**/*.test.ts',
      'lib/**/*.test.tsx',
      'utils/**/*.test.ts',
      'utils/**/*.test.tsx',
    ],
    exclude: [
      '**/node_modules/**',
      '**/stories/**',
      '**/*.stories.ts',
      '.storybook/**',
    ],
    typecheck: {
      enabled: false,
    },
  },

  plugins: [WxtVitest()],
  optimizeDeps: {
    exclude: ['lightningcss', 'fsevents'],
  },
})
