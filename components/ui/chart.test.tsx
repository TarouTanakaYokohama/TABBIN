// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  responsiveContainerProps: undefined as Record<string, unknown> | undefined,
}))

vi.mock('recharts', () => ({
  Legend: () => null,
  ResponsiveContainer: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => {
    mocked.responsiveContainerProps = props

    return <div data-testid='responsive-container'>{children}</div>
  },
  Tooltip: () => null,
}))

import { ChartContainer } from './chart'

describe('ChartContainer', () => {
  it('configures ResponsiveContainer with stable sizing props', () => {
    render(
      <ChartContainer
        className='h-64'
        config={{ active: { color: 'var(--color-primary)', label: 'Active' } }}
      >
        <div>chart</div>
      </ChartContainer>,
    )

    expect(screen.getByTestId('responsive-container')).toBeTruthy()
    expect(mocked.responsiveContainerProps).toMatchObject({
      height: '100%',
      minWidth: 0,
      width: '100%',
    })
  })
})
