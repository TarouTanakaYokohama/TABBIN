import Fuse from 'fuse.js'
import { getProjectUrls } from '@/lib/storage/projects'
import type { CustomProject } from '@/types/storage'

interface FilterCustomProjectsByQueryParams {
  customProjects: CustomProject[]
  searchQuery: string
  loadProjectUrls?: typeof getProjectUrls
}

const projectFuseOptions = {
  keys: ['name'],
  threshold: 0.4,
}

const projectUrlFuseOptions = {
  keys: ['title', 'url'],
  threshold: 0.4,
}

const mapMatchedUrlsToProject = (
  project: CustomProject,
  matchedUrls: Awaited<ReturnType<typeof getProjectUrls>>,
): CustomProject => {
  const matchedUrlIds = matchedUrls.map(url => url.id)

  return {
    ...project,
    urlIds: matchedUrlIds,
    urls: matchedUrls.map(url => ({
      url: url.url,
      title: url.title,
      notes: url.notes,
      savedAt: url.savedAt,
      category: url.category,
    })),
    urlMetadata: project.urlMetadata
      ? Object.fromEntries(
          Object.entries(project.urlMetadata).filter(([id]) =>
            matchedUrlIds.includes(id),
          ),
        )
      : project.urlMetadata,
  }
}

export const filterCustomProjectsByQuery = async ({
  customProjects,
  searchQuery,
  loadProjectUrls = getProjectUrls,
}: FilterCustomProjectsByQueryParams): Promise<CustomProject[]> => {
  const normalizedQuery = searchQuery.trim()
  if (!normalizedQuery) {
    return customProjects
  }

  const matchedProjects = new Fuse(customProjects, projectFuseOptions)
    .search(normalizedQuery)
    .map(result => result.item)

  const urlMatchedProjects = await Promise.all(
    customProjects
      .filter(project => !matchedProjects.includes(project))
      .map(async project => {
        const projectUrls = await loadProjectUrls(project)
        const searchableUrls = Array.isArray(projectUrls) ? projectUrls : []
        const matchedUrls = new Fuse(searchableUrls, projectUrlFuseOptions)
          .search(normalizedQuery)
          .map(result => result.item)
          .filter(
            (url, index, items) =>
              items.findIndex(item => item.url === url.url) === index,
          )

        if (matchedUrls.length === 0) {
          return null
        }

        return mapMatchedUrlsToProject(project, matchedUrls)
      }),
  )

  const uniqueProjects = new Map<string, CustomProject>()
  for (const project of [...matchedProjects, ...urlMatchedProjects]) {
    if (!project) {
      continue
    }
    uniqueProjects.set(project.id, project)
  }

  return Array.from(uniqueProjects.values())
}
