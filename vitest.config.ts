import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing'

export default defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    environment: 'node',
    include: [
      'src/entrypoints/**/*.test.ts',
      'src/components/**/*.test.ts',
      'src/components/**/*.test.tsx',
      'src/features/**/*.test.ts',
      'src/features/**/*.test.tsx',
      'src/hooks/**/*.test.ts',
      'src/hooks/**/*.test.tsx',
      'src/lib/**/*.test.ts',
      'src/lib/**/*.test.tsx',
      'src/utils/**/*.test.ts',
      'src/utils/**/*.test.tsx',
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
