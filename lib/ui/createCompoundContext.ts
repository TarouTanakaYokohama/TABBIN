import { createContext, use } from 'react'

/**
 * 複合コンポーネント用のコンテキストファクトリ関数
 * Context、Provider、useCompoundContext フックを一括生成する
 * @param componentName コンポーネント名（エラーメッセージ用）
 * @returns Context と useCompoundContext フック
 */
export function createCompoundContext<T>(componentName: string): {
  /** コンテキストオブジェクト（Provider として使用） */
  Context: React.Context<T | null>
  /** コンテキストにアクセスするためのフック */
  useCompoundContext: () => T
} {
  const Context = createContext<T | null>(null)

  /** コンテキストにアクセスするためのフック */
  const useCompoundContext = (): T => {
    const context = use(Context)
    if (!context) {
      throw new Error(`${componentName}のProvider内で使用してください`)
    }
    return context
  }

  return { Context, useCompoundContext }
}
