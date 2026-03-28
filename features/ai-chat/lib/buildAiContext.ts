import type { AiSavedUrlRecord } from '@/features/ai-chat/types'
import type {
  CustomProject,
  ParentCategory,
  TabGroup,
  UrlRecord,
} from '@/types/storage'
import { isTimestampInLocalMonth } from '@/utils/localDateTime'

const getDomainFromUrl = (value: string): string => {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

const unique = (values: string[]): string[] => [...new Set(values)]

interface BuildAiSavedUrlRecordsInput {
  urlRecords: UrlRecord[]
  savedTabs: TabGroup[]
  customProjects: CustomProject[]
  parentCategories: ParentCategory[]
}

export const buildAiSavedUrlRecords = ({
  urlRecords,
  savedTabs,
  customProjects,
  parentCategories,
}: BuildAiSavedUrlRecordsInput): AiSavedUrlRecord[] =>
  urlRecords
    .map(record => {
      const matchingGroups = savedTabs.filter(group =>
        group.urlIds?.includes(record.id),
      )
      const matchingProjects = customProjects.filter(project =>
        project.urlIds?.includes(record.id),
      )
      const subCategories = unique(
        matchingGroups
          .map(group => group.urlSubCategories?.[record.id])
          .filter((value): value is string => typeof value === 'string'),
      )
      const projectCategories = unique(
        matchingProjects
          .map(project => project.urlMetadata?.[record.id]?.category)
          .filter((value): value is string => typeof value === 'string'),
      )
      const parentCategoryNames = unique(
        matchingGroups.flatMap(group =>
          parentCategories
            .filter(
              category =>
                category.domains.includes(group.id) ||
                category.domainNames.includes(group.domain),
            )
            .map(category => category.name),
        ),
      )

      return {
        id: record.id,
        url: record.url,
        title: record.title,
        domain: getDomainFromUrl(record.url),
        savedAt: record.savedAt,
        savedInTabGroups: unique(matchingGroups.map(group => group.domain)),
        savedInProjects: unique(matchingProjects.map(project => project.name)),
        subCategories,
        projectCategories,
        parentCategories: parentCategoryNames,
      }
    })
    .sort((left, right) => right.savedAt - left.savedAt)

export const findUrlsAddedInMonth = (
  records: AiSavedUrlRecord[],
  year: number,
  month: number,
  timeZone?: string,
): AiSavedUrlRecord[] => {
  return records.filter(record =>
    isTimestampInLocalMonth(record.savedAt, year, month, timeZone),
  )
}

export const searchSavedUrls = (
  records: AiSavedUrlRecord[],
  query: string,
): AiSavedUrlRecord[] => {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return records
  }

  return records.filter(record => {
    const haystacks = [
      record.title,
      record.url,
      record.domain,
      ...record.savedInProjects,
      ...record.subCategories,
      ...record.projectCategories,
      ...record.parentCategories,
    ]

    return haystacks.some(value =>
      value.toLowerCase().includes(normalizedQuery),
    )
  })
}
