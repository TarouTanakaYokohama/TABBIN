import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'
import { mergeConfig } from 'vite'

const dirname = fileURLToPath(new URL('.', import.meta.url))

export default {
  stories: [
    '../components/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../features/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: ['@chromatic-com/storybook', '@storybook/addon-vitest'],
  refs: {},
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: false,
  },
  viteFinal: async config =>
    mergeConfig(config, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(dirname, '..'),
        },
      },
    }),
} satisfies StorybookConfig
