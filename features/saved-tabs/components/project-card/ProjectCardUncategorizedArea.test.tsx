// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('ProjectCardUncategorizedArea', () => {
  it('shared ui button を使い、生の button 要素を残さない', () => {
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        './ProjectCardUncategorizedArea.tsx',
      ),
      'utf8',
    )

    expect(source).toContain("from '@/components/ui/button'")
    expect(source).not.toContain('<button')
  })
})
