import '@wxt-dev/module-react'
import tailwindcss from '@tailwindcss/vite'
import { type WxtViteConfig, defineConfig } from 'wxt'

const vitePlugins = tailwindcss() as unknown as NonNullable<
  WxtViteConfig['plugins']
>

export default defineConfig({
  manifest: {
    name: 'TABBIN',
    description:
      'ブラウザのタブを整理・分類する拡張機能です。散らかりがちなタブを管理できます。',
    version: '2.0.2',
    host_permissions: [
      'http://localhost:11434/*',
      'http://127.0.0.1:11434/*',
    ],
    permissions: ['alarms', 'tabs', 'storage', 'contextMenus', 'notifications'],
    action: {
      default_title: 'TABBIN',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
  },
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: vitePlugins,
  }),
})
