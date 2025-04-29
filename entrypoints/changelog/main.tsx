import '@/assets/global.css'
import { Card } from '@/components/ui/card'
import { Check } from 'lucide-react'
import type React from 'react'
import { createRoot } from 'react-dom/client'

interface ChangelogFeature {
  text: string
  highlight?: boolean
}

interface ChangelogItem {
  version: string
  date: string
  features: ChangelogFeature[]
}

const CHANGELOG: ChangelogItem[] = [
  {
    version: '1.1.0',
    date: '2025年4月29日',
    features: [
      { text: 'デザインの修正' },
      { text: 'preview版のカスタムモードの実装' },
      { text: '検索機能' },
      { text: 'オプションで、URLやカテゴリの削除前に確認を行う機能を追加' },
      { text: 'ドメインやカテゴリを閉じることができる機能' },
      { text: '登録日時によって昇順・降順に並び替え' },
      { text: 'バックグラウンドタブで開く機能' },
      { text: '他軽微な修正' },
    ],
  },
  {
    version: '1.0.0',
    date: '2025年3月21日',
    features: [{ text: '初回リリース' }],
  },
]

const App: React.FC = () => (
  <div className='min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8'>
    <div className='max-w-3xl mx-auto'>
      <div className='text-center mb-12'>
        <h1 className='text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl sm:tracking-tight'>
          <span className='block'>リリースノート</span>
        </h1>
      </div>

      <div className='space-y-8'>
        {CHANGELOG.map(item => (
          <Card
            key={item.version}
            className='overflow-hidden shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-300'
          >
            <div className='px-6 py-8 sm:p-10'>
              <div className='flex items-center justify-between'>
                <h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
                  v{item.version}
                </h2>
                <div className='inline-flex px-4 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'>
                  {item.date}
                </div>
              </div>

              <div className='mt-8'>
                <ul className='space-y-4'>
                  {item.features.map(feature => (
                    <li
                      key={`${item.version}-${feature.text}`}
                      className='flex items-start'
                    >
                      <div className='flex-shrink-0'>
                        <Check
                          aria-hidden='true'
                          className='h-6 w-6 text-green-500'
                        />
                      </div>
                      <p
                        className={`ml-3 text-base ${feature.highlight ? 'font-medium text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        {feature.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  </div>
)

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app')
  if (!appContainer) throw new Error('Failed to find the app container')

  const root = createRoot(appContainer)
  root.render(
    <ThemeProvider defaultTheme='system' storageKey='tab-manager-theme'>
      <App />
    </ThemeProvider>,
  )
})
