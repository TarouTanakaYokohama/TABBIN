import { tool } from 'ai'
import { z } from 'zod'
import { AI_CHAT_TOOL_DESCRIPTIONS } from '@/constants/aiChatTools'
import { inferUserInterests } from '@/features/ai-chat/lib/inferInterests'
import {
  DEFAULT_SAVED_URL_PAGE,
  DEFAULT_SAVED_URL_PAGE_SIZE,
  MAX_SAVED_URL_PAGE_SIZE,
  findSavedUrlsAddedInMonthPage,
  listSavedUrlPage,
  searchSavedUrlsPage,
} from '@/features/ai-chat/lib/savedUrlQuery'
import type {
  AiSavedUrlPage,
  AiSavedUrlRecord,
  AiSavedUrlToolItem,
} from '@/features/ai-chat/types'
import {
  generateAnalyticsResult,
  getDefaultAnalyticsQuery,
  normalizeAnalyticsQuery,
} from '@/features/analytics/lib/analytics'

const paginationSchema = z.object({
  page: z.number().int().min(1).default(DEFAULT_SAVED_URL_PAGE),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_SAVED_URL_PAGE_SIZE)
    .default(DEFAULT_SAVED_URL_PAGE_SIZE),
  sortDirection: z.enum(['desc', 'asc']).default('desc'),
})

const mapRecordForToolOutput = (
  record: AiSavedUrlRecord,
): AiSavedUrlToolItem => ({
  url: record.url,
  title: record.title,
  domain: record.domain,
  savedAt: record.savedAt,
  savedInProjects: record.savedInProjects,
  parentCategories: record.parentCategories,
})

const mapPageForToolOutput = (
  page: AiSavedUrlPage<AiSavedUrlRecord>,
): AiSavedUrlPage<AiSavedUrlToolItem> => ({
  ...page,
  items: page.items.map(mapRecordForToolOutput),
})

const createCurrentDateTimeOutput = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      month: '2-digit',
      second: '2-digit',
      year: 'numeric',
    })
      .formatToParts(now)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  ) as Record<string, string>

  const localDate = `${parts.year}-${parts.month}-${parts.day}`
  const localTime = `${parts.hour}:${parts.minute}:${parts.second}`

  return {
    iso8601: now.toISOString(),
    localDate,
    localDateTime: `${localDate} ${localTime}`,
    localTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    unixMs: now.getTime(),
  }
}

const createAiChatTools = (records: AiSavedUrlRecord[]) => ({
  getCurrentDateTime: tool({
    description: AI_CHAT_TOOL_DESCRIPTIONS.getCurrentDateTime,
    inputSchema: z.object({}),
    execute: async () => createCurrentDateTimeOutput(),
  }),
  listSavedUrls: tool({
    description: AI_CHAT_TOOL_DESCRIPTIONS.listSavedUrls,
    inputSchema: paginationSchema,
    execute: async input =>
      mapPageForToolOutput(listSavedUrlPage(records, input)),
  }),
  findUrlsByMonth: tool({
    description: AI_CHAT_TOOL_DESCRIPTIONS.findUrlsByMonth,
    inputSchema: paginationSchema.extend({
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
    }),
    execute: async input =>
      mapPageForToolOutput(findSavedUrlsAddedInMonthPage(records, input)),
  }),
  searchSavedUrls: tool({
    description: AI_CHAT_TOOL_DESCRIPTIONS.searchSavedUrls,
    inputSchema: paginationSchema.extend({
      query: z.string().min(1),
    }),
    execute: async input =>
      mapPageForToolOutput(searchSavedUrlsPage(records, input)),
  }),
  generateSavedTabsAnalytics: tool({
    description: AI_CHAT_TOOL_DESCRIPTIONS.generateSavedTabsAnalytics,
    inputSchema: z.object({
      chartType: z.enum(['area', 'bar', 'line', 'pie', 'radar']).default('bar'),
      compareBy: z.enum(['mode', 'none']).default('none'),
      customDateRange: z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .optional(),
      filters: z
        .object({
          excludedDomains: z.array(z.string()).default([]),
          excludedParentCategories: z.array(z.string()).default([]),
          excludedProjectCategories: z.array(z.string()).default([]),
          excludedProjects: z.array(z.string()).default([]),
          excludedSubCategories: z.array(z.string()).default([]),
          includedDomains: z.array(z.string()).default([]),
          includedParentCategories: z.array(z.string()).default([]),
          includedProjectCategories: z.array(z.string()).default([]),
          includedProjects: z.array(z.string()).default([]),
          includedSubCategories: z.array(z.string()).default([]),
        })
        .default(getDefaultAnalyticsQuery().filters),
      groupBy: z
        .enum([
          'domain',
          'parentCategory',
          'project',
          'projectCategory',
          'subCategory',
          'time',
          'timeRecent',
          'timeTop',
        ])
        .default('domain'),
      limit: z.number().int().min(1).max(20).default(8),
      mode: z.enum(['both', 'custom', 'domain']).default('both'),
      normalize: z.boolean().default(false),
      sort: z
        .enum(['label-asc', 'label-desc', 'value-asc', 'value-desc'])
        .default('value-desc'),
      stacked: z.boolean().default(false),
      timeBucket: z.enum(['day', 'month', 'week']).default('day'),
      timeRange: z
        .enum(['30d', '365d', '7d', '90d', 'all', 'custom'])
        .default('all'),
      title: z.string().trim().optional(),
    }),
    execute: async input =>
      generateAnalyticsResult(records, normalizeAnalyticsQuery(input)),
  }),
  inferUserInterests: tool({
    description: AI_CHAT_TOOL_DESCRIPTIONS.inferUserInterests,
    inputSchema: z.object({}),
    execute: async () => inferUserInterests(records),
  }),
})

export { createAiChatTools }
