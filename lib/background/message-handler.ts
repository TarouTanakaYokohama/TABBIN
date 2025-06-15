/**
 * メッセージハンドラーモジュール
 */

import type {
  AlarmStatusResponse,
  BackgroundMessage,
  StatusResponse,
  TimeRemainingResponse,
} from '@/types/background'
import {
  checkAndRemoveExpiredTabs,
  getExpirationPeriodMs,
  updateTabTimestamps,
} from './expired-tabs'
import {
  handleUrlDragStarted,
  handleUrlDropped,
  removeUrlFromStorage,
} from './url-storage'

/**
 * メッセージリスナーを設定
 */
export function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('バックグラウンドがメッセージを受信:', message)

    const typedMessage = message as BackgroundMessage

    switch (typedMessage.action) {
      case 'urlDragStarted':
        handleUrlDragStartedMessage(typedMessage.url, sendResponse)
        return true

      case 'urlDropped':
        handleUrlDroppedMessage(typedMessage, sendResponse)
        return true

      case 'removeUrlFromStorage':
        handleRemoveUrlMessage(typedMessage.url, sendResponse)
        return true

      case 'calculateTimeRemaining':
        handleCalculateTimeRemainingMessage(typedMessage, sendResponse)
        return true

      case 'checkExpiredTabs':
        handleCheckExpiredTabsMessage(typedMessage, sendResponse)
        return true

      case 'updateTabTimestamps':
        handleUpdateTabTimestampsMessage(typedMessage, sendResponse)
        return true

      case 'getAlarmStatus':
        handleGetAlarmStatusMessage(sendResponse)
        return true

      default:
        console.warn('未知のメッセージアクション:', message.action)
        sendResponse({ status: 'unknown_action' })
        return false
    }
  })
}

/**
 * URLドラッグ開始メッセージの処理
 */
function handleUrlDragStartedMessage(
  url: string,
  sendResponse: (response: StatusResponse) => void,
): void {
  handleUrlDragStarted(url)
  sendResponse({ status: 'ok' })
}

/**
 * URLドロップメッセージの処理
 */
function handleUrlDroppedMessage(
  message: { url: string; fromExternal?: boolean },
  sendResponse: (response: StatusResponse) => void,
): void {
  console.log('URLドロップを検知:', message.url)

  // fromExternal フラグが true の場合のみ処理（外部ドラッグの場合のみ）
  if (message.fromExternal === true) {
    handleUrlDropped(message.url, message.fromExternal)
      .then(status => {
        sendResponse({ status })
      })
      .catch(error => {
        console.error('URL削除エラー:', error)
        sendResponse({ status: 'error', error: error.toString() })
      })
  } else {
    console.log('内部操作のため削除をスキップ')
    sendResponse({ status: 'internal_operation' })
  }
}

/**
 * URL削除メッセージの処理
 */
function handleRemoveUrlMessage(
  url: string,
  sendResponse: (response: StatusResponse) => void,
): void {
  removeUrlFromStorage(url)
    .then(() => sendResponse({ status: 'removed' }))
    .catch(error => sendResponse({ status: 'error', error }))
}

/**
 * 残り時間計算メッセージの処理
 */
function handleCalculateTimeRemainingMessage(
  message: { savedAt: number; autoDeletePeriod: string },
  sendResponse: (response: TimeRemainingResponse) => void,
): void {
  const { savedAt, autoDeletePeriod } = message

  if (!autoDeletePeriod || autoDeletePeriod === 'never' || !savedAt) {
    sendResponse({ timeRemaining: null })
    return
  }

  try {
    const expirationMs = getExpirationPeriodMs(autoDeletePeriod as 'never')
    if (!expirationMs) {
      sendResponse({ timeRemaining: null })
      return
    }

    const now = Date.now()
    const expirationTime = savedAt + expirationMs
    const remainingMs = expirationTime - now

    sendResponse({
      timeRemaining: remainingMs,
      expirationTime,
    })
  } catch (error) {
    console.error('残り時間計算エラー:', error)
    sendResponse({ error: error?.toString(), timeRemaining: null })
  }
}

/**
 * 期限切れタブチェックメッセージの処理
 */
function handleCheckExpiredTabsMessage(
  message: { updateTimestamps?: boolean; period?: string },
  sendResponse: (response: StatusResponse) => void,
): void {
  console.log('明示的な期限切れチェックリクエストを受信:', message)

  // 設定情報も出力
  chrome.storage.local.get(['userSettings'], data => {
    console.log('現在のストレージ内の設定:', data)
  })

  // updateTimestampsフラグがあり、periodも指定されている場合は時刻を更新
  if (message.updateTimestamps) {
    console.log(`タブの保存時刻を更新します (${message.period || '不明'})`)
    // 処理の簡略化 - まずタイムスタンプを更新し、待機せずにチェック実行
    updateTabTimestamps(message.period)
      .then(_result => {
        console.log('タブの時刻更新完了。チェックを実行します。')

        // 設定を再読み込みし、チェック実行
        checkAndRemoveExpiredTabs()
          .then(() => {
            console.log('期限切れチェック完了')
            sendResponse({ status: 'completed', success: true })
          })
          .catch(error => {
            console.error('チェックエラー:', error)
            sendResponse({ error: String(error), status: 'error' })
          })
      })
      .catch(error => {
        console.error('タイムスタンプ更新エラー:', error)
        sendResponse({ error: String(error), status: 'error' })
      })
  } else {
    // 単純化 - 常に強制リロードする
    checkAndRemoveExpiredTabs()
      .then(() => {
        console.log('期限切れチェック完了')
        sendResponse({ status: 'completed' })
      })
      .catch(error => sendResponse({ error: String(error), status: 'error' }))
  }
}

/**
 * タイムスタンプ更新メッセージの処理
 */
function handleUpdateTabTimestampsMessage(
  message: { period?: string },
  sendResponse: (response: StatusResponse) => void,
): void {
  console.log('タブの保存時刻を強制的に更新:', message.period)
  updateTabTimestamps(message.period)
    .then(result => {
      sendResponse({ status: 'completed', result })
    })
    .catch(error => {
      console.error('時刻更新エラー:', error)
      sendResponse({ error: String(error), status: 'error' })
    })
}

/**
 * アラーム状態取得メッセージの処理
 */
function handleGetAlarmStatusMessage(
  sendResponse: (response: AlarmStatusResponse) => void,
): void {
  chrome.alarms.get('checkExpiredTabs', alarm => {
    const status = alarm
      ? { exists: true, scheduledTime: alarm.scheduledTime }
      : { exists: false }
    console.log('アラーム状態:', status)
    sendResponse(status)
  })
}
