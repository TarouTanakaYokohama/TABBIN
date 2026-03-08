import type { AiSystemPromptPreset, UserSettings } from '@/types/storage'

const DEFAULT_AI_SYSTEM_PROMPT_PRESET_ID = 'default-system-prompt'
const DEFAULT_AI_SYSTEM_PROMPT_PRESET_NAME = 'デフォルト'
const MAX_AI_SYSTEM_PROMPT_PRESETS = 50
const MAX_AI_SYSTEM_PROMPT_NAME_LENGTH = 25
const SAVED_URL_CONTEXT_PLACEHOLDER = '{{saved_url_context}}'

const DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE = [
  'あなたは TABBIN に保存されたタブの情報だけを根拠に答えるアシスタントです。',
  '保存データにない事実は推測しないでください。',
  '推測が含まれる場合は「保存傾向から見ると」と明示してください。',
  '月や期間に関する質問では、できるだけ具体的な年月を答えてください。',
  '現在どんなタブが保存されているかを聞かれたら、まず listSavedUrls を使って確認してください。',
  '保存済みタブが存在しないとは、tools の結果または保存済みタブ要約が空の場合にだけ答えてください。',
  '返答は日本語で簡潔にしてください。',
].join('\n')

const createDefaultAiSystemPromptPreset = (): AiSystemPromptPreset => ({
  createdAt: 0,
  id: DEFAULT_AI_SYSTEM_PROMPT_PRESET_ID,
  name: DEFAULT_AI_SYSTEM_PROMPT_PRESET_NAME,
  template: DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
  updatedAt: 0,
})

type NonEmptyAiSystemPromptPresets = [
  AiSystemPromptPreset,
  ...AiSystemPromptPreset[],
]

type NormalizedAiSystemPromptSettings = Omit<
  UserSettings,
  'activeAiSystemPromptId' | 'aiSystemPrompts'
> & {
  activeAiSystemPrompt: AiSystemPromptPreset
  activeAiSystemPromptId: string
  aiSystemPrompts: NonEmptyAiSystemPromptPresets
}

const isValidPromptPreset = (value: unknown): value is AiSystemPromptPreset => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const preset = value as Record<string, unknown>

  return (
    typeof preset.id === 'string' &&
    preset.id.length > 0 &&
    typeof preset.name === 'string' &&
    preset.name.trim().length > 0 &&
    typeof preset.template === 'string' &&
    typeof preset.createdAt === 'number' &&
    typeof preset.updatedAt === 'number'
  )
}

const normalizePromptName = (name: string): string =>
  name.trim().slice(0, MAX_AI_SYSTEM_PROMPT_NAME_LENGTH)

const normalizePromptPreset = (
  preset: AiSystemPromptPreset,
): AiSystemPromptPreset => ({
  ...preset,
  name: normalizePromptName(preset.name),
  template: preset.template.trim(),
})

const normalizePromptPresets = (
  presets: UserSettings['aiSystemPrompts'],
): NonEmptyAiSystemPromptPresets => {
  const normalizedPresets = Array.isArray(presets)
    ? presets
        .filter(isValidPromptPreset)
        .map(normalizePromptPreset)
        .filter(preset => preset.name.length > 0 && preset.template.length > 0)
        .slice(0, MAX_AI_SYSTEM_PROMPT_PRESETS)
    : []

  return normalizedPresets.length > 0
    ? (normalizedPresets as NonEmptyAiSystemPromptPresets)
    : [createDefaultAiSystemPromptPreset()]
}

const normalizeAiSystemPromptSettings = (
  settings: UserSettings,
): NormalizedAiSystemPromptSettings => {
  const aiSystemPrompts = normalizePromptPresets(settings.aiSystemPrompts)
  const activeAiSystemPrompt =
    aiSystemPrompts.find(
      prompt => prompt.id === settings.activeAiSystemPromptId,
    ) ?? aiSystemPrompts[0]

  return {
    ...settings,
    activeAiSystemPrompt,
    activeAiSystemPromptId: activeAiSystemPrompt.id,
    aiSystemPrompts,
  }
}

const getActiveAiSystemPrompt = (
  settings: Pick<UserSettings, 'activeAiSystemPromptId' | 'aiSystemPrompts'>,
): AiSystemPromptPreset => {
  const normalizedSettings = normalizeAiSystemPromptSettings(
    settings as UserSettings,
  )
  return normalizedSettings.activeAiSystemPrompt
}

const buildFinalSystemPrompt = ({
  savedUrlContext,
  template,
}: {
  savedUrlContext: string
  template: string
}): string => {
  const normalizedTemplate = template.trim()
  if (normalizedTemplate.includes(SAVED_URL_CONTEXT_PLACEHOLDER)) {
    return normalizedTemplate.replace(
      SAVED_URL_CONTEXT_PLACEHOLDER,
      savedUrlContext,
    )
  }

  return [normalizedTemplate, savedUrlContext].join('\n\n')
}

const createAiSystemPromptPreset = ({
  id,
  name,
  now = Date.now(),
  template = DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
}: {
  id: string
  name: string
  now?: number
  template?: string
}): AiSystemPromptPreset => ({
  createdAt: now,
  id,
  name: normalizePromptName(name),
  template,
  updatedAt: now,
})

export {
  DEFAULT_AI_SYSTEM_PROMPT_PRESET_ID,
  DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE,
  MAX_AI_SYSTEM_PROMPT_NAME_LENGTH,
  MAX_AI_SYSTEM_PROMPT_PRESETS,
  SAVED_URL_CONTEXT_PLACEHOLDER,
  buildFinalSystemPrompt,
  createAiSystemPromptPreset,
  getActiveAiSystemPrompt,
  normalizeAiSystemPromptSettings,
}
