import type { CustomProject, ProjectKeywordSettings } from '@/types/storage'

interface SavedTabKeywordMatchTarget {
  title: string
  url: string
}

interface FindMatchingProjectIdForSavedTabParams {
  projects: CustomProject[]
  savedTab: SavedTabKeywordMatchTarget
  projectOrder: string[]
}

const normalizeKeywordArray = (keywords: string[] | undefined): string[] => {
  if (!Array.isArray(keywords)) {
    return []
  }

  const normalizedKeywords: string[] = []
  const seen = new Set<string>()

  for (const keyword of keywords) {
    if (typeof keyword !== 'string') {
      continue
    }
    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) {
      continue
    }
    const normalizedKeyword = trimmedKeyword.toLowerCase()
    if (seen.has(normalizedKeyword)) {
      continue
    }
    seen.add(normalizedKeyword)
    normalizedKeywords.push(trimmedKeyword)
  }

  return normalizedKeywords
}

const getDomainFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

const includesKeyword = (target: string, keywords: string[]): boolean => {
  const normalizedTarget = target.toLowerCase()
  return keywords.some(keyword =>
    normalizedTarget.includes(keyword.toLowerCase()),
  )
}

const projectMatchesSavedTab = (
  project: CustomProject,
  savedTab: SavedTabKeywordMatchTarget,
): boolean => {
  const projectKeywords = normalizeProjectKeywords(project.projectKeywords)
  if (
    projectKeywords.titleKeywords.length === 0 &&
    projectKeywords.urlKeywords.length === 0 &&
    projectKeywords.domainKeywords.length === 0
  ) {
    return false
  }

  return (
    includesKeyword(savedTab.title, projectKeywords.titleKeywords) ||
    includesKeyword(savedTab.url, projectKeywords.urlKeywords) ||
    includesKeyword(
      getDomainFromUrl(savedTab.url),
      projectKeywords.domainKeywords,
    )
  )
}

const buildOrderedProjects = (
  projects: CustomProject[],
  projectOrder: string[],
): CustomProject[] => {
  const projectById = new Map(projects.map(project => [project.id, project]))
  const orderedProjects = projectOrder
    .map(projectId => projectById.get(projectId))
    .filter((project): project is CustomProject => Boolean(project))
  const remainingProjects = projects.filter(
    project => !projectOrder.includes(project.id),
  )
  return [...orderedProjects, ...remainingProjects]
}

const normalizeProjectKeywords = (
  projectKeywords: ProjectKeywordSettings | undefined,
): ProjectKeywordSettings => ({
  titleKeywords: normalizeKeywordArray(projectKeywords?.titleKeywords),
  urlKeywords: normalizeKeywordArray(projectKeywords?.urlKeywords),
  domainKeywords: normalizeKeywordArray(projectKeywords?.domainKeywords),
})

const findMatchingProjectIdForSavedTab = ({
  projects,
  savedTab,
  projectOrder,
}: FindMatchingProjectIdForSavedTabParams): string | undefined => {
  const orderedProjects = buildOrderedProjects(projects, projectOrder)
  const matchedProject = orderedProjects.find(project =>
    projectMatchesSavedTab(project, savedTab),
  )
  return matchedProject?.id
}

export { findMatchingProjectIdForSavedTab, normalizeProjectKeywords }
