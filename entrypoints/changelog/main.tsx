import '@/assets/global.css'
import { ThemeProvider } from '@/components/theme-provider'
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
      {
        text: '便利な検索機能を追加しました。キーワードを入力するだけで、保存したURLをすばやく見つけることができます。',
      },
      { text: 'より使いやすく、見やすくなるようデザインを改善しました。' },
      {
        text: 'URLやカテゴリの削除時に確認ダイアログが表示されるようになり、誤操作を防止できます。',
      },
      {
        text: 'ドメインやカテゴリを一時的に閉じることができるようになり、必要な情報だけを表示できます。',
      },
      {
        text: '登録日時によって昇順・降順に並び替えができるようになり、新しいURLや古いURLを簡単に確認できます。',
      },
      {
        text: 'リンクをバックグラウンドタブで開く機能を追加し、現在の作業を中断せずにURLを開けるようになりました。',
      },
      {
        text: 'プレビュー版：カスタムモードを実装し、より柔軟な設定が可能になりました。',
      },
      {
        text: 'プレビュー版：カラーカスタマイズ機能を追加し、お好みの色でアプリの外観を変更できます。',
      },
      {
        text: 'その他、パフォーマンスの向上やバグ修正など、様々な改善を行いました。',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2025年3月21日',
    features: [
      {
        text: '初回リリース。タブやブックマークを効率的に管理できるツールとして、カテゴリ別の整理や簡単なアクセスが可能になりました。',
      },
    ],
  },
]

const App: React.FC = () => (
  <div className='min-h-screen bg-background px-4 py-16 sm:px-6 lg:px-8'>
    <div className='mx-auto max-w-4xl'>
      <div className='mb-16 text-center'>
        <h1 className='font-extrabold text-5xl text-primary sm:text-6xl sm:tracking-tight'>
          <span className='block'>リリースノート</span>
        </h1>
        <p className='mt-4 text-muted-foreground text-xl'>
          アプリの進化の記録 - 新機能と改善点
        </p>
      </div>

      <div className='space-y-12'>
        {CHANGELOG.map(item => (
          <Card
            key={item.version}
            className='overflow-hidden rounded-xl border-primary border-t-4 shadow-xl transition-shadow duration-300 hover:shadow-2xl'
          >
            <div className='px-8 py-10 sm:p-12'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between'>
                <h2 className='font-bold text-3xl text-primary'>
                  v{item.version}
                </h2>
                <div className='mt-2 inline-flex rounded-full bg-secondary px-5 py-2 font-semibold text-secondary-foreground text-sm sm:mt-0'>
                  {item.date}
                </div>
              </div>

              <div className='mt-10'>
                <ul className='space-y-6'>
                  {item.features.map(feature => (
                    <li
                      key={`${item.version}-${feature.text}`}
                      className='group flex items-start rounded-lg p-3 transition-colors duration-200 hover:bg-accent/10'
                    >
                      <div className='flex-shrink-0'>
                        <Check
                          aria-hidden='true'
                          className='h-6 w-6 text-chart-1 transition-colors duration-200 group-hover:text-chart-4'
                        />
                      </div>
                      <p
                        className={`ml-4 text-base ${feature.highlight ? 'font-medium text-primary' : 'text-foreground'}`}
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
