export interface AiSavedUrlRecord {
  id: string
  url: string
  title: string
  domain: string
  savedAt: number
  savedInTabGroups: string[]
  savedInProjects: string[]
  subCategories: string[]
  projectCategories: string[]
  parentCategories: string[]
}

export type AiSavedUrlSortDirection = 'asc' | 'desc'

export interface AiSavedUrlPageOptions {
  page?: number
  pageSize?: number
  sortDirection?: AiSavedUrlSortDirection
}

export interface AiSavedUrlToolItem {
  url: string
  title: string
  domain: string
  savedAt: number
  savedInProjects: string[]
  parentCategories: string[]
}

export interface AiSavedUrlPage<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  sortDirection: AiSavedUrlSortDirection
}

export interface AiChatAttachment {
  filename: string
  mediaType: string
  kind: 'text' | 'image'
  content: string
}

export interface InterestEvidenceEntry {
  value: string
  count: number
}

export interface InterestInferenceResult {
  summary: string
  isTentative: boolean
  evidence: {
    topDomains: InterestEvidenceEntry[]
    topCategories: InterestEvidenceEntry[]
  }
}
