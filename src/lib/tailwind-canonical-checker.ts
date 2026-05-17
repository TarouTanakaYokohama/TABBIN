interface TailwindCanonicalSource {
  path: string
  content: string
}

interface TailwindCanonicalFinding {
  path: string
  line: number
  column: number
  className: string
  suggestion: string
}

const STRING_LITERAL_PATTERN =
  /(["'`])((?:\\[\s\S]|\$\{[\s\S]*?\}|(?!\1)[\s\S])*?)\1/g
const CLASS_TOKEN_PATTERN = /[^\s"'`{}(),]+/g
const BARE_TAILWIND_UTILITIES = new Set([
  'absolute',
  'block',
  'contents',
  'fixed',
  'flex',
  'grid',
  'hidden',
  'inline',
  'inline-block',
  'inline-flex',
  'inline-grid',
  'relative',
  'sticky',
])

function toCanonicalImportantClass(className: string): string | undefined {
  const importantIndex = className.lastIndexOf('!')

  if (importantIndex === -1 || importantIndex === className.length - 1) {
    return undefined
  }

  const beforeImportant = className.slice(0, importantIndex)
  const utility = className.slice(importantIndex + 1)

  if (!isLikelyTailwindUtility(utility)) {
    return undefined
  }

  return `${beforeImportant}${utility}!`
}

function checkTailwindCanonicalClasses(
  sources: TailwindCanonicalSource[],
): TailwindCanonicalFinding[] {
  return sources.flatMap(checkTailwindCanonicalSource)
}

function checkTailwindCanonicalSource(
  source: TailwindCanonicalSource,
): TailwindCanonicalFinding[] {
  const lineStarts = getLineStarts(source.content)
  const findings: TailwindCanonicalFinding[] = []

  for (const stringMatch of source.content.matchAll(STRING_LITERAL_PATTERN)) {
    findings.push(...checkStringLiteral(source, lineStarts, stringMatch))
  }

  return findings
}

function checkStringLiteral(
  source: TailwindCanonicalSource,
  lineStarts: number[],
  stringMatch: RegExpMatchArray,
): TailwindCanonicalFinding[] {
  if (
    !isTailwindClassStringContext(source.content, stringMatch.index as number)
  ) {
    return []
  }

  const stringContent = stripTemplateExpressions(stringMatch[2])
  const stringContentStart = (stringMatch.index as number) + 1
  const findings: TailwindCanonicalFinding[] = []

  for (const tokenMatch of stringContent.matchAll(CLASS_TOKEN_PATTERN)) {
    const finding = createFinding(
      source,
      lineStarts,
      stringContentStart,
      tokenMatch,
    )

    if (finding) {
      findings.push(finding)
    }
  }

  return findings
}

function createFinding(
  source: TailwindCanonicalSource,
  lineStarts: number[],
  stringContentStart: number,
  tokenMatch: RegExpMatchArray,
): TailwindCanonicalFinding | undefined {
  const className = tokenMatch[0]
  const suggestion = toCanonicalImportantClass(className)

  if (!suggestion) {
    return undefined
  }

  const classStart = stringContentStart + (tokenMatch.index as number)
  const position = getLineColumn(lineStarts, classStart)

  return {
    path: source.path,
    line: position.line,
    column: position.column,
    className,
    suggestion,
  }
}

function isTailwindClassStringContext(
  content: string,
  stringStart: number,
): boolean {
  const context = content.slice(Math.max(0, stringStart - 120), stringStart)

  return (
    /(?:[A-Za-z0-9_]*[Cc]lassName|class)\s*[=:]?\s*$/.test(context) ||
    /(?:cn|clsx|cva|twMerge|buttonVariants|buttonGroupVariants)\([^)]*$/.test(
      context,
    )
  )
}

function stripTemplateExpressions(content: string): string {
  return content.replace(/\$\{[\s\S]*?\}/g, match => ' '.repeat(match.length))
}

function isLikelyTailwindUtility(utility: string): boolean {
  const baseUtility = utility.split('/')[0]

  return (
    baseUtility.includes('-') ||
    baseUtility.includes('[') ||
    baseUtility.includes(']') ||
    baseUtility.startsWith('@') ||
    BARE_TAILWIND_UTILITIES.has(baseUtility)
  )
}

function formatTailwindCanonicalFindings(
  findings: TailwindCanonicalFinding[],
): string {
  return findings
    .map(
      finding =>
        `${finding.path}:${finding.line}:${finding.column} The class \`${finding.className}\` can be written as \`${finding.suggestion}\``,
    )
    .join('\n')
}

function getLineStarts(content: string): number[] {
  const lineStarts = [0]

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') {
      lineStarts.push(index + 1)
    }
  }

  return lineStarts
}

function getLineColumn(
  lineStarts: number[],
  offset: number,
): { line: number; column: number } {
  let low = 0
  let high = lineStarts.length - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const lineStart = lineStarts[middle]
    const nextLineStart = lineStarts[middle + 1] ?? Number.POSITIVE_INFINITY

    if (offset < lineStart) {
      high = middle - 1
      continue
    }

    if (offset >= nextLineStart) {
      low = middle + 1
      continue
    }

    return {
      line: middle + 1,
      column: offset - lineStart + 1,
    }
  }

  /* v8 ignore next -- defensive fallback for malformed line offset tables */
  return { line: 1, column: offset + 1 }
}

export type { TailwindCanonicalFinding, TailwindCanonicalSource }
export {
  checkTailwindCanonicalClasses,
  formatTailwindCanonicalFindings,
  toCanonicalImportantClass,
}
