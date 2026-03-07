import { cn } from '@/lib/utils'
import type { OllamaErrorDetails } from '@/types/background'

type OllamaErrorPlatform = 'mac' | 'unknown' | 'win'

interface OllamaErrorNoticeProps {
  className?: string
  error: OllamaErrorDetails
  platform: OllamaErrorPlatform
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
        <p>macOS では次を設定してから Ollama を再起動してください。</p>
        <p>
          <code>{`launchctl setenv OLLAMA_ORIGINS "${configuredOrigin}"`}</code>
        </p>
      </>
    )
  }

  if (platform === 'win') {
    return (
      <>
        <p>Windows では OLLAMA_ORIGINS を環境変数として設定してください。</p>
        <p>
          設定値: <code>{configuredOrigin}</code>
        </p>
        <p>設定後に Ollama を再起動してください。</p>
      </>
    )
  }

  return (
    <>
      <p>OLLAMA_ORIGINS を設定してから Ollama を再起動してください。</p>
      <p>
        設定値: <code>{configuredOrigin}</code>
      </p>
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
    <div className={cn('space-y-2', className)}>
      <p>
        {isConnectionError
          ? 'Ollama に接続できませんでした。'
          : 'Ollama が拡張機能からのアクセスを拒否しました (403 Forbidden)。'}
      </p>

      {isConnectionError ? (
        <>
          <p>
            まだインストールしていない場合は Ollama をダウンロードしてください。
          </p>
          <p>インストール済みなら Ollama を起動してください。</p>
        </>
      ) : (
        <p>
          OLLAMA_ORIGINS に <code>{configuredOrigin}</code> を設定してください。
        </p>
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
      <p>
        確認コマンド: <code>{`curl ${error.tagsUrl}`}</code>
      </p>

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
  )
}

export type { OllamaErrorPlatform }
export { OllamaErrorNotice }
