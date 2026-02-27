// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportExportSettings } from './ImportExportSettings'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/features/options/lib/import-export', () => ({
  exportSettings: vi.fn(),
  downloadAsJson: vi.fn(),
  importSettings: vi.fn(),
}))

import { toast } from 'sonner'
import {
  downloadAsJson,
  exportSettings,
  importSettings,
} from '@/features/options/lib/import-export'

type ReaderMode = 'success' | 'empty' | 'error'

let readerMode: ReaderMode = 'success'
let readerContent = '{"import":"payload"}'
let readerAsync = false

class MockFileReader {
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null

  readAsText(_file: Blob) {
    const dispatch = (fn: () => void) => {
      if (readerAsync) {
        setTimeout(fn, 0)
        return
      }
      fn()
    }

    if (readerMode === 'error') {
      dispatch(() => {
        this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>)
      })
      return
    }

    const result = readerMode === 'empty' ? '' : readerContent
    dispatch(() => {
      this.onload?.({
        target: { result },
      } as unknown as ProgressEvent<FileReader>)
    })
  }
}

const runtimeSendMessage = vi.fn()

const getHiddenFileInput = (container: HTMLElement): HTMLInputElement => {
  const fileInput = container.querySelector(
    'input[type="file"].hidden',
  ) as HTMLInputElement | null
  if (!fileInput) {
    throw new Error('hidden file input not found')
  }
  return fileInput
}

const getDropzoneFileInput = (container: HTMLElement): HTMLInputElement => {
  const fileInputs = Array.from(
    document.querySelectorAll('input[type="file"]'),
  ) as HTMLInputElement[]
  const dropzoneInput =
    fileInputs.find(input => !input.classList.contains('hidden')) ??
    fileInputs.find(input => input !== getHiddenFileInput(container))
  if (!dropzoneInput) {
    throw new Error('dropzone file input not found')
  }
  return dropzoneInput
}

describe('ImportExportSettingsコンポーネント', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    readerMode = 'success'
    readerContent = '{"import":"payload"}'
    readerAsync = false

    ;(globalThis as { [key: string]: unknown }).FileReader =
      MockFileReader as unknown as typeof FileReader

    ;(globalThis as unknown as { chrome: typeof chrome }).chrome = {
      runtime: {
        sendMessage: runtimeSendMessage,
      },
    } as unknown as typeof chrome
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('データをエクスポートしてバックアップファイルをダウンロードする', async () => {
    vi.mocked(exportSettings).mockResolvedValue({
      version: '1.0.0',
      timestamp: '2026-02-16T00:00:00.000Z',
      userSettings: {
        removeTabAfterOpen: true,
        removeTabAfterExternalDrop: true,
        excludePatterns: [],
        enableCategories: true,
        showSavedTime: false,
        clickBehavior: 'saveWindowTabs',
        excludePinnedTabs: true,
        openUrlInBackground: true,
        openAllInNewWindow: false,
        confirmDeleteAll: false,
        confirmDeleteEach: false,
      },
      parentCategories: [],
      savedTabs: [],
    })

    render(<ImportExportSettings />)

    fireEvent.click(
      screen.getByRole('button', { name: '設定とタブデータをエクスポート' }),
    )

    await waitFor(() => {
      expect(exportSettings).toHaveBeenCalledTimes(1)
    })

    expect(downloadAsJson).toHaveBeenCalledTimes(1)
    expect(vi.mocked(downloadAsJson).mock.calls[0]?.[1]).toMatch(
      /^tab-manager-backup-\d{4}-\d{2}-\d{2}\.json$/,
    )
    expect(toast.success).toHaveBeenCalledWith(
      '設定とタブデータをエクスポートしました',
    )
  })

  it('エクスポート失敗時にエラートーストを表示する', async () => {
    vi.mocked(exportSettings).mockRejectedValue(new Error('export failed'))

    render(<ImportExportSettings />)

    fireEvent.click(
      screen.getByRole('button', { name: '設定とタブデータをエクスポート' }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'エクスポート中にエラーが発生しました',
      )
    })
  })

  it('マージ設定を切り替えるとインポート時に mergeData=false を渡す', async () => {
    vi.mocked(importSettings).mockResolvedValue({
      success: true,
      message: 'ok',
    })

    const { container } = render(<ImportExportSettings />)

    fireEvent.click(
      screen.getByRole('button', { name: '設定とタブデータをインポート' }),
    )

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: '既存データとマージする（推奨）',
      }),
    )

    expect(
      screen.getByText('警告：既存のデータをすべて置き換えます。'),
    ).toBeTruthy()

    fireEvent.change(getHiddenFileInput(container), {
      target: {
        files: [
          new File(['dummy'], 'backup.json', { type: 'application/json' }),
        ],
      },
    })

    await waitFor(() => {
      expect(importSettings).toHaveBeenCalledWith(readerContent, false)
    })
  })

  it('ファイル未選択時は file change イベントを無視する', async () => {
    const { container } = render(<ImportExportSettings />)

    fireEvent.change(getHiddenFileInput(container), {
      target: { files: [] },
    })

    await waitFor(() => {
      expect(importSettings).not.toHaveBeenCalled()
    })
  })

  it('dropzone input 経由（onDrop 経路）でファイルを処理する', async () => {
    vi.mocked(importSettings).mockResolvedValue({
      success: true,
      message: 'ok',
    })

    const { container } = render(<ImportExportSettings />)

    fireEvent.click(
      screen.getByRole('button', { name: '設定とタブデータをインポート' }),
    )

    fireEvent.change(getDropzoneFileInput(container), {
      target: {
        files: [
          new File(['dummy'], 'dropzone.json', { type: 'application/json' }),
        ],
      },
    })

    await waitFor(() => {
      expect(importSettings).toHaveBeenCalledWith(readerContent, true)
    })
  })

  it('dropzone 上でドラッグ中にドラッグアクティブラベルを表示する', async () => {
    const { container } = render(<ImportExportSettings />)

    fireEvent.click(
      screen.getByRole('button', { name: '設定とタブデータをインポート' }),
    )

    const dropzone = getDropzoneFileInput(container).parentElement
    if (!dropzone) {
      throw new Error('dropzone container not found')
    }

    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        files: [new File(['x'], 'drag.json', { type: 'application/json' })],
        items: [],
        types: ['Files'],
      },
    })

    await waitFor(() => {
      expect(screen.getByText('ファイルをドロップ')).toBeTruthy()
    })
  })

  it('受け入れファイルがない drop イベントは処理しない', async () => {
    const { container } = render(<ImportExportSettings />)

    fireEvent.click(
      screen.getByRole('button', { name: '設定とタブデータをインポート' }),
    )

    const dropzone = getDropzoneFileInput(container).parentElement
    if (!dropzone) {
      throw new Error('dropzone container not found')
    }

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [],
        items: [],
        types: ['Files'],
      },
    })

    await waitFor(() => {
      expect(importSettings).not.toHaveBeenCalled()
    })
  })

  it('キャンセルボタンをクリックするとダイアログを閉じる', async () => {
    render(<ImportExportSettings />)

    fireEvent.click(
      screen.getByRole('button', { name: '設定とタブデータをインポート' }),
    )
    expect(screen.getByText('設定とタブデータのインポート')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByText('設定とタブデータのインポート')).toBeNull()
    })
  })

  it('読み込み前に JSON 以外のファイルを拒否する', async () => {
    const { container } = render(<ImportExportSettings />)

    fireEvent.change(getHiddenFileInput(container), {
      target: {
        files: [new File(['dummy'], 'backup.txt', { type: 'text/plain' })],
      },
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('JSONファイルを選択してください')
    })
    expect(importSettings).not.toHaveBeenCalled()
  })

  it('JSON ファイルを正常にインポートして background に通知する', async () => {
    vi.mocked(importSettings).mockResolvedValue({
      success: true,
      message: 'インポート成功',
    })

    const { container } = render(<ImportExportSettings />)

    fireEvent.change(getHiddenFileInput(container), {
      target: {
        files: [
          new File(['dummy'], 'backup.json', { type: 'application/json' }),
        ],
      },
    })

    await waitFor(() => {
      expect(importSettings).toHaveBeenCalledWith(readerContent, true)
    })

    expect(toast.success).toHaveBeenCalledWith('インポート成功')
    expect(runtimeSendMessage).toHaveBeenCalledWith({
      action: 'settingsImported',
    })
  })

  it('インポート結果が失敗時は importSettings の失敗メッセージを表示する', async () => {
    vi.mocked(importSettings).mockResolvedValue({
      success: false,
      message: 'バリデーションエラー',
    })

    const { container } = render(<ImportExportSettings />)

    fireEvent.change(getHiddenFileInput(container), {
      target: {
        files: [
          new File(['dummy'], 'backup.json', { type: 'application/json' }),
        ],
      },
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('バリデーションエラー')
    })

    expect(runtimeSendMessage).not.toHaveBeenCalled()
  })

  it('インポートで例外発生時に汎用エラーを表示する', async () => {
    vi.mocked(importSettings).mockRejectedValue(new Error('import failed'))

    const { container } = render(<ImportExportSettings />)

    fireEvent.change(getHiddenFileInput(container), {
      target: {
        files: [
          new File(['dummy'], 'backup.json', { type: 'application/json' }),
        ],
      },
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('インポートに失敗しました')
    })
  })

  it('ファイル内容が空のとき読み込みエラーを表示する', async () => {
    readerMode = 'empty'

    const { container } = render(<ImportExportSettings />)

    fireEvent.change(getHiddenFileInput(container), {
      target: {
        files: [
          new File(['dummy'], 'backup.json', { type: 'application/json' }),
        ],
      },
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'ファイルの読み込みに失敗しました',
      )
    })
    expect(importSettings).not.toHaveBeenCalled()
  })

  it('FileReader.onerror 発火時に読み込みエラーを表示する', async () => {
    readerMode = 'error'

    const { container } = render(<ImportExportSettings />)

    fireEvent.change(getHiddenFileInput(container), {
      target: {
        files: [
          new File(['dummy'], 'backup.json', { type: 'application/json' }),
        ],
      },
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'ファイルの読み込みに失敗しました',
      )
    })
    expect(importSettings).not.toHaveBeenCalled()
  })

  it('アンマウント後の非同期 onload を null の file input ref に触れず処理する', async () => {
    readerMode = 'success'
    readerAsync = true
    vi.mocked(importSettings).mockResolvedValue({
      success: true,
      message: 'ok',
    })

    const { container, unmount } = render(<ImportExportSettings />)

    fireEvent.change(getHiddenFileInput(container), {
      target: {
        files: [
          new File(['dummy'], 'backup.json', { type: 'application/json' }),
        ],
      },
    })

    unmount()

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(importSettings).toHaveBeenCalledWith(readerContent, true)
  })

  it('アンマウント後の非同期 onerror を null の file input ref に触れず処理する', async () => {
    readerMode = 'error'
    readerAsync = true

    const { container, unmount } = render(<ImportExportSettings />)

    fireEvent.change(getHiddenFileInput(container), {
      target: {
        files: [
          new File(['dummy'], 'backup.json', { type: 'application/json' }),
        ],
      },
    })

    unmount()

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(toast.error).toHaveBeenCalledWith('ファイルの読み込みに失敗しました')
  })
})
