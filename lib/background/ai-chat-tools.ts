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
  inferUserInterests: tool({
    description: AI_CHAT_TOOL_DESCRIPTIONS.inferUserInterests,
    inputSchema: z.object({}),
    execute: async () => inferUserInterests(records),
  }),
})

export { createAiChatTools }
