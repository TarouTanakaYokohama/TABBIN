// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CategoryReorderFooter } from './Footer'

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

describe('CategoryReorderFooterコンポーネント', () => {
  afterEach(() => {
    cleanup()
  })

  it('キャンセル/確認ボタンをクリックするとハンドラを呼び出す', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <CategoryReorderFooter
        onConfirmCategoryReorder={onConfirm}
        onCancelCategoryReorder={onCancel}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: '親カテゴリの並び替えをキャンセル' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: '親カテゴリの並び替えを確定' }),
    )

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('ハンドラなしでも描画できる', () => {
    render(<CategoryReorderFooter />)

    fireEvent.click(
      screen.getByRole('button', { name: '親カテゴリの並び替えをキャンセル' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: '親カテゴリの並び替えを確定' }),
    )

    expect(
      screen.getByRole('button', { name: '親カテゴリの並び替えをキャンセル' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: '親カテゴリの並び替えを確定' }),
    ).toBeTruthy()
  })
})
