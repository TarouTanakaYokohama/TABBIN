import {
  Check,
  ChevronDown,
  Copy,
  MessageCircleMore,
  Paperclip,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  type PromptInputProps,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Shimmer } from '@/components/ai-elements/shimmer'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AI_CHAT_TOOL_DEFINITIONS } from '@/constants/aiChatTools'
import { AiChartRenderer } from '@/features/ai-chat/components/AiChartRenderer'
import {
  OllamaErrorNotice,
  type OllamaErrorPlatform,
} from '@/features/ai-chat/components/OllamaErrorNotice'
import { OllamaModelSelector } from '@/features/ai-chat/components/OllamaModelSelector'
import {
  AI_CHAT_MAX_ATTACHMENTS,
  AI_CHAT_MAX_ATTACHMENT_SIZE_BYTES,
  convertPromptInputFilesToAiChatAttachments,
  getAiChatAttachmentInputAccept,
} from '@/features/ai-chat/lib/attachments'
import {
  MAX_AI_SYSTEM_PROMPT_NAME_LENGTH,
  MAX_AI_SYSTEM_PROMPT_PRESETS,
  createAiSystemPromptPreset,
  getActiveAiSystemPrompt,
  normalizeAiSystemPromptSettings,
} from '@/features/ai-chat/lib/systemPromptPresets'
import type {
  AiChatAttachment,
  AiChatConversationMessage,
} from '@/features/ai-chat/types'
import {
  getChromeStorageOnChanged,
  warnMissingChromeStorage,
} from '@/lib/browser/chrome-storage'
import { connectRuntimePort, sendRuntimeMessage } from '@/lib/browser/runtime'
import {
  defaultSettings,
  getUserSettings,
  saveUserSettings,
} from '@/lib/storage/settings'
import { cn } from '@/lib/utils'
import type {
  AiChatResponse,
  AiChatStreamServerMessage,
  AiChatToolTrace,
  OllamaErrorDetails,
  OllamaModelListResponse,
} from '@/types/background'
import { AI_CHAT_STREAM_PORT_NAME } from '@/types/background'
import type { AiSystemPromptPreset, UserSettings } from '@/types/storage'

type ChatMessage = AiChatConversationMessage

interface ChatMessageSource {
  title: string
  url: string
}

interface SavedTabsChatPanelProps {
  activeSystemPromptId: string
  chatErrorMessage: string
  chatOllamaError?: OllamaErrorDetails
  input: string
  isConversationCopied: boolean
  isCopyDisabled: boolean
  isCompactLayout: boolean
  isConfigured: boolean
  isLoadingModels: boolean
  isOpen: boolean
  mode: 'floating' | 'page'
  isResizing: boolean
  isSavingModel: boolean
  isSubmitting: boolean
  messages: ChatMessage[]
  modelName?: string
  modelOptions: {
    label: string
    name: string
  }[]
  onClose: () => void
  onCopyConversation: () => void
  onFetchModels: () => void
  onInputChange: (value: string) => void
  onOpenSystemPromptManager: () => void
  onResetConversation: () => void
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void
  onSelectModel: (modelName: string) => Promise<boolean>
  onSelectSuggestion: (value: string) => void
  onSelectSystemPrompt: (promptId: string) => void
  onSubmit: PromptInputProps['onSubmit']
  platform: OllamaErrorPlatform
  sidebarWidth: number
  title: string
  setupErrorMessage: string
  setupOllamaError?: OllamaErrorDetails
  showCloseButton: boolean
  systemPrompts: AiSystemPromptPreset[]
}

interface SavedTabsChatWidgetProps {
  defaultOpen?: boolean
  initialMessages?: ChatMessage[]
  mode?: 'floating' | 'page'
  onCreateConversation?: () => void
  onMessagesChange?: (messages: ChatMessage[]) => void
  onOpenChange?: (isOpen: boolean) => void
}

interface SystemPromptManagerDialogProps {
  activePromptId: string
  errorMessage: string
  isOpen: boolean
  isSaveDisabled: boolean
  isSaving: boolean
  presets: AiSystemPromptPreset[]
  selectedPromptId: string
  onCancel: () => void
  onChangePromptName: (value: string) => void
  onChangePromptTemplate: (value: string) => void
  onCloseChange: (isOpen: boolean) => void
  onCreatePrompt: () => void
  onDeletePrompt: () => void
  onDuplicatePrompt: () => void
  onSave: () => Promise<void>
  onSelectPrompt: (promptId: string) => void
}

const SUGGESTIONS = [
  '今月追加したタブを教えて',
  '最近よく保存しているジャンルは？',
  '私が好きそうなコンテンツを教えて',
]

const CHAT_SIDEBAR_STORAGE_KEY = 'tabbin-ai-chat-sidebar-width'
const DEFAULT_CHAT_SIDEBAR_WIDTH = 420
const MIN_CHAT_SIDEBAR_WIDTH = 320
const MAX_CHAT_SIDEBAR_WIDTH = 720
const CHAT_SIDEBAR_VIEWPORT_GUTTER = 48
const COPIED_CONVERSATION_ICON_TIMEOUT = 2000
const SYSTEM_PROMPT_SELECTOR_EMPTY_VALUE = '__no-system-prompt__'
const EMPTY_CHAT_MESSAGES: ChatMessage[] = []

const createMessageId = (): string =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`

const createSystemPromptId = (): string =>
  `system-prompt-${Date.now()}-${Math.random().toString(16).slice(2)}`

const getMaxSidebarWidth = (): number => {
  if (typeof window === 'undefined') {
    return MAX_CHAT_SIDEBAR_WIDTH
  }

  return Math.max(
    MIN_CHAT_SIDEBAR_WIDTH,
    Math.min(
      MAX_CHAT_SIDEBAR_WIDTH,
      window.innerWidth - CHAT_SIDEBAR_VIEWPORT_GUTTER,
    ),
  )
}

const clampSidebarWidth = (width: number): number =>
  Math.min(Math.max(width, MIN_CHAT_SIDEBAR_WIDTH), getMaxSidebarWidth())

const loadSidebarWidth = (): number => {
  if (typeof window === 'undefined') {
    return DEFAULT_CHAT_SIDEBAR_WIDTH
  }

  const storedWidth = window.localStorage.getItem(CHAT_SIDEBAR_STORAGE_KEY)
  if (!storedWidth) {
    return clampSidebarWidth(DEFAULT_CHAT_SIDEBAR_WIDTH)
  }

  const savedWidth = Number(storedWidth)

  return Number.isFinite(savedWidth)
    ? clampSidebarWidth(savedWidth)
    : clampSidebarWidth(DEFAULT_CHAT_SIDEBAR_WIDTH)
}

const persistSidebarWidth = (width: number): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      CHAT_SIDEBAR_STORAGE_KEY,
      String(clampSidebarWidth(width)),
    )
  } catch {
    // localStorage が使えない環境では保持をスキップする
  }
}

const createChatMessage = (
  role: ChatMessage['role'],
  content: string,
  metadata?: Pick<
    ChatMessage,
    'attachments' | 'charts' | 'isStreaming' | 'reasoning' | 'toolTraces'
  >,
): ChatMessage => ({
  attachments: metadata?.attachments,
  charts: metadata?.charts,
  id: createMessageId(),
  role,
  content,
  isStreaming: metadata?.isStreaming,
  reasoning: metadata?.reasoning,
  toolTraces: metadata?.toolTraces,
})

const getBaseSettings = (settings: UserSettings | null): UserSettings => ({
  ...defaultSettings,
  ...settings,
})

const getResolvedSettings = (settings: UserSettings | null): UserSettings =>
  normalizeAiSystemPromptSettings(getBaseSettings(settings))

const clampPromptName = (value: string): string =>
  value.trim().slice(0, MAX_AI_SYSTEM_PROMPT_NAME_LENGTH)

const buildPromptNameCandidate = (baseName: string, suffix = ''): string => {
  const normalizedBaseName = clampPromptName(baseName) || '新しいプロンプト'
  if (!suffix) {
    return normalizedBaseName
  }

  const truncatedBaseName = normalizedBaseName
    .slice(0, Math.max(0, MAX_AI_SYSTEM_PROMPT_NAME_LENGTH - suffix.length))
    .trimEnd()

  return `${truncatedBaseName}${suffix}`.trim()
}

const getUniquePromptName = (
  presets: AiSystemPromptPreset[],
  baseName: string,
  initialSuffix = '',
): string => {
  const normalizedBaseName = clampPromptName(baseName) || '新しいプロンプト'
  const existingNames = new Set(presets.map(preset => preset.name.trim()))
  const initialCandidateName = buildPromptNameCandidate(
    normalizedBaseName,
    initialSuffix,
  )

  if (!existingNames.has(initialCandidateName)) {
    return initialCandidateName
  }

  for (let index = 2; index <= MAX_AI_SYSTEM_PROMPT_PRESETS + 1; index += 1) {
    const candidateName = buildPromptNameCandidate(
      normalizedBaseName,
      initialSuffix ? `${initialSuffix} ${index}` : ` ${index}`,
    )
    if (!existingNames.has(candidateName)) {
      return candidateName
    }
  }

  return buildPromptNameCandidate(normalizedBaseName, ` ${Date.now()}`)
}

const getSelectedPrompt = (
  presets: AiSystemPromptPreset[],
  selectedPromptId: string,
): AiSystemPromptPreset | undefined =>
  presets.find(prompt => prompt.id === selectedPromptId)

const getPromptManagerValidationError = (
  presets: AiSystemPromptPreset[],
): string => {
  const trimmedPresets = presets.map(prompt => ({
    name: prompt.name.trim(),
    template: prompt.template.trim(),
  }))

  if (
    trimmedPresets.some(
      prompt => prompt.name.length === 0 || prompt.template.length === 0,
    )
  ) {
    return 'プロンプト名とシステムプロンプト本文を入力してください。'
  }

  if (
    trimmedPresets.some(
      prompt => prompt.name.length > MAX_AI_SYSTEM_PROMPT_NAME_LENGTH,
    )
  ) {
    return `プロンプト名は${MAX_AI_SYSTEM_PROMPT_NAME_LENGTH}文字以内で入力してください。`
  }

  const duplicateNames = new Set<string>()
  const seenNames = new Set<string>()

  for (const prompt of trimmedPresets) {
    if (seenNames.has(prompt.name)) {
      duplicateNames.add(prompt.name)
      continue
    }

    seenNames.add(prompt.name)
  }

  if (duplicateNames.size > 0) {
    return '同じ名前のプロンプトは保存できません。'
  }

  return ''
}

const loadWidgetSettings = async (): Promise<UserSettings | null> => {
  try {
    return await getUserSettings()
  } catch {
    return null
  }
}

const isAiChatConfigured = (settings: UserSettings | null): boolean =>
  Boolean(settings?.ollamaModel)

const getAiChatErrorMessage = (response: AiChatResponse | undefined): string =>
  response?.error || 'AI からの応答を取得できませんでした。'

const getAiChatOllamaError = (
  response: AiChatResponse | undefined,
): OllamaErrorDetails | undefined => response?.ollamaError

const getRuntimePlatform = async (): Promise<OllamaErrorPlatform> => {
  if (!chrome?.runtime?.getPlatformInfo) {
    return 'unknown'
  }

  try {
    const platformInfo = await new Promise<chrome.runtime.PlatformInfo | null>(
      resolve => {
        chrome.runtime.getPlatformInfo(info => {
          resolve(info ?? null)
        })
      },
    )

    return platformInfo?.os === 'mac' || platformInfo?.os === 'win'
      ? platformInfo.os
      : 'unknown'
  } catch {
    return 'unknown'
  }
}

const getAttachmentInputErrorMessage = (error: {
  code: 'accept' | 'max_file_size' | 'max_files'
  message: string
}) => {
  switch (error.code) {
    case 'accept':
      return '対応しているのはテキスト系ファイルと画像ファイルだけです。'
    case 'max_file_size':
      return '添付ファイルは 2MB 以下にしてください。'
    case 'max_files':
      return `添付できるのは ${AI_CHAT_MAX_ATTACHMENTS} ファイルまでです。`
    default:
      return error.message
  }
}

const requestAssistantAnswer = async (
  history: Pick<ChatMessage, 'attachments' | 'content' | 'role'>[],
  prompt: string,
  attachments: AiChatAttachment[] = [],
): Promise<AiChatResponse | undefined> =>
  (await sendRuntimeMessage({
    action: 'runAiChat',
    history,
    prompt,
    ...(attachments.length > 0 ? { attachments } : {}),
  })) as AiChatResponse | undefined

const requestOllamaModels = async (): Promise<
  OllamaModelListResponse | undefined
> =>
  (await sendRuntimeMessage({
    action: 'listOllamaModels',
  })) as OllamaModelListResponse | undefined

const createInitialStreamingReasoning = (prompt: string): string =>
  [
    `- 質問を受け付けました: ${prompt}`,
    '- 保存済みタブを確認しています。',
    '- ツールと reasoning は step 完了ごとに更新されます。',
  ].join('\n')

const getConversationCopyText = (messages: ChatMessage[]): string =>
  messages
    .filter(message => message.content.trim().length > 0)
    .map(message =>
      [
        message.role === 'user' ? 'ユーザー:' : 'AI:',
        message.attachments?.length
          ? `添付: ${message.attachments
              .map(attachment => attachment.filename)
              .join(', ')}`
          : '',
        message.content.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')

const areMessagesEquivalent = (
  left: ChatMessage[],
  right: ChatMessage[],
): boolean => JSON.stringify(left) === JSON.stringify(right)

const getSourceItems = (output: unknown): ChatMessageSource[] => {
  let items: unknown[] = []

  if (Array.isArray(output)) {
    items = output
  } else if (
    output &&
    typeof output === 'object' &&
    Array.isArray((output as { items?: unknown[] }).items)
  ) {
    items = (output as { items: unknown[] }).items
  }

  return items.flatMap(item => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const url = (item as { url?: unknown }).url
    if (typeof url !== 'string' || url.length === 0) {
      return []
    }

    const title = (item as { title?: unknown }).title

    return [
      {
        title:
          typeof title === 'string' && title.trim().length > 0
            ? title.trim()
            : url,
        url,
      },
    ]
  })
}

const getMessageSources = (
  toolTraces: AiChatToolTrace[] = [],
): ChatMessageSource[] => {
  const seenUrls = new Set<string>()

  return toolTraces.flatMap(toolTrace =>
    getSourceItems(toolTrace.output).filter(source => {
      if (seenUrls.has(source.url)) {
        return false
      }

      seenUrls.add(source.url)
      return true
    }),
  )
}

const requestPromptSubmit = (textarea: HTMLTextAreaElement) => {
  const { form } = textarea
  const submitButton = form?.querySelector(
    'button[type="submit"]',
  ) as HTMLButtonElement | null

  if (submitButton?.disabled) {
    return
  }

  form?.requestSubmit()
}

const insertLineBreakAtCursor = ({
  selectionEnd,
  selectionStart,
  value,
}: {
  selectionEnd: number
  selectionStart: number
  value: string
}) => ({
  cursorPosition: selectionStart + 1,
  nextValue: `${value.slice(0, selectionStart)}\n${value.slice(selectionEnd)}`,
})

const AssistantMessageDiagnostics = ({
  isStreaming,
  reasoning,
  toolTraces = [],
}: Pick<ChatMessage, 'isStreaming' | 'reasoning' | 'toolTraces'>) => {
  if (!reasoning && toolTraces.length === 0) {
    return null
  }

  return (
    <div className='wrap-break-word space-y-2 pl-1'>
      {reasoning ? (
        <Reasoning
          className='mb-0 rounded-md border border-border/70 bg-background/70 px-3 py-2'
          isStreaming={isStreaming}
        >
          <ReasoningTrigger
            getThinkingMessage={() =>
              `Reasoning${toolTraces.length > 0 ? ` / ${toolTraces.length} tools` : ''}`
            }
          />
          <ReasoningContent>{reasoning}</ReasoningContent>
        </Reasoning>
      ) : null}

      {toolTraces.length > 0 ? (
        <div className='space-y-2'>
          <p className='pl-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wide'>
            実行したツール
          </p>
          {toolTraces.map(toolTrace => (
            <Tool
              className='mb-0 border-border/70 bg-background/70'
              key={toolTrace.toolCallId}
            >
              <ToolHeader
                state={toolTrace.state}
                title={toolTrace.title}
                toolName={toolTrace.toolName}
                type='dynamic-tool'
              />
              <ToolContent>
                <ToolInput input={toolTrace.input} />
                <ToolOutput
                  errorText={toolTrace.errorText}
                  output={toolTrace.output}
                />
              </ToolContent>
            </Tool>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const ChatPromptIntro = ({
  isCompactLayout,
  onSelectSuggestion,
}: Pick<SavedTabsChatPanelProps, 'isCompactLayout' | 'onSelectSuggestion'>) => {
  const suggestionItems = SUGGESTIONS.map(suggestion => (
    <Suggestion
      className={
        isCompactLayout
          ? 'w-full justify-start whitespace-normal text-left'
          : undefined
      }
      key={suggestion}
      suggestion={suggestion}
      onClick={onSelectSuggestion}
    />
  ))

  return (
    <div className='shrink-0 space-y-3' data-testid='ai-chat-intro'>
      <p className='text-muted-foreground text-sm'>
        保存済みタブを質問できます。
      </p>
      {isCompactLayout ? (
        <div className='grid gap-2'>{suggestionItems}</div>
      ) : (
        <Suggestions>{suggestionItems}</Suggestions>
      )}
    </div>
  )
}

const SystemPromptSelector = ({
  isCompactLayout,
  prompts,
  selectedPromptId,
  onValueChange,
}: {
  isCompactLayout: boolean
  prompts: AiSystemPromptPreset[]
  selectedPromptId: string
  onValueChange: (value: string) => void
}) => {
  const activePrompt =
    getSelectedPrompt(prompts, selectedPromptId) ?? prompts[0] ?? null

  return (
    <PromptInputSelect
      key={selectedPromptId}
      value={activePrompt?.id}
      onValueChange={onValueChange}
    >
      <PromptInputSelectTrigger
        aria-label={activePrompt?.name || 'システムプロンプトを選択'}
        className={cn(
          'h-8 w-[140px] shrink-0 justify-between rounded-md border border-border/70 bg-background px-2 text-xs shadow-none',
          isCompactLayout && 'w-[112px]',
        )}
      >
        <PromptInputSelectValue placeholder='プロンプト' />
      </PromptInputSelectTrigger>
      <PromptInputSelectContent>
        {prompts.length > 0 ? (
          prompts.map(prompt => (
            <PromptInputSelectItem key={prompt.id} value={prompt.id}>
              {prompt.name}
            </PromptInputSelectItem>
          ))
        ) : (
          <PromptInputSelectItem
            disabled
            value={SYSTEM_PROMPT_SELECTOR_EMPTY_VALUE}
          >
            システムプロンプトがありません
          </PromptInputSelectItem>
        )}
      </PromptInputSelectContent>
    </PromptInputSelect>
  )
}

const SystemPromptManagerDialog = ({
  activePromptId,
  errorMessage,
  isOpen,
  isSaveDisabled,
  isSaving,
  presets,
  selectedPromptId,
  onCancel,
  onChangePromptName,
  onChangePromptTemplate,
  onCloseChange,
  onCreatePrompt,
  onDeletePrompt,
  onDuplicatePrompt,
  onSave,
  onSelectPrompt,
}: SystemPromptManagerDialogProps) => {
  const selectedPrompt = getSelectedPrompt(presets, selectedPromptId)
  const isLimitReached = presets.length >= MAX_AI_SYSTEM_PROMPT_PRESETS
  const isDeleteDisabled = presets.length <= 1

  return (
    <Dialog open={isOpen} onOpenChange={onCloseChange}>
      <DialogContent
        aria-describedby={undefined}
        className='flex h-[calc(100vh-48px)] max-h-none w-[calc(100vw-48px)] max-w-none flex-col gap-0 overflow-hidden p-0'
      >
        <DialogHeader className='border-border border-b px-6 py-4 text-left'>
          <DialogTitle>システムプロンプト管理</DialogTitle>
        </DialogHeader>

        <div className='grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] overflow-hidden'>
          <div className='flex min-h-0 flex-col border-border border-r'>
            <div className='border-border border-b px-4 py-4'>
              <div className='mb-3 flex items-center justify-between gap-2'>
                <p className='font-medium text-sm'>システムプロンプト一覧</p>
                <span className='text-muted-foreground text-xs'>
                  {presets.length} / {MAX_AI_SYSTEM_PROMPT_PRESETS}
                </span>
              </div>
              <div className='grid gap-2'>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  disabled={isLimitReached}
                  onClick={onCreatePrompt}
                >
                  <Plus className='size-4' />
                  新規作成
                </Button>
              </div>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto px-3 py-3'>
              <div className='grid gap-2'>
                {presets.map(prompt => (
                  <button
                    type='button'
                    key={prompt.id}
                    className={cn(
                      'cursor-pointer overflow-hidden rounded-md border px-3 py-3 text-left transition-colors',
                      prompt.id === selectedPromptId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border/80 hover:bg-muted/30',
                    )}
                    onClick={() => onSelectPrompt(prompt.id)}
                  >
                    <div className='flex min-w-0 items-center justify-between gap-2'>
                      <p className='min-w-0 flex-1 truncate font-medium text-sm'>
                        {prompt.name}
                      </p>
                      {prompt.id === activePromptId ? (
                        <span className='shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground'>
                          使用中
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className='flex min-h-0 flex-col'>
            <div className='min-h-0 flex-1 overflow-y-auto px-6 py-5'>
              {selectedPrompt ? (
                <div className='space-y-5'>
                  <div className='space-y-2'>
                    <Label htmlFor='system-prompt-name'>プロンプト名</Label>
                    <div
                      className='flex items-start gap-2'
                      data-testid='system-prompt-name-row'
                    >
                      <Input
                        id='system-prompt-name'
                        aria-label='プロンプト名'
                        className='flex-1'
                        maxLength={MAX_AI_SYSTEM_PROMPT_NAME_LENGTH}
                        value={selectedPrompt.name}
                        onChange={event =>
                          onChangePromptName(event.target.value)
                        }
                      />
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={isLimitReached}
                        onClick={onDuplicatePrompt}
                      >
                        <Copy className='size-4' />
                        複製
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        disabled={isDeleteDisabled}
                        onClick={onDeletePrompt}
                      >
                        <Trash2 className='size-4' />
                        削除
                      </Button>
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='system-prompt-template'>
                      システムプロンプト本文
                    </Label>
                    <Textarea
                      id='system-prompt-template'
                      aria-label='システムプロンプト本文'
                      className='min-h-[420px] resize-y'
                      value={selectedPrompt.template}
                      onChange={event =>
                        onChangePromptTemplate(event.target.value)
                      }
                    />
                  </div>

                  <div className='space-y-3'>
                    <div className='space-y-1'>
                      <p className='font-medium text-sm'>利用できるツール</p>
                      <p className='text-muted-foreground text-xs'>
                        システムプロンプトで前提にしやすいように、利用可能な
                        tool の名前と説明を載せています。
                      </p>
                    </div>
                    <div className='grid gap-2 xl:grid-cols-2'>
                      {AI_CHAT_TOOL_DEFINITIONS.map(toolDefinition => (
                        <div
                          className='rounded-md border border-border/70 bg-muted/20 px-3 py-3'
                          key={toolDefinition.name}
                        >
                          <p className='font-mono text-xs'>
                            {toolDefinition.name}
                          </p>
                          <p className='mt-2 text-muted-foreground text-sm'>
                            {toolDefinition.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {errorMessage ? (
                    <p className='whitespace-pre-line text-destructive text-sm'>
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <DialogFooter className='border-border border-t px-6 py-4'>
              <Button
                type='button'
                variant='outline'
                disabled={isSaving}
                onClick={onCancel}
              >
                キャンセル
              </Button>
              <Button
                type='button'
                disabled={isSaveDisabled}
                onClick={() => void onSave()}
              >
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const ChatSidebarHeader = ({
  activeSystemPromptId,
  isConversationCopied,
  isCopyDisabled,
  isCompactLayout,
  onClose,
  onCopyConversation,
  onOpenSystemPromptManager,
  onResetConversation,
  onSelectSystemPrompt,
  systemPrompts,
  title,
  showCloseButton,
}: {
  activeSystemPromptId: string
  isConversationCopied: boolean
  isCopyDisabled: boolean
  isCompactLayout: boolean
  onClose: () => void
  onCopyConversation: () => void
  onOpenSystemPromptManager: () => void
  onResetConversation: () => void
  onSelectSystemPrompt: (promptId: string) => void
  showCloseButton: boolean
  systemPrompts: AiSystemPromptPreset[]
  title: string
}) => (
  <CardHeader className='items-center border-border border-b px-4 py-4 text-center'>
    <div
      className={cn(
        'relative flex w-full items-center justify-center',
        isCompactLayout && 'min-h-10',
      )}
    >
      <div className='absolute top-1/2 left-0 flex max-w-[calc(50%-84px)] -translate-y-1/2 items-center gap-2'>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label='システムプロンプト設定を開く'
                onClick={onOpenSystemPromptManager}
              >
                <Settings2 className='size-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent side='bottom'>
              システムプロンプト設定
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <SystemPromptSelector
          isCompactLayout={isCompactLayout}
          prompts={systemPrompts}
          selectedPromptId={activeSystemPromptId}
          onValueChange={onSelectSystemPrompt}
        />
      </div>

      <CardTitle className='flex w-full items-center justify-center gap-2 text-base'>
        {title}
      </CardTitle>
      <div className='absolute top-1/2 right-0 flex -translate-y-1/2 items-center gap-1'>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label='会話をコピー'
                data-state={isConversationCopied ? 'copied' : 'idle'}
                disabled={isCopyDisabled}
                onClick={onCopyConversation}
              >
                {isConversationCopied ? (
                  <Check className='size-4' />
                ) : (
                  <Copy className='size-4' />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side='bottom'>
              {isConversationCopied ? 'コピーしました' : '会話をコピー'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label='新しい会話'
                onClick={onResetConversation}
              >
                <Plus className='size-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent side='bottom'>新しい会話</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {showCloseButton ? (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label='AIチャットを閉じる'
            onClick={onClose}
          >
            <X className='size-4' />
          </Button>
        ) : null}
      </div>
    </div>
  </CardHeader>
)

const ChatPromptAttachments = () => {
  const attachments = usePromptInputAttachments()

  if (attachments.files.length === 0) {
    return null
  }

  return (
    <Attachments className='w-full px-3 pb-1' variant='inline'>
      {attachments.files.map(file => (
        <Attachment
          data={file}
          key={file.id}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove
            label={`${file.filename ?? '添付ファイル'} を削除`}
          />
        </Attachment>
      ))}
    </Attachments>
  )
}

const ChatPromptAttachmentButton = () => {
  const attachments = usePromptInputAttachments()

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      aria-label='ファイルを添付'
      className='shrink-0'
      onClick={() => attachments.openFileDialog()}
    >
      <Paperclip className='size-4' />
    </Button>
  )
}

const ChatMessageAttachments = ({
  attachments,
}: {
  attachments: AiChatAttachment[]
}) => (
  <Attachments className='mb-2 w-full' variant='inline'>
    {attachments.map((attachment, index) => (
      <Attachment
        data={{
          id: `${attachment.filename}-${attachment.mediaType}-${index}`,
          filename: attachment.filename,
          mediaType: attachment.mediaType,
          type: 'file',
          url: attachment.kind === 'image' ? attachment.content : '',
        }}
        key={`${attachment.filename}-${attachment.mediaType}-${index}`}
      >
        <AttachmentPreview />
        <AttachmentInfo />
      </Attachment>
    ))}
  </Attachments>
)

const ChatConversationMessage = ({
  message,
  platform,
}: {
  message: ChatMessage
  platform: OllamaErrorPlatform
}) => {
  const messageSources =
    message.role === 'assistant' ? getMessageSources(message.toolTraces) : []
  const messageBody = message.ollamaError ? (
    <OllamaErrorNotice
      className='text-sm'
      error={message.ollamaError}
      platform={platform}
    />
  ) : (
    <MessageResponse>{message.content}</MessageResponse>
  )
  const shouldShowStreamingShimmer =
    message.role === 'assistant' &&
    message.isStreaming &&
    message.content.length === 0
  const hasCharts =
    message.role === 'assistant' &&
    Boolean(message.charts && message.charts.length > 0)

  return (
    <Message className={cn(hasCharts && 'max-w-full')} from={message.role}>
      {messageSources.length > 0 ? (
        <Sources
          className='mb-0 rounded-md border border-border/70 bg-background/70 px-3 py-2 text-foreground'
          data-slot='sources'
        >
          <SourcesTrigger
            className='w-full justify-between text-muted-foreground'
            count={messageSources.length}
          >
            <span className='font-medium text-[11px] uppercase tracking-wide'>
              参照ソース {messageSources.length}件
            </span>
            <ChevronDown className='h-4 w-4' />
          </SourcesTrigger>
          <SourcesContent className='w-full'>
            {messageSources.map(source => (
              <Source href={source.url} key={source.url} title={source.title} />
            ))}
          </SourcesContent>
        </Sources>
      ) : null}

      {message.role === 'assistant' ? (
        <AssistantMessageDiagnostics
          isStreaming={message.isStreaming}
          reasoning={message.reasoning}
          toolTraces={message.toolTraces}
        />
      ) : null}

      <MessageContent
        className={cn(
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
          hasCharts && 'w-full overflow-visible',
          'wrap-break-word whitespace-pre-wrap',
        )}
      >
        {message.attachments && message.attachments.length > 0 ? (
          <ChatMessageAttachments attachments={message.attachments} />
        ) : null}
        {messageBody}
        {message.role === 'assistant' ? (
          <AiChartRenderer charts={message.charts} />
        ) : null}
        {shouldShowStreamingShimmer ? (
          <Shimmer className='text-sm'>回答を組み立てています...</Shimmer>
        ) : null}
      </MessageContent>
    </Message>
  )
}

const ChatPromptComposer = ({
  input,
  isCompactLayout,
  isConfigured,
  isLoadingModels,
  isSavingModel,
  isSubmitting,
  modelName,
  modelOptions,
  onFetchModels,
  onInputChange,
  onSelectModel,
  onSubmit,
  platform,
  setupErrorMessage,
  setupOllamaError,
}: Pick<
  SavedTabsChatPanelProps,
  | 'input'
  | 'isCompactLayout'
  | 'isConfigured'
  | 'isLoadingModels'
  | 'isSavingModel'
  | 'isSubmitting'
  | 'modelName'
  | 'modelOptions'
  | 'onFetchModels'
  | 'onInputChange'
  | 'onSelectModel'
  | 'onSubmit'
  | 'platform'
  | 'setupErrorMessage'
  | 'setupOllamaError'
>) => {
  const compactSubmitLabel = isSubmitting ? '送信中...' : '送信'
  const isSubmitDisabled =
    !isConfigured || isSubmitting || isSavingModel || input.trim().length === 0
  const handleTextareaKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      requestPromptSubmit(event.currentTarget)
      return
    }

    event.preventDefault()

    const textarea = event.currentTarget
    const selectionStart = textarea.selectionStart ?? input.length
    const selectionEnd = textarea.selectionEnd ?? selectionStart
    const { cursorPosition, nextValue } = insertLineBreakAtCursor({
      selectionEnd,
      selectionStart,
      value: input,
    })

    onInputChange(nextValue)

    window.requestAnimationFrame(() => {
      textarea.setSelectionRange(cursorPosition, cursorPosition)
    })
  }

  return (
    <PromptInput
      accept={getAiChatAttachmentInputAccept()}
      className='shrink-0'
      maxFiles={AI_CHAT_MAX_ATTACHMENTS}
      maxFileSize={AI_CHAT_MAX_ATTACHMENT_SIZE_BYTES}
      multiple
      onError={error => {
        toast.error(getAttachmentInputErrorMessage(error))
      }}
      onSubmit={onSubmit}
    >
      <PromptInputTextarea
        aria-label='AIに質問する'
        className={cn('min-h-16', isCompactLayout && 'min-h-24 text-sm')}
        value={input}
        onChange={event => onInputChange(event.target.value)}
        onKeyDown={handleTextareaKeyDown}
        disabled={!isConfigured || isSavingModel}
        placeholder={
          isConfigured
            ? '保存済みタブについて質問してください'
            : '左下で Ollama モデルを選択してください'
        }
      />
      <ChatPromptAttachments />
      <PromptInputFooter
        className={cn(
          'items-center justify-between gap-2 border-border border-t',
          isCompactLayout && 'flex-wrap',
        )}
      >
        <div
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2',
            isCompactLayout && 'w-full flex-wrap',
          )}
        >
          <ChatPromptAttachmentButton />
          <OllamaModelSelector
            errorMessage={setupErrorMessage}
            fetchOnOpen
            hideFetchButton
            isCompactLayout={isCompactLayout}
            isLoading={isLoadingModels}
            isSaving={isSavingModel}
            models={modelOptions}
            onFetchModels={onFetchModels}
            onSelectModel={onSelectModel}
            ollamaError={setupOllamaError}
            platform={platform}
            selectedModel={modelName}
          />
        </div>
        <PromptInputSubmit
          className={cn(isCompactLayout && 'w-full')}
          disabled={isSubmitDisabled}
          size={isCompactLayout ? 'sm' : 'icon-sm'}
          {...(isCompactLayout
            ? {
                'aria-label': compactSubmitLabel,
              }
            : {})}
        >
          {isCompactLayout ? compactSubmitLabel : undefined}
        </PromptInputSubmit>
      </PromptInputFooter>
    </PromptInput>
  )
}

const SavedTabsChatPanel = ({
  activeSystemPromptId,
  chatErrorMessage,
  chatOllamaError,
  input,
  isConversationCopied,
  isCopyDisabled,
  isCompactLayout,
  isConfigured,
  isLoadingModels,
  isOpen,
  mode,
  isResizing,
  isSavingModel,
  isSubmitting,
  messages,
  modelName,
  modelOptions,
  onClose,
  onCopyConversation,
  onFetchModels,
  onInputChange,
  onOpenSystemPromptManager,
  onResetConversation,
  onResizeStart,
  onSelectModel,
  onSelectSuggestion,
  onSelectSystemPrompt,
  onSubmit,
  platform,
  sidebarWidth,
  title,
  setupErrorMessage,
  setupOllamaError,
  showCloseButton,
  systemPrompts,
}: SavedTabsChatPanelProps) => {
  if (!isOpen) {
    return null
  }

  let chatErrorContent: ReactNode = null

  if (chatOllamaError) {
    chatErrorContent = (
      <OllamaErrorNotice
        className='shrink-0 text-destructive text-sm'
        error={chatOllamaError}
        platform={platform}
      />
    )
  } else if (chatErrorMessage) {
    chatErrorContent = (
      <p className='wrap-break-word shrink-0 whitespace-pre-line text-destructive text-sm'>
        {chatErrorMessage}
      </p>
    )
  }

  const cardClassName =
    mode === 'page'
      ? 'flex h-full min-h-0 flex-1 flex-col rounded-[1.5rem] border-border shadow-lg'
      : 'flex h-full min-h-0 flex-col rounded-none border-border border-y-0 border-r-0 border-l shadow-2xl'

  const cardStyle = mode === 'page' ? undefined : { width: `${sidebarWidth}px` }

  const card = (
    <Card
      aria-label={mode === 'page' ? 'AIチャット画面' : 'AIチャットサイドバー'}
      data-sidebar-layout={isCompactLayout ? 'compact' : 'default'}
      className={cardClassName}
      style={cardStyle}
    >
      <ChatSidebarHeader
        activeSystemPromptId={activeSystemPromptId}
        isConversationCopied={isConversationCopied}
        isCopyDisabled={isCopyDisabled}
        isCompactLayout={isCompactLayout}
        onClose={onClose}
        onCopyConversation={onCopyConversation}
        onOpenSystemPromptManager={onOpenSystemPromptManager}
        onResetConversation={onResetConversation}
        onSelectSystemPrompt={onSelectSystemPrompt}
        showCloseButton={showCloseButton}
        systemPrompts={systemPrompts}
        title={title}
      />

      <CardContent
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          isCompactLayout ? 'gap-2 p-2' : 'gap-3 p-3',
        )}
      >
        <Conversation className='min-h-0 flex-1'>
          <ConversationContent
            className={cn(isCompactLayout && 'gap-5 p-3')}
            scrollClassName='overscroll-contain'
          >
            {messages.map(message => (
              <ChatConversationMessage
                key={message.id}
                message={message}
                platform={platform}
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton
            aria-label='最新メッセージへ移動'
            className='bottom-3'
          />
        </Conversation>

        <div
          className='mt-auto shrink-0 space-y-3'
          data-testid='ai-chat-bottom-dock'
        >
          {messages.length === 0 ? (
            <ChatPromptIntro
              isCompactLayout={isCompactLayout}
              onSelectSuggestion={onSelectSuggestion}
            />
          ) : null}

          {chatErrorContent}

          <ChatPromptComposer
            input={input}
            isCompactLayout={isCompactLayout}
            isConfigured={isConfigured}
            isLoadingModels={isLoadingModels}
            isSavingModel={isSavingModel}
            isSubmitting={isSubmitting}
            modelName={modelName}
            modelOptions={modelOptions}
            onFetchModels={onFetchModels}
            onInputChange={onInputChange}
            onSelectModel={onSelectModel}
            onSubmit={onSubmit}
            platform={platform}
            setupErrorMessage={setupErrorMessage}
            setupOllamaError={setupOllamaError}
          />
        </div>
      </CardContent>
    </Card>
  )

  if (mode === 'page') {
    return <div className='flex h-full min-h-0 flex-1'>{card}</div>
  }

  return (
    <div className='sticky top-0 z-50 flex h-screen max-w-[calc(100vw-24px)] shrink-0 self-start overflow-hidden overscroll-none'>
      <button
        type='button'
        aria-label='AIチャットの幅を調整'
        className={`relative w-4 shrink-0 cursor-col-resize touch-none ${
          isResizing ? 'bg-primary/10' : 'bg-transparent'
        }`}
        onPointerDown={onResizeStart}
      >
        <div className='absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/80' />
      </button>

      {card}
    </div>
  )
}

const SavedTabsChatWidget = ({
  defaultOpen = false,
  initialMessages = EMPTY_CHAT_MESSAGES,
  mode = 'floating',
  onCreateConversation,
  onMessagesChange,
  onOpenChange,
}: SavedTabsChatWidgetProps = {}) => {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [isOpen, setIsOpen] = useState(defaultOpen || mode === 'page')
  const [isResizing, setIsResizing] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [isConversationCopied, setIsConversationCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [chatOllamaError, setChatOllamaError] = useState<
    OllamaErrorDetails | undefined
  >(undefined)
  const [modelOptions, setModelOptions] = useState<
    {
      label: string
      name: string
    }[]
  >([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isSavingModel, setIsSavingModel] = useState(false)
  const [setupErrorMessage, setSetupErrorMessage] = useState('')
  const [setupOllamaError, setSetupOllamaError] = useState<
    OllamaErrorDetails | undefined
  >(undefined)
  const [platform, setPlatform] = useState<OllamaErrorPlatform>('unknown')
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_CHAT_SIDEBAR_WIDTH)
  const [isPromptManagerOpen, setIsPromptManagerOpen] = useState(false)
  const [promptDrafts, setPromptDrafts] = useState<AiSystemPromptPreset[]>([])
  const [selectedPromptIdInModal, setSelectedPromptIdInModal] = useState('')
  const [draftActivePromptId, setDraftActivePromptId] = useState('')
  const [promptManagerError, setPromptManagerError] = useState('')
  const [isSavingPrompts, setIsSavingPrompts] = useState(false)
  const activePortRef = useRef<{
    disconnect: () => void
  } | null>(null)
  const conversationGenerationRef = useRef(0)
  const ignoreNextDisconnectRef = useRef(false)
  const resizeCleanupRef = useRef<(() => void) | null>(null)
  const sidebarWidthRef = useRef(DEFAULT_CHAT_SIDEBAR_WIDTH)
  const conversationCopiedTimeoutRef = useRef<number | null>(null)
  const messagesRef = useRef<ChatMessage[]>(initialMessages)

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (mode !== 'page') {
      return
    }

    if (areMessagesEquivalent(initialMessages, messagesRef.current)) {
      return
    }

    setMessages(initialMessages)
  }, [initialMessages, mode])

  useEffect(() => {
    if (mode === 'page') {
      setIsOpen(true)
    }
  }, [mode])

  useEffect(() => {
    onMessagesChange?.(messages)
  }, [messages, onMessagesChange])

  useEffect(() => {
    let isMounted = true

    void getRuntimePlatform().then(nextPlatform => {
      if (isMounted) {
        setPlatform(nextPlatform)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    loadWidgetSettings().then(nextSettings => {
      if (isMounted) {
        setSettings(nextSettings)
        setSidebarWidth(loadSidebarWidth())
      }
    })

    return () => {
      isMounted = false
      resizeCleanupRef.current?.()
      resizeCleanupRef.current = null
      if (conversationCopiedTimeoutRef.current) {
        window.clearTimeout(conversationCopiedTimeoutRef.current)
        conversationCopiedTimeoutRef.current = null
      }
      activePortRef.current?.disconnect()
      activePortRef.current = null
    }
  }, [])

  useEffect(() => {
    const storageChangeListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local' || !changes.userSettings) {
        return
      }

      setSettings(
        (changes.userSettings.newValue as UserSettings) ?? defaultSettings,
      )
    }

    const storageOnChanged = getChromeStorageOnChanged()
    if (!storageOnChanged) {
      warnMissingChromeStorage('AIチャット設定変更監視')
      return
    }

    storageOnChanged.addListener(storageChangeListener)

    return () => {
      storageOnChanged.removeListener(storageChangeListener)
    }
  }, [])

  useEffect(() => {
    const handleWindowResize = () => {
      setSidebarWidth(currentWidth => clampSidebarWidth(currentWidth))
    }

    window.addEventListener('resize', handleWindowResize)

    return () => {
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [])

  const resolvedSettings = getResolvedSettings(settings)
  const activeSystemPrompt = getActiveAiSystemPrompt(resolvedSettings)
  const isConfigured = isAiChatConfigured(resolvedSettings)
  const isCompactLayout = sidebarWidth <= 360

  const appendMessage = (
    role: ChatMessage['role'],
    content: string,
    metadata?: Pick<
      ChatMessage,
      'attachments' | 'charts' | 'isStreaming' | 'reasoning' | 'toolTraces'
    >,
  ) => {
    setMessages(currentMessages => [
      ...currentMessages,
      createChatMessage(role, content, metadata),
    ])
  }

  const replaceMessage = (
    messageId: string,
    nextMessage: Partial<ChatMessage>,
  ) => {
    setMessages(currentMessages =>
      currentMessages.map(message =>
        message.id === messageId
          ? {
              ...message,
              ...nextMessage,
            }
          : message,
      ),
    )
  }

  const removeMessage = (messageId: string) => {
    setMessages(currentMessages =>
      currentMessages.filter(message => message.id !== messageId),
    )
  }

  const disconnectActivePort = (suppressDisconnectError = false) => {
    const activePort = activePortRef.current
    if (!activePort) {
      return
    }

    if (suppressDisconnectError) {
      ignoreNextDisconnectRef.current = true
    }

    activePortRef.current = null
    activePort.disconnect()
  }

  const stopResize = () => {
    resizeCleanupRef.current?.()
    resizeCleanupRef.current = null
  }

  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    stopResize()
    setIsResizing(true)

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = clampSidebarWidth(window.innerWidth - moveEvent.clientX)
      sidebarWidthRef.current = nextWidth
      setSidebarWidth(nextWidth)
    }
    const handlePointerUp = () => {
      persistSidebarWidth(sidebarWidthRef.current)
      setIsResizing(false)
      stopResize()
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    resizeCleanupRef.current = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }

  const handleFetchModels = async () => {
    setIsLoadingModels(true)
    setSetupErrorMessage('')
    setSetupOllamaError(undefined)

    const response = await requestOllamaModels()

    if (response?.status !== 'ok' || !response.models) {
      setModelOptions([])
      setSetupErrorMessage(
        response?.error || 'モデル一覧を取得できませんでした',
      )
      setSetupOllamaError(response?.ollamaError)
      setIsLoadingModels(false)
      return
    }

    setModelOptions(
      response.models.map(model => ({
        name: model.name,
        label: model.label,
      })),
    )
    setSetupOllamaError(undefined)
    setIsLoadingModels(false)
  }

  const handleSelectModel = async (modelName: string): Promise<boolean> => {
    const nextSettings = normalizeAiSystemPromptSettings({
      ...resolvedSettings,
      aiProvider: 'ollama' as const,
      ollamaModel: modelName,
    })

    setIsSavingModel(true)
    setSetupErrorMessage('')
    setSetupOllamaError(undefined)

    try {
      await saveUserSettings(nextSettings)
      setSettings(nextSettings)
      return true
    } catch {
      setSetupErrorMessage('モデル設定を保存できませんでした')
      return false
    } finally {
      setIsSavingModel(false)
    }
  }

  const handleResetConversation = () => {
    if (conversationCopiedTimeoutRef.current) {
      window.clearTimeout(conversationCopiedTimeoutRef.current)
      conversationCopiedTimeoutRef.current = null
    }
    conversationGenerationRef.current += 1
    disconnectActivePort(true)
    setMessages([])
    setIsConversationCopied(false)
    setInput('')
    setErrorMessage('')
    setChatOllamaError(undefined)
    setIsSubmitting(false)
  }

  const handleConversationAction = () => {
    if (mode === 'page' && onCreateConversation) {
      onCreateConversation()
      return
    }

    handleResetConversation()
  }

  const handleCopyConversation = async () => {
    const conversationCopyText = getConversationCopyText(messages)
    if (!conversationCopyText) {
      return
    }

    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      toast.error('会話をコピーできませんでした')
      return
    }

    try {
      await navigator.clipboard.writeText(conversationCopyText)
      if (conversationCopiedTimeoutRef.current) {
        window.clearTimeout(conversationCopiedTimeoutRef.current)
      }
      setIsConversationCopied(true)
      toast.success('会話をコピーしました')
      conversationCopiedTimeoutRef.current = window.setTimeout(() => {
        setIsConversationCopied(false)
        conversationCopiedTimeoutRef.current = null
      }, COPIED_CONVERSATION_ICON_TIMEOUT)
    } catch {
      toast.error('会話をコピーできませんでした')
    }
  }

  const handleOpenSystemPromptManager = () => {
    setPromptDrafts(resolvedSettings.aiSystemPrompts ?? [])
    setSelectedPromptIdInModal(activeSystemPrompt.id)
    setDraftActivePromptId(resolvedSettings.activeAiSystemPromptId ?? '')
    setPromptManagerError('')
    setIsPromptManagerOpen(true)
  }

  const handleCancelSystemPromptManager = () => {
    setIsPromptManagerOpen(false)
    setPromptManagerError('')
    setPromptDrafts([])
    setSelectedPromptIdInModal('')
    setDraftActivePromptId('')
  }

  const handlePromptManagerOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      handleOpenSystemPromptManager()
      return
    }

    handleCancelSystemPromptManager()
  }

  const updateSelectedPromptDraft = (
    update: (prompt: AiSystemPromptPreset) => AiSystemPromptPreset,
  ) => {
    setPromptManagerError('')
    setPromptDrafts(currentPrompts =>
      currentPrompts.map(prompt =>
        prompt.id === selectedPromptIdInModal ? update(prompt) : prompt,
      ),
    )
  }

  const handleChangePromptName = (value: string) => {
    updateSelectedPromptDraft(prompt => ({
      ...prompt,
      name: value,
      updatedAt: Date.now(),
    }))
  }

  const handleChangePromptTemplate = (value: string) => {
    updateSelectedPromptDraft(prompt => ({
      ...prompt,
      template: value,
      updatedAt: Date.now(),
    }))
  }

  const handleCreatePrompt = () => {
    setPromptManagerError('')
    setPromptDrafts(currentPrompts => {
      if (currentPrompts.length >= MAX_AI_SYSTEM_PROMPT_PRESETS) {
        return currentPrompts
      }

      const nextPrompt = createAiSystemPromptPreset({
        id: createSystemPromptId(),
        name: getUniquePromptName(currentPrompts, '新しいプロンプト'),
      })

      setSelectedPromptIdInModal(nextPrompt.id)

      return [...currentPrompts, nextPrompt]
    })
  }

  const handleDuplicatePrompt = () => {
    setPromptManagerError('')
    setPromptDrafts(currentPrompts => {
      const selectedPrompt = getSelectedPrompt(
        currentPrompts,
        selectedPromptIdInModal,
      )
      if (
        !selectedPrompt ||
        currentPrompts.length >= MAX_AI_SYSTEM_PROMPT_PRESETS
      ) {
        return currentPrompts
      }

      const nextPrompt = createAiSystemPromptPreset({
        id: createSystemPromptId(),
        name: getUniquePromptName(
          currentPrompts,
          selectedPrompt.name,
          'のコピー',
        ),
        template: selectedPrompt.template,
      })

      setSelectedPromptIdInModal(nextPrompt.id)

      return [...currentPrompts, nextPrompt]
    })
  }

  const handleDeletePrompt = () => {
    setPromptManagerError('')
    setPromptDrafts(currentPrompts => {
      if (currentPrompts.length <= 1) {
        return currentPrompts
      }

      const selectedIndex = currentPrompts.findIndex(
        prompt => prompt.id === selectedPromptIdInModal,
      )
      if (selectedIndex === -1) {
        return currentPrompts
      }

      const nextPrompts = currentPrompts.filter(
        prompt => prompt.id !== selectedPromptIdInModal,
      )
      const fallbackPrompt =
        nextPrompts[selectedIndex] ??
        nextPrompts[selectedIndex - 1] ??
        nextPrompts[0]

      setSelectedPromptIdInModal(fallbackPrompt?.id ?? '')

      if (draftActivePromptId === selectedPromptIdInModal) {
        setDraftActivePromptId(fallbackPrompt?.id ?? '')
      }

      return nextPrompts
    })
  }

  const handleSavePromptManager = async () => {
    const validationError = getPromptManagerValidationError(promptDrafts)
    if (validationError) {
      return
    }

    const normalizedPrompts = promptDrafts.map(prompt => ({
      ...prompt,
      name: prompt.name.trim(),
      template: prompt.template.trim(),
    }))

    const nextSettings = normalizeAiSystemPromptSettings({
      ...resolvedSettings,
      activeAiSystemPromptId:
        draftActivePromptId || normalizedPrompts[0]?.id || '',
      aiSystemPrompts: normalizedPrompts,
    })

    setIsSavingPrompts(true)
    setPromptManagerError('')

    try {
      await saveUserSettings(nextSettings)

      const nextActivePrompt = getActiveAiSystemPrompt(nextSettings)
      const shouldResetConversation =
        nextActivePrompt.id !== activeSystemPrompt.id ||
        nextActivePrompt.template !== activeSystemPrompt.template

      setSettings(nextSettings)
      handleCancelSystemPromptManager()

      if (shouldResetConversation) {
        handleResetConversation()
      }
    } catch {
      setPromptManagerError('システムプロンプトを保存できませんでした')
    } finally {
      setIsSavingPrompts(false)
    }
  }

  const handleSelectSystemPrompt = async (promptId: string) => {
    if (!promptId || promptId === resolvedSettings.activeAiSystemPromptId) {
      return
    }

    const nextSettings = normalizeAiSystemPromptSettings({
      ...resolvedSettings,
      activeAiSystemPromptId: promptId,
    })

    try {
      await saveUserSettings(nextSettings)
      setSettings(nextSettings)
      handleResetConversation()
    } catch {
      setChatOllamaError(undefined)
      setErrorMessage('システムプロンプトの切り替えを保存できませんでした')
    }
  }

  const promptManagerValidationError =
    getPromptManagerValidationError(promptDrafts)
  const promptManagerDisplayError =
    promptManagerValidationError || promptManagerError
  const isPromptManagerSaveDisabled =
    isSavingPrompts ||
    promptDrafts.length === 0 ||
    promptManagerValidationError.length > 0

  const isCurrentRequest = (requestGeneration: number) =>
    conversationGenerationRef.current === requestGeneration

  const setAssistantErrorState = (
    assistantMessageId: string,
    nextError: string,
    ollamaError?: OllamaErrorDetails,
  ) => {
    setErrorMessage(nextError)
    setChatOllamaError(ollamaError)

    if (ollamaError?.kind === 'forbidden') {
      removeMessage(assistantMessageId)
    } else {
      replaceMessage(assistantMessageId, {
        content: nextError,
        isStreaming: false,
        ollamaError,
      })
    }

    setIsSubmitting(false)
  }

  const disconnectStreamPort = (streamPort: { disconnect: () => void }) => {
    if (activePortRef.current === streamPort) {
      activePortRef.current = null
    }

    streamPort.disconnect()
  }

  const handleStreamStep = (
    assistantMessageId: string,
    streamMessage: Extract<AiChatStreamServerMessage, { type: 'step' }>,
  ) => {
    replaceMessage(assistantMessageId, {
      isStreaming: true,
      reasoning: streamMessage.reasoning,
      toolTraces: streamMessage.toolTraces,
    })
  }

  const handleStreamCompletion = (
    assistantMessageId: string,
    streamPort: { disconnect: () => void },
    streamMessage: Extract<AiChatStreamServerMessage, { type: 'complete' }>,
  ) => {
    replaceMessage(assistantMessageId, {
      charts: streamMessage.charts,
      content: streamMessage.answer,
      isStreaming: false,
      ollamaError: undefined,
      reasoning: streamMessage.reasoning,
      toolTraces: streamMessage.toolTraces,
    })
    setChatOllamaError(undefined)
    setIsSubmitting(false)
    disconnectStreamPort(streamPort)
  }

  const handleStreamFailure = (
    assistantMessageId: string,
    streamPort: { disconnect: () => void },
    streamMessage: Extract<AiChatStreamServerMessage, { type: 'error' }>,
  ) => {
    setAssistantErrorState(
      assistantMessageId,
      streamMessage.error,
      streamMessage.ollamaError,
    )
    disconnectStreamPort(streamPort)
  }

  const handleIncomingStreamMessage = ({
    assistantMessageId,
    message,
    requestGeneration,
    streamPort,
  }: {
    assistantMessageId: string
    message: unknown
    requestGeneration: number
    streamPort: { disconnect: () => void }
  }): boolean => {
    if (!isCurrentRequest(requestGeneration)) {
      return false
    }

    const streamMessage = message as AiChatStreamServerMessage

    if (streamMessage.type === 'step') {
      handleStreamStep(assistantMessageId, streamMessage)
      return false
    }

    if (streamMessage.type === 'complete') {
      handleStreamCompletion(assistantMessageId, streamPort, streamMessage)
      return true
    }

    if (streamMessage.type === 'error') {
      handleStreamFailure(assistantMessageId, streamPort, streamMessage)
      return true
    }

    return false
  }

  const handleStreamDisconnect = (
    assistantMessageId: string,
    requestGeneration: number,
    streamPort: { disconnect: () => void },
    isFinished: boolean,
  ) => {
    if (activePortRef.current === streamPort) {
      activePortRef.current = null
    }

    if (ignoreNextDisconnectRef.current) {
      ignoreNextDisconnectRef.current = false
      return
    }

    if (!isCurrentRequest(requestGeneration) || isFinished) {
      return
    }

    setAssistantErrorState(
      assistantMessageId,
      'AI からの応答を取得できませんでした。',
    )
  }

  const submitPrompt = async (
    rawPrompt: string,
    attachments: AiChatAttachment[] = [],
  ) => {
    const nextPrompt = rawPrompt.trim()
    if (!nextPrompt || !isConfigured || isSubmitting) {
      return
    }

    const history = messages.map(message => ({
      ...(message.role === 'user' && message.attachments?.length
        ? { attachments: message.attachments }
        : {}),
      role: message.role,
      content: message.content,
    }))

    appendMessage('user', nextPrompt, {
      attachments,
    })
    const assistantMessageId = createMessageId()
    const requestGeneration = conversationGenerationRef.current
    setMessages(currentMessages => [
      ...currentMessages,
      {
        charts: [],
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        reasoning: createInitialStreamingReasoning(nextPrompt),
        toolTraces: [],
      },
    ])
    setInput('')
    setErrorMessage('')
    setChatOllamaError(undefined)
    setIsSubmitting(true)

    disconnectActivePort()

    try {
      const streamPort = await connectRuntimePort(AI_CHAT_STREAM_PORT_NAME)

      if (streamPort) {
        activePortRef.current = streamPort
        let isFinished = false

        streamPort.onMessage.addListener((message: unknown) => {
          isFinished =
            handleIncomingStreamMessage({
              assistantMessageId,
              message,
              requestGeneration,
              streamPort,
            }) || isFinished
        })

        streamPort.onDisconnect.addListener(() => {
          handleStreamDisconnect(
            assistantMessageId,
            requestGeneration,
            streamPort,
            isFinished,
          )
        })

        streamPort.postMessage({
          type: 'run',
          prompt: nextPrompt,
          history,
          ...(attachments.length > 0 ? { attachments } : {}),
        })
        return
      }
    } catch {
      // Port 経由の接続に失敗した場合は単発メッセージへフォールバックする
    }

    const response = await requestAssistantAnswer(
      history,
      nextPrompt,
      attachments,
    )
    if (!isCurrentRequest(requestGeneration)) {
      return
    }

    if (response?.status === 'ok' && response.answer) {
      replaceMessage(assistantMessageId, {
        charts: response.charts,
        content: response.answer,
        isStreaming: false,
        ollamaError: undefined,
        reasoning: response.reasoning,
        toolTraces: response.toolTraces,
      })
      setChatOllamaError(undefined)
      setIsSubmitting(false)
      return
    }

    const nextError = getAiChatErrorMessage(response)
    setAssistantErrorState(
      assistantMessageId,
      nextError,
      getAiChatOllamaError(response),
    )
  }

  const handleSubmit: PromptInputProps['onSubmit'] = async ({
    files,
    text,
  }: PromptInputMessage) => {
    try {
      const attachments =
        await convertPromptInputFilesToAiChatAttachments(files)
      await submitPrompt(text, attachments)
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '添付ファイルを読み取れませんでした。'
      toast.error(errorMessage)
      throw error
    }
  }

  return (
    <>
      {mode === 'floating' && !isOpen ? (
        <Button
          type='button'
          aria-label='AIチャットを開く'
          className='fixed right-4 bottom-4 z-50 size-10 cursor-pointer rounded-full shadow-lg'
          onClick={() => {
            setIsOpen(true)
            onOpenChange?.(true)
          }}
        >
          <MessageCircleMore className='size-5' />
        </Button>
      ) : null}

      <SavedTabsChatPanel
        activeSystemPromptId={resolvedSettings.activeAiSystemPromptId ?? ''}
        chatErrorMessage={errorMessage}
        chatOllamaError={chatOllamaError}
        input={input}
        isConversationCopied={isConversationCopied}
        isCopyDisabled={messages.every(
          message => message.content.trim().length === 0,
        )}
        isCompactLayout={isCompactLayout}
        isConfigured={isConfigured}
        isLoadingModels={isLoadingModels}
        isOpen={isOpen}
        mode={mode}
        isResizing={isResizing}
        isSavingModel={isSavingModel}
        isSubmitting={isSubmitting}
        messages={messages}
        modelName={resolvedSettings.ollamaModel}
        modelOptions={modelOptions}
        onClose={() => {
          setIsOpen(false)
          onOpenChange?.(false)
        }}
        onCopyConversation={() => {
          void handleCopyConversation()
        }}
        onFetchModels={handleFetchModels}
        onInputChange={setInput}
        onOpenSystemPromptManager={handleOpenSystemPromptManager}
        onResetConversation={handleConversationAction}
        onResizeStart={handleResizeStart}
        onSelectModel={handleSelectModel}
        onSelectSuggestion={value => {
          void submitPrompt(value)
        }}
        onSelectSystemPrompt={promptId => {
          void handleSelectSystemPrompt(promptId)
        }}
        onSubmit={handleSubmit}
        platform={platform}
        sidebarWidth={sidebarWidth}
        title={mode === 'page' ? 'AIチャット' : '(preview)Chat'}
        setupErrorMessage={setupErrorMessage}
        setupOllamaError={setupOllamaError}
        showCloseButton={mode === 'floating'}
        systemPrompts={resolvedSettings.aiSystemPrompts ?? []}
      />

      <SystemPromptManagerDialog
        activePromptId={draftActivePromptId}
        errorMessage={promptManagerDisplayError}
        isOpen={isPromptManagerOpen}
        isSaveDisabled={isPromptManagerSaveDisabled}
        isSaving={isSavingPrompts}
        presets={promptDrafts}
        selectedPromptId={selectedPromptIdInModal}
        onCancel={handleCancelSystemPromptManager}
        onChangePromptName={handleChangePromptName}
        onChangePromptTemplate={handleChangePromptTemplate}
        onCloseChange={handlePromptManagerOpenChange}
        onCreatePrompt={handleCreatePrompt}
        onDeletePrompt={handleDeletePrompt}
        onDuplicatePrompt={handleDuplicatePrompt}
        onSave={handleSavePromptManager}
        onSelectPrompt={promptId => {
          setPromptManagerError('')
          setSelectedPromptIdInModal(promptId)
        }}
      />
    </>
  )
}

export { SavedTabsChatWidget }
