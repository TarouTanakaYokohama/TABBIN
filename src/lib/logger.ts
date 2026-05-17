/**
 * 環境対応ロガーモジュール
 * プロダクションビルドでは console.log/debug を無効化する。
 * console.error/warn は常に出力する。
 */

const noop = (): void => {}

/** 開発環境のみ出力するロガー */
export const logger = {
  log: import.meta.env.DEV
    ? console.log.bind(console)
    : (noop as typeof console.log),
  debug: import.meta.env.DEV
    ? console.debug.bind(console)
    : (noop as typeof console.debug),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}
