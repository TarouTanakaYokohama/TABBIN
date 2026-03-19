// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const componentsRoot = path.join(repoRoot, 'components')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(entry => {
    const fullPath = path.join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      return walk(fullPath)
    }

    return [fullPath]
  })

const normalizePath = (filePath: string) =>
  path.relative(repoRoot, filePath).replaceAll(path.sep, '/')

const componentFiles = walk(componentsRoot)
  .map(normalizePath)
  .filter(
    filePath =>
      filePath.endsWith('.tsx') &&
      !filePath.endsWith('.stories.tsx') &&
      !filePath.endsWith('.test.tsx') &&
      !filePath.startsWith('components/storybook/'),
  )

const storyFiles = walk(componentsRoot)
  .map(normalizePath)
  .filter(filePath => filePath.endsWith('.stories.tsx'))

const coveredComponentFiles = storyFiles.flatMap(filePath => {
  const contents = readFileSync(path.join(repoRoot, filePath), 'utf8')

  return [...contents.matchAll(/@covers\s+([^\s]+)/g)].map(match => match[1])
})

describe('storybook component coverage', () => {
  it('covers every component in components/ with at least one story file', () => {
    const uncovered = componentFiles.filter(
      filePath => !coveredComponentFiles.includes(filePath),
    )

    expect(uncovered).toEqual([])
  })
})
