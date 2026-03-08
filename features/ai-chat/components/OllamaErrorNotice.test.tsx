import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OllamaErrorNotice } from './OllamaErrorNotice'

const baseError = {
  allowedOrigins: 'chrome-extension://test-extension-id',
  baseUrl: 'http://localhost:11434',
  downloadUrl: 'https://ollama.com/download',
  faqUrl: 'https://docs.ollama.com/faq#how-do-i-configure-ollama-server',
  tagsUrl: 'http://localhost:11434/api/tags',
} as const

const mocked = vi.hoisted(() => ({
  writeClipboardText: vi.fn(),
}))

describe('OllamaErrorNotice', () => {
  beforeEach(() => {
    mocked.writeClipboardText.mockReset()
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: mocked.writeClipboardText,
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('Windows ではユーザー環境変数ベースの手順を表示する', () => {
    render(
      <OllamaErrorNotice
        error={{
          ...baseError,
          kind: 'notInstalledOrNotRunning',
        }}
        platform='win'
      />,
    )

    expect(
      screen.getByText('「システム環境変数の編集」を開きます。'),
    ).toBeTruthy()
    expect(
      screen.getByText('表示された画面で「環境変数」を押します。'),
    ).toBeTruthy()
    expect(
      screen.getByText('「ユーザー環境変数」の「新規」を押します。'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: '入力値をコピー' })).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: '入力値をコピー' })
        .getAttribute('title'),
    ).toBe('コピー')
  })

  it('長文の折り返しとスクロール用 class を持つ', () => {
    render(
      <OllamaErrorNotice
        error={{
          ...baseError,
          kind: 'forbidden',
        }}
        platform='mac'
      />,
    )

    const root = screen.getByText(
      'Ollama が拡張機能からのアクセスを拒否しました (403 Forbidden)。',
    ).parentElement

    expect(root?.className).toContain('max-h-')
    expect(root?.className).toContain('overflow-y-auto')
    expect(root?.className).toContain('overflow-x-hidden')
    expect(root?.className).toContain('[&_a]:break-all')
    expect(root?.className).toContain('[&_code]:break-all')
  })

  it('macOS の command row をコピーできる', async () => {
    render(
      <OllamaErrorNotice
        error={{
          ...baseError,
          kind: 'forbidden',
        }}
        platform='mac'
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'コマンドをコピー' }))

    expect(mocked.writeClipboardText).toHaveBeenCalledWith(
      'launchctl setenv OLLAMA_ORIGINS "chrome-extension://test-extension-id"',
    )
  })

  it('Windows の value row をコピーできる', async () => {
    render(
      <OllamaErrorNotice
        error={{
          ...baseError,
          kind: 'notInstalledOrNotRunning',
        }}
        platform='win'
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '入力値をコピー' }))

    expect(mocked.writeClipboardText).toHaveBeenCalledWith(
      'chrome-extension://test-extension-id',
    )
  })

  it('確認コマンド row をコピーできる', async () => {
    render(
      <OllamaErrorNotice
        error={{
          ...baseError,
          kind: 'forbidden',
        }}
        platform='mac'
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: '確認コマンドをコピー' }),
    )

    expect(mocked.writeClipboardText).toHaveBeenCalledWith(
      'curl http://localhost:11434/api/tags',
    )
  })
})
