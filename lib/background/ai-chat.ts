import { generateText, stepCountIs } from 'ai'
import { createOllama } from 'ai-sdk-ollama'
import { AI_CHAT_TOOL_TITLES } from '@/constants/aiChatTools'
import { buildTextAttachmentContext } from '@/features/ai-chat/lib/attachments'
import { buildAiSavedUrlRecords } from '@/features/ai-chat/lib/buildAiContext'
import { listSavedUrlPage } from '@/features/ai-chat/lib/savedUrlQuery'
import {
  buildFinalSystemPrompt,
  getActiveAiSystemPrompt,
  normalizeAiSystemPromptSettings,
} from '@/features/ai-chat/lib/systemPromptPresets'
import type {
  AiChatAttachment,
  AiSavedUrlRecord,
} from '@/features/ai-chat/types'
import { getParentCategories } from '@/lib/storage/categories'
import { getCustomProjects } from '@/lib/storage/projects'
import { getUserSettings } from '@/lib/storage/settings'
import { getUrlRecords } from '@/lib/storage/urls'
import type { AiChatToolTrace, OllamaErrorDetails } from '@/types/background'
import { createAiChatTools } from './ai-chat-tools'

interface OllamaModelOption {
  name: string
  label: string
  modifiedAt?: string
}

interface AiChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: AiChatAttachment[]
}

interface AiChatRequest {
  prompt: string
  history: AiChatHistoryMessage[]
  attachments?: AiChatAttachment[]
}

interface AiChatResult {
  answer: string
  recordCount: number
  reasoning: string
  toolTraces: AiChatToolTrace[]
}

interface AiChatStepUpdate {
  reasoning: string
  toolTraces: AiChatToolTrace[]
}

interface RunAiChatRequestOptions {
  onStepUpdate?: (update: AiChatStepUpdate) => void
}

const OLLAMA_BASE_URL = 'http://localhost:11434'
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`
const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download'
const OLLAMA_FAQ_URL =
  'https://docs.ollama.com/faq#how-do-i-configure-ollama-server'

type OllamaStructuredError = Error & {
  ollamaError: OllamaErrorDetails
}

const getExtensionOrigin = (): string | null => {
  try {
    const extensionUrl = chrome?.runtime?.getURL?.('')
    if (extensionUrl) {
      const parsedUrl = new URL(extensionUrl)
      if (parsedUrl.protocol && parsedUrl.host) {
        return `${parsedUrl.protocol}//${parsedUrl.host}`
      }
    }
  } catch {
    // fallback to runtime.id
  }

  const extensionId = chrome?.runtime?.id
  return extensionId ? `chrome-extension://${extensionId}` : null
}

const getConfiguredOllamaOrigin = (): string => {
  const extensionOrigin = getExtensionOrigin()

  return extensionOrigin ?? 'chrome-extension://*'
}

const createBaseOllamaErrorDetails = (): Pick<
  OllamaErrorDetails,
  'baseUrl' | 'downloadUrl' | 'faqUrl' | 'tagsUrl'
> => ({
  baseUrl: OLLAMA_BASE_URL,
  downloadUrl: OLLAMA_DOWNLOAD_URL,
  faqUrl: OLLAMA_FAQ_URL,
  tagsUrl: OLLAMA_TAGS_URL,
})

const createOllamaSetupInstructions = (): string =>
  (() => {
    const configuredOrigin = getConfiguredOllamaOrigin()

    return [
      `接続先 URL: ${OLLAMA_BASE_URL}`,
      `確認 URL: ${OLLAMA_TAGS_URL}`,
      `確認コマンド: curl ${OLLAMA_TAGS_URL}`,
      'macOS で Ollama.app を使う場合:',
      'Spotlight 検索で「ターミナル」と入力して開きます。',
      '次のコマンドをコピーして貼り付けます。',
      `launchctl setenv OLLAMA_ORIGINS "${configuredOrigin}"`,
      'return キーを押します。',
      'Ollama.app を終了します。',
      'Ollama.app を起動し直します。',
      `FAQ: ${OLLAMA_FAQ_URL}`,
    ].join('\n')
  })()

const createOllamaForbiddenErrorMessage = (): string => {
  const allowedOrigins = getConfiguredOllamaOrigin()

  return [
    'Ollama が拡張機能からのアクセスを拒否しました (403 Forbidden)。',
    `OLLAMA_ORIGINS に ${allowedOrigins} を設定してください。`,
    createOllamaSetupInstructions(),
  ].join('\n')
}

const createOllamaConnectionErrorMessage = (): string => {
  return [
    'Ollama に接続できませんでした。',
    `まだインストールしていない場合: ${OLLAMA_DOWNLOAD_URL}`,
    createOllamaSetupInstructions(),
  ].join('\n')
}

const createOllamaError = (
  message: string,
  ollamaError: OllamaErrorDetails,
): OllamaStructuredError =>
  Object.assign(new Error(message), {
    ollamaError,
  })

const createOllamaForbiddenError = (): OllamaStructuredError =>
  createOllamaError(createOllamaForbiddenErrorMessage(), {
    ...createBaseOllamaErrorDetails(),
    allowedOrigins: getConfiguredOllamaOrigin(),
    kind: 'forbidden',
  })

const createOllamaConnectionError = (): OllamaStructuredError =>
  createOllamaError(createOllamaConnectionErrorMessage(), {
    ...createBaseOllamaErrorDetails(),
    allowedOrigins: getConfiguredOllamaOrigin(),
    kind: 'notInstalledOrNotRunning',
  })

const isForbiddenError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('403') && message.toLowerCase().includes('forbidden')
}

const isConnectionError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  const normalizedMessage = message.toLowerCase()

  return (
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('econnrefused')
  )
}

const createContextSummary = (records: AiSavedUrlRecord[]): string =>
  (() => {
    const recentSavedUrlPage = listSavedUrlPage(records, {
      page: 1,
      pageSize: 20,
      sortDirection: 'desc',
    })

    return [
      `保存済みタブの件数: ${recentSavedUrlPage.totalItems}`,
      '最近保存したタブ一覧:',
      ...recentSavedUrlPage.items.map(
        (record, index) =>
          `${index + 1}. ${record.title} | ${record.url} | domain=${record.domain}`,
      ),
    ].join('\n')
  })()

const createUserMessageContent = (
  content: string,
  attachments: AiChatAttachment[] = [],
) => {
  if (attachments.length === 0) {
    return content
  }

  const textAttachmentContext = buildTextAttachmentContext(attachments)
  const text = [content, textAttachmentContext].filter(Boolean).join('\n\n')
  const imageAttachments = attachments.filter(
    attachment => attachment.kind === 'image',
  )

  return [
    {
      text,
      type: 'text' as const,
    },
    ...imageAttachments.map(attachment => ({
      data: attachment.content,
      mediaType: attachment.mediaType,
      type: 'file' as const,
    })),
  ]
}

const getStringValue = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

const getToolTitle = (toolName: string): string =>
  AI_CHAT_TOOL_TITLES[toolName as keyof typeof AI_CHAT_TOOL_TITLES] || toolName

const getToolResultCount = (output: unknown): number | null => {
  if (Array.isArray(output)) {
    return output.length
  }

  if (
    output &&
    typeof output === 'object' &&
    Array.isArray((output as { items?: unknown[] }).items)
  ) {
    return (output as { items: unknown[] }).items.length
  }

  return null
}

const getPaginatedToolTotalCount = (output: unknown): number | null => {
  if (!output || typeof output !== 'object') {
    return null
  }

  const totalItems = (output as { totalItems?: unknown }).totalItems
  return typeof totalItems === 'number' ? totalItems : null
}

interface GenerateTextToolCallLike {
  input: unknown
  toolCallId: string
  toolName: string
}

interface GenerateTextToolResultLike {
  output?: unknown
  toolCallId: string
}

interface GenerateTextResultLike {
  steps?: Array<{
    toolCalls?: GenerateTextToolCallLike[]
    toolResults?: GenerateTextToolResultLike[]
  }>
  toolCalls?: GenerateTextToolCallLike[]
  toolResults?: GenerateTextToolResultLike[]
}

const getAllToolCalls = (
  result: GenerateTextResultLike,
): GenerateTextToolCallLike[] => {
  const mergedToolCalls = [
    ...(result.steps ?? []).flatMap(step => step.toolCalls ?? []),
    ...(result.toolCalls ?? []),
  ]
  const seen = new Set<string>()

  return mergedToolCalls.filter(toolCall => {
    if (seen.has(toolCall.toolCallId)) {
      return false
    }

    seen.add(toolCall.toolCallId)
    return true
  })
}

const getAllToolResults = (
  result: GenerateTextResultLike,
): GenerateTextToolResultLike[] => {
  const mergedToolResults = [
    ...(result.steps ?? []).flatMap(step => step.toolResults ?? []),
    ...(result.toolResults ?? []),
  ]
  const seen = new Set<string>()

  return mergedToolResults.filter(toolResult => {
    if (seen.has(toolResult.toolCallId)) {
      return false
    }

    seen.add(toolResult.toolCallId)
    return true
  })
}

const createToolTracesFromParts = ({
  toolCalls,
  toolResults,
}: {
  toolCalls: GenerateTextToolCallLike[]
  toolResults: GenerateTextToolResultLike[]
}): AiChatToolTrace[] => {
  const toolResultsById = new Map(
    toolResults.map(toolResult => [toolResult.toolCallId, toolResult]),
  )

  return toolCalls.map(toolCall => {
    const toolResult = toolResultsById.get(toolCall.toolCallId)

    return {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      title: getToolTitle(toolCall.toolName),
      type: 'dynamic-tool',
      state: toolResult ? 'output-available' : 'input-available',
      input: toolCall.input,
      output: toolResult?.output,
      errorText: undefined,
    }
  })
}

const createToolTraces = (
  result: GenerateTextResultLike,
): AiChatToolTrace[] => {
  return createToolTracesFromParts({
    toolCalls: getAllToolCalls(result),
    toolResults: getAllToolResults(result),
  })
}

const summarizePromptIntent = (prompt: string): string => {
  if (/どんな|一覧|何が|何の/i.test(prompt)) {
    return '保存済みタブの一覧確認'
  }
  if (/好き|興味|傾向/i.test(prompt)) {
    return '保存傾向の推定'
  }
  if (/月|追加|いつ/i.test(prompt)) {
    return '期間や追加時期の確認'
  }
  return '保存済みタブの検索と要約'
}

const summarizeToolTrace = (toolTrace: AiChatToolTrace): string => {
  const resultCount = getToolResultCount(toolTrace.output)
  const totalItems = getPaginatedToolTotalCount(toolTrace.output)

  if (resultCount !== null) {
    return totalItems !== null && totalItems !== resultCount
      ? `${resultCount} 件を取得しました。総件数は ${totalItems} 件です。`
      : `${resultCount} 件の結果を確認しました。`
  }
  if (toolTrace.output) {
    return '結果を取得しました。'
  }
  return '呼び出し内容を確認しました。'
}

const createReasoningSummary = ({
  prompt,
  recordCount,
  toolTraces,
}: {
  prompt: string
  recordCount: number
  toolTraces: AiChatToolTrace[]
}): string =>
  [
    `- 質問の解釈: ${summarizePromptIntent(prompt)}`,
    `- 参照対象: 保存済みタブ ${recordCount} 件`,
    `- 使用ツール: ${
      toolTraces.length > 0
        ? toolTraces.map(toolTrace => toolTrace.title).join('、')
        : 'なし'
    }`,
    `- 回答方針: ${
      toolTraces.length > 0
        ? 'ツール結果を保存済みタブの根拠として使って回答しました。'
        : '保存済みタブの要約コンテキストを直接参照して回答しました。'
    }`,
    ...toolTraces.map(
      toolTrace => `- ${toolTrace.title}: ${summarizeToolTrace(toolTrace)}`,
    ),
  ].join('\n')

const mergeToolTraces = (
  currentToolTraces: AiChatToolTrace[],
  nextToolTraces: AiChatToolTrace[],
): AiChatToolTrace[] => {
  const mergedToolTraces = [...currentToolTraces]

  for (const nextToolTrace of nextToolTraces) {
    const existingIndex = mergedToolTraces.findIndex(
      toolTrace => toolTrace.toolCallId === nextToolTrace.toolCallId,
    )

    if (existingIndex === -1) {
      mergedToolTraces.push(nextToolTrace)
      continue
    }

    mergedToolTraces[existingIndex] = nextToolTrace
  }

  return mergedToolTraces
}

const listLocalOllamaModels = async (
  fetchImpl: typeof fetch = fetch,
): Promise<OllamaModelOption[]> => {
  let response: Response

  try {
    response = await fetchImpl(OLLAMA_TAGS_URL, {
      method: 'GET',
    })
  } catch (error) {
    if (isConnectionError(error)) {
      throw createOllamaConnectionError()
    }
    throw error
  }

  if (response.status === 403) {
    throw createOllamaForbiddenError()
  }

  if (!response.ok) {
    throw new Error('Failed to fetch Ollama models')
  }

  const payload = (await response.json()) as Record<string, unknown>
  const models = Array.isArray(payload.models) ? payload.models : []

  return models.flatMap(model => {
    if (!model || typeof model !== 'object') {
      return []
    }

    const modelRecord = model as Record<string, unknown>
    const name = getStringValue(modelRecord, 'name')
    if (!name) {
      return []
    }

    const modifiedAt = getStringValue(modelRecord, 'modified_at')
    const details =
      modelRecord.details && typeof modelRecord.details === 'object'
        ? (modelRecord.details as Record<string, unknown>)
        : null
    const parameterSize = details
      ? getStringValue(details, 'parameter_size')
      : undefined

    return [
      {
        name,
        label: parameterSize ? `${name} (${parameterSize})` : name,
        modifiedAt,
      },
    ]
  })
}

const runAiChatRequest = async (
  { attachments = [], history, prompt }: AiChatRequest,
  options: RunAiChatRequestOptions = {},
): Promise<AiChatResult> => {
  const settings = normalizeAiSystemPromptSettings(await getUserSettings())
  const activeSystemPrompt = getActiveAiSystemPrompt(settings)

  if (!settings.ollamaModel) {
    throw new Error('Ollama model is not configured')
  }
  const ollamaModel = settings.ollamaModel

  const [urlRecords, customProjects, parentCategories, savedTabsResult] =
    await Promise.all([
      getUrlRecords(),
      getCustomProjects(),
      getParentCategories(),
      chrome.storage.local.get('savedTabs'),
    ])

  const records = buildAiSavedUrlRecords({
    customProjects,
    parentCategories,
    savedTabs: Array.isArray(savedTabsResult.savedTabs)
      ? savedTabsResult.savedTabs
      : [],
    urlRecords,
  })

  const ollama = createOllama({
    baseURL: OLLAMA_BASE_URL,
  })

  const tools = createAiChatTools(records)
  let streamedToolTraces: AiChatToolTrace[] = []

  const result = await (async () => {
    try {
      return await generateText({
        model: ollama(ollamaModel),
        system: buildFinalSystemPrompt({
          savedUrlContext: createContextSummary(records),
          template: activeSystemPrompt.template,
        }),
        messages: [
          ...history.map(message =>
            message.role === 'user'
              ? {
                  role: 'user' as const,
                  content: createUserMessageContent(
                    message.content,
                    message.attachments,
                  ),
                }
              : {
                  role: message.role,
                  content: message.content,
                },
          ),
          {
            role: 'user' as const,
            content: createUserMessageContent(prompt, attachments),
          },
        ],
        onStepFinish: stepResult => {
          const stepToolTraces = createToolTracesFromParts({
            toolCalls: stepResult.toolCalls ?? [],
            toolResults: stepResult.toolResults ?? [],
          })

          streamedToolTraces = mergeToolTraces(
            streamedToolTraces,
            stepToolTraces,
          )

          options.onStepUpdate?.({
            reasoning: createReasoningSummary({
              prompt,
              recordCount: records.length,
              toolTraces: streamedToolTraces,
            }),
            toolTraces: streamedToolTraces,
          })
        },
        stopWhen: stepCountIs(5),
        tools,
      })
    } catch (error) {
      if (isForbiddenError(error)) {
        throw createOllamaForbiddenError()
      }
      if (isConnectionError(error)) {
        throw createOllamaConnectionError()
      }
      throw error
    }
  })()

  const toolTraces = mergeToolTraces(
    streamedToolTraces,
    createToolTraces(result),
  )

  return {
    answer: result.text,
    recordCount: records.length,
    reasoning: createReasoningSummary({
      prompt,
      recordCount: records.length,
      toolTraces,
    }),
    toolTraces,
  }
}

export type {
  AiChatHistoryMessage,
  AiChatRequest,
  AiChatResult,
  OllamaModelOption,
}
export { listLocalOllamaModels, runAiChatRequest }
