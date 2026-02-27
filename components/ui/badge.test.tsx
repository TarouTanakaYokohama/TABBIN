// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './badge'

describe('Badgeコンポーネント', () => {
  it('デフォルトはspanとして描画する', () => {
    render(<Badge>Default Badge</Badge>)

    const badge = screen.getByText('Default Badge')
    expect(badge.tagName).toBe('SPAN')
    expect(badge.getAttribute('data-slot')).toBe('badge')
  })

  it('asChild=trueなら子要素として描画する', () => {
    render(
      <Badge asChild variant='outline'>
        <a href='/docs'>Docs Badge</a>
      </Badge>,
    )

    const linkBadge = screen.getByRole('link', { name: 'Docs Badge' })
    expect(linkBadge.tagName).toBe('A')
    expect(linkBadge.getAttribute('data-slot')).toBe('badge')
    expect(linkBadge.getAttribute('href')).toBe('/docs')
  })
})
