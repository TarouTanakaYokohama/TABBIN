import { describe, expect, it } from 'vitest'
import {
  checkTailwindCanonicalClasses,
  formatTailwindCanonicalFindings,
  toCanonicalImportantClass,
} from './tailwind-canonical-checker'

describe('tailwind-canonical-checker', () => {
  it('detects important prefixes that Tailwind can write canonically as suffixes', () => {
    const findings = checkTailwindCanonicalClasses([
      {
        path: 'components/example.tsx',
        content: [
          "const className = 'relative m-0! hover:bg-red-500!'",
          "const otherClassName = '!relative ![margin:0]'",
          "const ignored = 'm-0! hover:bg-red-500!'",
          "const thirdClassName = '!-mt-2'",
        ].join('\n'),
      },
    ])

    expect(findings).toEqual([
      {
        path: 'components/example.tsx',
        line: 1,
        column: 29,
        className: '!m-0',
        suggestion: 'm-0!',
      },
      {
        path: 'components/example.tsx',
        line: 1,
        column: 34,
        className: 'hover:!bg-red-500',
        suggestion: 'hover:bg-red-500!',
      },
      {
        path: 'components/example.tsx',
        line: 2,
        column: 25,
        className: '!relative',
        suggestion: 'relative!',
      },
      {
        path: 'components/example.tsx',
        line: 2,
        column: 35,
        className: '![margin:0]',
        suggestion: '[margin:0]!',
      },
      {
        path: 'components/example.tsx',
        line: 4,
        column: 25,
        className: '!-mt-2',
        suggestion: '-mt-2!',
      },
    ])
  })

  it('ignores JavaScript negation outside Tailwind class strings', () => {
    const findings = checkTailwindCanonicalClasses([
      {
        path: 'components/example.tsx',
        content: [
          'if (!context || !items.length) return null',
          "const message = 'The class `!m-0` can be written as `m-0!`'",
        ].join('\n'),
      },
    ])

    expect(findings).toEqual([])
  })

  it('ignores template expressions inside Tailwind class strings', () => {
    const findings = checkTailwindCanonicalClasses([
      {
        path: 'components/example.tsx',
        content: [
          'const className = `flex $',
          "{active ? '!m-0' : ''} hover:!bg-red-500`",
        ].join(''),
      },
    ])

    expect(findings).toEqual([
      {
        path: 'components/example.tsx',
        line: 1,
        column: 49,
        className: 'hover:!bg-red-500',
        suggestion: 'hover:bg-red-500!',
      },
    ])
  })

  it('formats findings for CLI output', () => {
    const output = formatTailwindCanonicalFindings([
      {
        path: 'components/example.tsx',
        line: 3,
        column: 12,
        className: '!m-0',
        suggestion: 'm-0!',
      },
    ])

    expect(output).toBe(
      'components/example.tsx:3:12 The class `!m-0` can be written as `m-0!`',
    )
  })

  it('canonicalizes only likely Tailwind important classes', () => {
    expect(toCanonicalImportantClass('!')).toBeUndefined()
    expect(toCanonicalImportantClass('m-0')).toBeUndefined()
    expect(toCanonicalImportantClass('!foo')).toBeUndefined()
    expect(toCanonicalImportantClass('hover:!bg-red-500!')).toBeUndefined()
    expect(toCanonicalImportantClass('!@container')).toBe('@container!')
  })
})
