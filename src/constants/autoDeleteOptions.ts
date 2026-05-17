/**
 * 自動削除期間の選択肢
 */
export const autoDeleteOptions = [
  { value: 'never', labelKey: 'options.autoDelete.zero' },
  { value: '1hour', labelKey: 'options.autoDelete.1hour' },
  { value: '1day', labelKey: 'options.autoDelete.1day' },
  { value: '7days', labelKey: 'options.autoDelete.7days' },
  { value: '14days', labelKey: 'options.autoDelete.14days' },
  { value: '30days', labelKey: 'options.autoDelete.30days' },
  { value: '180days', labelKey: 'options.autoDelete.180days' },
  { value: '365days', labelKey: 'options.autoDelete.365days' },
] as const
