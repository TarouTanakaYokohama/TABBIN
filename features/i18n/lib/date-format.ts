import type { AppLanguage } from '@/features/i18n/messages'

const parseDateInput = (input: string | number | Date): Date => {
  if (input instanceof Date) {
    return input
  }

  if (typeof input === 'number') {
    return new Date(input)
  }

  const normalized = input.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized)
  if (match) {
    const [, year, month, day] = match
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  return new Date(normalized)
}

export const formatLocalizedDate = (
  language: AppLanguage,
  input: string | number | Date,
): string => {
  const date = parseDateInput(input)
  const locale = language === 'ja' ? 'ja-JP' : 'en-US'

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
