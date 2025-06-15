/**
 * Background script用の型定義
 */

/**
 * プロジェクト内のURL情報
 */
export interface ProjectUrl {
  url: string
  title: string
  savedAt: number
}

/**
 * カスタムプロジェクト
 */
export interface Project {
  id: string
  name: string
  description: string
  urls: ProjectUrl[]
  categories: string[]
  createdAt: number
  updatedAt: number
}

/**
 * タブグループ
 */
export interface TabGroup {
  id: string
  domain: string
  parentCategoryId?: string
  urls: Array<{
    url: string
    title: string
    subCategory?: string
    savedAt?: number // 個別URL保存時刻
  }>
  subCategories?: string[]
  categoryKeywords?: import('@/types/storage').SubCategoryKeyword[]
  savedAt?: number // グループ全体の保存時刻
}

/**
 * 親カテゴリ
 */
export interface ParentCategory {
  id: string
  name: string
  domains: string[]
  domainNames: string[]
}

/**
 * ドラッグされたURL情報
 */
export interface DraggedUrlInfo {
  url: string
  timestamp: number
  processed: boolean
  timeoutId?: NodeJS.Timeout
}

/**
 * メッセージアクション型定義
 */
export type MessageAction =
  | 'urlDragStarted'
  | 'urlDropped'
  | 'removeUrlFromStorage'
  | 'calculateTimeRemaining'
  | 'checkExpiredTabs'
  | 'updateTabTimestamps'
  | 'getAlarmStatus'

/**
 * メッセージ基底型
 */
export interface BaseMessage {
  action: MessageAction
}

/**
 * URLドラッグ開始メッセージ
 */
export interface UrlDragStartedMessage extends BaseMessage {
  action: 'urlDragStarted'
  url: string
}

/**
 * URLドロップメッセージ
 */
export interface UrlDroppedMessage extends BaseMessage {
  action: 'urlDropped'
  url: string
  fromExternal?: boolean
}

/**
 * URL削除メッセージ
 */
export interface RemoveUrlMessage extends BaseMessage {
  action: 'removeUrlFromStorage'
  url: string
}

/**
 * 残り時間計算メッセージ
 */
export interface CalculateTimeRemainingMessage extends BaseMessage {
  action: 'calculateTimeRemaining'
  savedAt: number
  autoDeletePeriod: string
}

/**
 * 期限切れチェックメッセージ
 */
export interface CheckExpiredTabsMessage extends BaseMessage {
  action: 'checkExpiredTabs'
  updateTimestamps?: boolean
  period?: string
}

/**
 * タイムスタンプ更新メッセージ
 */
export interface UpdateTabTimestampsMessage extends BaseMessage {
  action: 'updateTabTimestamps'
  period?: string
}

/**
 * アラーム状態取得メッセージ
 */
export interface GetAlarmStatusMessage extends BaseMessage {
  action: 'getAlarmStatus'
}

/**
 * 全てのメッセージ型のユニオン
 */
export type BackgroundMessage =
  | UrlDragStartedMessage
  | UrlDroppedMessage
  | RemoveUrlMessage
  | CalculateTimeRemainingMessage
  | CheckExpiredTabsMessage
  | UpdateTabTimestampsMessage
  | GetAlarmStatusMessage

/**
 * レスポンス型定義
 */
export interface StatusResponse {
  status: string
  success?: boolean
  result?: unknown
  error?: string
}

export interface TimeRemainingResponse {
  timeRemaining: number | null
  expirationTime?: number
  error?: string
}

export interface AlarmStatusResponse {
  exists: boolean
  scheduledTime?: number
}

/**
 * コンテキストメニューID型
 */
export type ContextMenuId =
  | 'openSavedTabs'
  | 'sepOpenSavedTabs'
  | 'saveCurrentTab'
  | 'saveAllTabs'
  | 'saveSameDomainTabs'
  | 'saveAllWindowsTabs'

/**
 * クリック動作型
 */
export type ClickBehavior =
  | 'saveCurrentTab'
  | 'saveSameDomainTabs'
  | 'saveAllWindowsTabs'
  | 'saveWindowTabs'

/**
 * 自動削除期間型
 */
export type AutoDeletePeriod =
  | 'never'
  | '30sec'
  | '1min'
  | '1hour'
  | '1day'
  | '7days'
  | '14days'
  | '30days'
  | '180days'
  | '365days'
