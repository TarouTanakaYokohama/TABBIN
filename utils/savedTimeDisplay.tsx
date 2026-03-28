import { useEffect, useState } from 'react'
import { formatFixedDatetime } from './localDateTime'

interface TimeRemainingResponse {
  error?: string
  timeRemaining?: number
}

const getTimeRemainingColorClass = (remainingMs: number): string => {
  if (remainingMs < 1000 * 60 * 60) {
    return 'text-red-500 font-medium'
  }
  if (remainingMs < 1000 * 60 * 60 * 24) {
    return 'text-amber-500 font-medium'
  }
  if (remainingMs < 1000 * 60 * 60 * 24 * 3) {
    return 'text-yellow-500'
  }
  return 'text-emerald-500'
}

const formatTimeRemainingText = (remainingMs: number): string => {
  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor(
    (remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  )
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
  let result = 'あと '
  if (days > 0) {
    result += `${days}日 `
  }
  if (hours > 0 || days > 0) {
    result += `${hours}時間 `
  }
  result += `${minutes}分`
  return result
}

const applyTimeRemainingResponse = (
  response: TimeRemainingResponse,
  setTimeLeft: (value: string) => void,
  setColorClass: (value: string) => void,
): void => {
  if (response.error) {
    console.error('残り時間計算エラー:', response.error)
    setTimeLeft('')
    return
  }
  if (!response.timeRemaining) {
    setTimeLeft('')
    return
  }
  const remainingMs = response.timeRemaining
  if (remainingMs <= 0) {
    setColorClass('text-red-500')
    setTimeLeft('間もなく削除')
    return
  }
  setColorClass(getTimeRemainingColorClass(remainingMs))
  setTimeLeft(formatTimeRemainingText(remainingMs))
}

export const formatDatetime = (timestamp?: number): string =>
  formatFixedDatetime(timestamp)

export const TimeRemaining = ({
  savedAt,
  autoDeletePeriod,
}: {
  savedAt?: number
  autoDeletePeriod?: string
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [colorClass, setColorClass] = useState<string>('')

  useEffect(() => {
    if (!autoDeletePeriod || autoDeletePeriod === 'never' || !savedAt) {
      setTimeLeft('')
      return
    }

    const calculateTimeLeft = () => {
      chrome.runtime.sendMessage(
        {
          action: 'calculateTimeRemaining',
          savedAt,
          autoDeletePeriod,
        },
        response =>
          applyTimeRemainingResponse(response, setTimeLeft, setColorClass),
      )
    }

    calculateTimeLeft()

    const timer = setInterval(calculateTimeLeft, 60000)
    return () => clearInterval(timer)
  }, [savedAt, autoDeletePeriod])

  if (!timeLeft) {
    return null
  }

  return (
    <span className={`text-xs ${colorClass}`} title='自動削除までの残り時間'>
      {timeLeft}
    </span>
  )
}
