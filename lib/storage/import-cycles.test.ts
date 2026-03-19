import { readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const storageDir = dirname(fileURLToPath(import.meta.url))
const sourceExtensions = new Set(['.ts', '.tsx'])
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g

const listSourceFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, {
    withFileTypes: true,
  })

  return entries.flatMap(entry => {
    const fullPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      return listSourceFiles(fullPath)
    }

    if (!sourceExtensions.has(extname(entry.name))) {
      return []
    }

    if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
      return []
    }

    return [fullPath]
  })
}

const resolveImportTarget = (
  specifier: string,
  sourceFile: string,
  files: Set<string>,
): string | null => {
  let basePath: string

  if (specifier.startsWith('@/lib/storage/')) {
    basePath = resolve(storageDir, specifier.slice('@/lib/storage/'.length))
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    basePath = resolve(dirname(sourceFile), specifier)
  } else {
    return null
  }

  const candidates = extname(basePath)
    ? [basePath]
    : [
        `${basePath}.ts`,
        `${basePath}.tsx`,
        join(basePath, 'index.ts'),
        join(basePath, 'index.tsx'),
      ]

  for (const candidate of candidates) {
    if (files.has(candidate)) {
      return candidate
    }
  }

  return null
}

const collectStaticImports = (
  sourceFile: string,
  files: Set<string>,
): string[] => {
  const source = readFileSync(sourceFile, 'utf8')
  const matches = source.matchAll(importPattern)
  const resolved = new Set<string>()

  for (const match of matches) {
    const specifier = match[1]
    const target = resolveImportTarget(specifier, sourceFile, files)

    if (target) {
      resolved.add(target)
    }
  }

  return [...resolved]
}

const normalizeCycle = (cycle: string[]): string => {
  const labels = cycle.map(file => relative(storageDir, file))
  const rotations = labels.map((_, index) =>
    [...labels.slice(index), ...labels.slice(0, index)].join(' -> '),
  )

  return rotations.sort()[0]
}

const findCycles = (graph: Map<string, string[]>): string[] => {
  const visited = new Set<string>()
  const stack: string[] = []
  const stackSet = new Set<string>()
  const cycles = new Set<string>()

  const visit = (node: string): void => {
    visited.add(node)
    stack.push(node)
    stackSet.add(node)

    for (const next of graph.get(node) ?? []) {
      if (!visited.has(next)) {
        visit(next)
        continue
      }

      if (!stackSet.has(next)) {
        continue
      }

      const cycleStart = stack.indexOf(next)
      const cycle = stack.slice(cycleStart)
      cycles.add(normalizeCycle(cycle))
    }

    stack.pop()
    stackSet.delete(node)
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      visit(node)
    }
  }

  return [...cycles].sort()
}

describe('lib/storage import graph', () => {
  it('静的 import cycle を持たない', () => {
    const files = new Set(listSourceFiles(storageDir))
    const graph = new Map(
      [...files].map(file => [file, collectStaticImports(file, files)]),
    )

    expect(findCycles(graph)).toEqual([])
  })
})
