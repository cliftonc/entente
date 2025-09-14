import { useMemo } from 'react'

interface TimestampDisplayProps {
  timestamp: string | Date
  className?: string
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
  }

  if (diffHours < 24) {
    return `${diffHours} hr${diffHours !== 1 ? 's' : ''} ago`
  }

  if (diffDays === 1) {
    return '1 day ago'
  }

  // For dates more than 1 day ago, show full timestamp in 24hr format
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function TimestampDisplay({ timestamp, className = '' }: TimestampDisplayProps) {
  const date = useMemo(() => {
    if (!timestamp) return null
    const parsedDate = timestamp instanceof Date ? timestamp : new Date(timestamp)
    return isNaN(parsedDate.getTime()) ? null : parsedDate
  }, [timestamp])

  const formattedTime = useMemo(() => {
    if (!date) return 'N/A'
    return formatRelativeTime(date)
  }, [date])

  const fullTimestamp = useMemo(() => {
    if (!date) return 'Invalid Date'
    return date.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }, [date])

  return (
    <span className={className} title={fullTimestamp}>
      {formattedTime}
    </span>
  )
}

export default TimestampDisplay
