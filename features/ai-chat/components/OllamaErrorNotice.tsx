import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { OllamaErrorDetails } from '@/types/background'

type OllamaErrorPlatform = 'mac' | 'unknown' | 'win'

interface OllamaErrorNoticeProps {
  className?: string
  error: OllamaErrorDetails
  platform: OllamaErrorPlatform
}

const CopyableValueRow = ({
  buttonLabel,
  value,
}: {
  buttonLabel: string
  value: string
}) => {
  const copyToClipboard = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      return
    }

    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Ignore clipboard failures and leave the guidance visible.
    }
  }

  return (
    <div className='flex items-center gap-2'>
      <input
        aria-label={`${buttonLabel}の内容`}
        className={cn(
          'min-w-0 flex-1 rounded-md border border-input bg-background',
          'px-3 py-2 font-mono text-xs leading-5',
        )}
        readOnly
        value={value}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={buttonLabel}
            className='size-8 shrink-0'
            onClick={() => {
              void copyToClipboard()
            }}
            size='icon-sm'
            title='コピー'
            type='button'
            variant='outline'
          >
            <Copy size={14} />
            <span className='sr-only'>{buttonLabel}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top'>
          <p>コピー</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

const renderPlatformInstructions = ({
  configuredOrigin,
  platform,
}: {
  configuredOrigin: string
  platform: OllamaErrorPlatform
}) => {
  if (platform === 'mac') {
    return (
      <>
        <p>Spotlight 検索で「ターミナル」と入力して開きます。</p>
        <p>次のコマンドをコピーして貼り付けます。</p>
        <CopyableValueRow
          buttonLabel='コマンドをコピー'
          value={`launchctl setenv OLLAMA_ORIGINS "${configuredOrigin}"`}
        />
        <p>return キーを押します。</p>
        <p>Ollama.app を終了します。</p>
        <p>Ollama.app を起動し直します。</p>
      </>
    )
  }

  if (platform === 'win') {
    return (
      <>
        <p>Windows のスタートメニューで「環境変数」と入力します。</p>
        <p>「システム環境変数の編集」を開きます。</p>
        <p>表示された画面で「環境変数」を押します。</p>
        <p>「ユーザー環境変数」の「新規」を押します。</p>
        <p>変数名に OLLAMA_ORIGINS を入力します。</p>
        <p>変数値に次の値を入力します。</p>
        <CopyableValueRow
          buttonLabel='入力値をコピー'
          value={configuredOrigin}
        />
        <p>保存してから Ollama を再起動します。</p>
      </>
    )
  }

  return (
    <>
      <p>OLLAMA_ORIGINS を設定してから Ollama を再起動してください。</p>
      <p>設定値は次のとおりです。</p>
      <CopyableValueRow buttonLabel='入力値をコピー' value={configuredOrigin} />
    </>
  )
}

const OllamaErrorNotice = ({
  className,
  error,
  platform,
}: OllamaErrorNoticeProps) => {
  const isConnectionError = error.kind === 'notInstalledOrNotRunning'
  const configuredOrigin = error.allowedOrigins ?? 'chrome-extension://*'

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'wrap-break-word max-h-40 space-y-2 overflow-y-auto overflow-x-hidden pr-1',
          '[&_a]:break-all',
          '[&_code]:whitespace-pre-wrap [&_code]:break-all',
          '[&_p]:wrap-break-word [&_p]:whitespace-pre-wrap',
          className,
        )}
      >
        <p>
          {isConnectionError
            ? 'Ollama に接続できませんでした。'
            : 'Ollama が拡張機能からのアクセスを拒否しました (403 Forbidden)。'}
        </p>

        {isConnectionError ? (
          <>
            <p>
              まだインストールしていない場合は Ollama
              をダウンロードしてください。
            </p>
            <p>インストール済みなら Ollama を起動してください。</p>
          </>
        ) : (
          <p>OLLAMA_ORIGINS に次の値を設定してください。</p>
        )}

        {renderPlatformInstructions({
          configuredOrigin,
          platform,
        })}

        <p>
          接続先 URL:{' '}
          <a
            className='break-all underline underline-offset-2'
            href={error.baseUrl}
            rel='noreferrer'
            target='_blank'
          >
            {error.baseUrl}
          </a>
        </p>
        <p>
          確認 URL:{' '}
          <a
            className='break-all underline underline-offset-2'
            href={error.tagsUrl}
            rel='noreferrer'
            target='_blank'
          >
            {error.tagsUrl}
          </a>
        </p>
        <p>確認コマンドをコピーして貼り付けると状態を確認できます。</p>
        <CopyableValueRow
          buttonLabel='確認コマンドをコピー'
          value={`curl ${error.tagsUrl}`}
        />

        {isConnectionError ? (
          <p>
            ダウンロード URL:{' '}
            <a
              className='break-all underline underline-offset-2'
              href={error.downloadUrl}
              rel='noreferrer'
              target='_blank'
            >
              {error.downloadUrl}
            </a>
          </p>
        ) : null}

        <p>
          FAQ:{' '}
          <a
            className='break-all underline underline-offset-2'
            href={error.faqUrl}
            rel='noreferrer'
            target='_blank'
          >
            {error.faqUrl}
          </a>
        </p>
      </div>
    </TooltipProvider>
  )
}

export type { OllamaErrorPlatform }
export { OllamaErrorNotice }
