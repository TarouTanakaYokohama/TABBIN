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
        <p>Spotlight 検索で「ターミナル」と入力して開きます。</p>
        <p>次のコマンドをコピーして貼り付けます。</p>
        <p>
          <code>{`launchctl setenv OLLAMA_ORIGINS "${configuredOrigin}"`}</code>
        </p>
        <p>Enter キーを押します。</p>
        <p>Ollama.app を終了します。</p>
        <p>Ollama.app を起動し直します。</p>
      </>
    )
  }

  if (platform === 'win') {
    return (
      <>
        <p>Windows のスタートメニューで「環境変数」と入力します。</p>
        <p>「アカウントの環境変数を編集」を開きます。</p>
        <p>「新規」を押します。</p>
        <p>変数名に OLLAMA_ORIGINS を入力します。</p>
        <p>変数値に {configuredOrigin} を入力します。</p>
        <p>保存してから Ollama を再起動します。</p>
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
