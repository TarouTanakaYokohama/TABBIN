// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const storyRoots = [
  path.join(repoRoot, 'components'),
  path.join(repoRoot, 'features'),
]

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

const storyFiles = storyRoots
  .flatMap(walk)
  .map(normalizePath)
  .filter(filePath => filePath.endsWith('.stories.tsx'))

const getStoryExports = (filePath: string) => {
  const contents = readFileSync(path.join(repoRoot, filePath), 'utf8')

  return [...contents.matchAll(/export const (\w+)\s*:\s*Story\b/g)].map(
    match => match[1],
  )
}

describe('storybook story exports', () => {
  it('uses unique named story exports across all story files', () => {
    const exportMap = new Map<string, string[]>()

    for (const filePath of storyFiles) {
      for (const exportName of getStoryExports(filePath)) {
        exportMap.set(exportName, [
          ...(exportMap.get(exportName) ?? []),
          filePath,
        ])
      }
    }

    const duplicates = [...exportMap.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([exportName, files]) => ({ exportName, files }))

    expect(duplicates).toEqual([])
  })
})
