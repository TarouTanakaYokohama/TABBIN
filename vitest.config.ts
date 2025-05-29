import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing'

export default defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    environment: 'node',
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
