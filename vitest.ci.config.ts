import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'jsdom',
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
      '**/dist/**',
      '**/e2e/**',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'tests/**',
      'tests-examples/**',
      'storybook-static/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './'),
    },
  },
})
