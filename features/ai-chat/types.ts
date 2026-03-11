import type { AiChatToolTrace, OllamaErrorDetails } from '@/types/background'

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

export interface AiChatConversationMessage {
  attachments?: AiChatAttachment[]
  charts?: AiChartSpec[]
  content: string
  id: string
  isStreaming?: boolean
  ollamaError?: OllamaErrorDetails
  reasoning?: string
  role: 'user' | 'assistant'
  toolTraces?: AiChatToolTrace[]
}

export interface AiChatConversation {
  createdAt: number
  id: string
  messages: AiChatConversationMessage[]
  title: string
  updatedAt: number
}

export interface AiChatHistoryItem {
  id: string
  isActive: boolean
  preview: string
  title: string
}

export interface InterestEvidenceEntry {
  value: string
  count: number
}

export type AiChartType = 'area' | 'bar' | 'line' | 'pie' | 'radar'

export type AiChartAxisFormat = 'count' | 'date' | 'label' | 'percent'

export interface AiChartSeries {
  colorToken: string
  dataKey: string
  label: string
}

export type AiChartDatum = Record<string, number | string | null>

export interface AiChartSpec {
  type: AiChartType
  title: string
  data: AiChartDatum[]
  series: AiChartSeries[]
  categoryKey?: string
  description?: string
  emptyMessage?: string
  showLegend?: boolean
  stacked?: boolean
  valueFormat?: AiChartAxisFormat
  xKey?: string
}

export interface InterestInferenceResult {
  summary: string
  isTentative: boolean
  evidence: {
    topDomains: InterestEvidenceEntry[]
    topCategories: InterestEvidenceEntry[]
  }
  chartSpecs: AiChartSpec[]
}
