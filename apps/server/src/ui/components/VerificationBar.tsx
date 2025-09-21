/**
 * VerificationBar component - displays recent verification results as a grid of colored squares
 * Similar to GitHub's activity graph but for contract verification data
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecentVerifications } from '../hooks/useRecentVerifications'

interface VerificationBarProps {
  days?: number
  className?: string
}

interface VerificationSquare {
  date: string
  status: 'passed' | 'failed' | 'empty'
  count: number
  verificationId?: string
  tooltip: string
}

function VerificationBar({ days = 7, className = '' }: VerificationBarProps) {
  const { data: verifications, isLoading, isError } = useRecentVerifications({ days })
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredSquare, setHoveredSquare] = useState<{
    square: VerificationSquare
    x: number
    y: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track container width changes
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // Calculate squares based on container width and verification data
  const squares = useMemo(() => {
    if (!verifications || containerWidth === 0) return []

    const squareSize = 14 // px
    const gap = 3 // px
    const totalSquareWidth = squareSize + gap
    const maxSquares = Math.floor(containerWidth / totalSquareWidth)

    // Create date range for the last N days
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - (maxSquares - 1) * 24 * 60 * 60 * 1000)

    // Group verifications by date
    const verificationsByDate = new Map<string, (typeof verifications)[0][]>()

    verifications.forEach(verification => {
      const date = new Date(verification.submittedAt).toDateString()
      if (!verificationsByDate.has(date)) {
        verificationsByDate.set(date, [])
      }
      verificationsByDate.get(date)!.push(verification)
    })

    // Create squares for each day
    const result: VerificationSquare[] = []
    for (let i = 0; i < maxSquares; i++) {
      const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const dateString = currentDate.toDateString()
      const dayVerifications = verificationsByDate.get(dateString) || []

      if (dayVerifications.length === 0) {
        result.push({
          date: dateString,
          status: 'empty',
          count: 0,
          tooltip: `No verifications on ${currentDate.toLocaleDateString()}`,
        })
      } else {
        // Determine overall status for the day
        const passedCount = dayVerifications.filter(v => v.status === 'passed').length
        const failedCount = dayVerifications.filter(v => v.status === 'failed').length
        const totalCount = dayVerifications.length

        // Use the most recent verification for linking
        const mostRecent = dayVerifications.sort(
          (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        )[0]

        result.push({
          date: dateString,
          status: failedCount > 0 ? 'failed' : 'passed',
          count: totalCount,
          verificationId: mostRecent.id,
          tooltip: `${currentDate.toLocaleDateString()}: ${passedCount} passed, ${failedCount} failed (${totalCount} total)`,
        })
      }
    }

    return result
  }, [verifications, containerWidth])

  const getSquareColor = (square: VerificationSquare) => {
    switch (square.status) {
      case 'passed':
        return square.count > 5
          ? 'bg-success'
          : square.count > 2
            ? 'bg-success/80'
            : 'bg-success/60'
      case 'failed':
        return square.count > 5 ? 'bg-error' : square.count > 2 ? 'bg-error/80' : 'bg-error/60'
      case 'empty':
      default:
        return 'bg-base-300'
    }
  }

  const handleMouseEnter = (square: VerificationSquare, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setHoveredSquare({
      square,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    })
  }

  const handleMouseLeave = () => {
    setHoveredSquare(null)
  }

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Verification Activity</h3>
          <div className="text-sm text-base-content/70">Loading...</div>
        </div>
        <div className="flex gap-1 overflow-hidden" ref={containerRef}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="w-[14px] h-[14px] bg-base-300 rounded-sm animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Verification Activity</h3>
          <div className="text-sm text-error">Failed to load</div>
        </div>
        <div className="flex gap-1 overflow-hidden" ref={containerRef}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="w-[14px] h-[14px] bg-base-300 rounded-sm" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Verification Activity</h3>
        <div className="text-sm text-base-content/70">
          Last {days} days • {verifications?.length || 0} verifications
        </div>
      </div>

      <div className="flex gap-1 overflow-hidden" ref={containerRef}>
        {squares.map((square, index) => {
          const hasData = square.count > 0

          // Convert date string to proper start/end dates for the day
          const date = new Date(square.date)
          const startDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          const endDateStr = startDateStr // Same day for both start and end

          const key = `${square.date}-${index}`
          const baseProps = {
            className: `
              w-[14px] h-[14px] rounded-sm transition-all duration-200
              ${getSquareColor(square)}
              ${hasData ? 'hover:scale-110 cursor-pointer' : ''}
              ${hoveredSquare?.square === square ? 'scale-110 ring-2 ring-base-content/20' : ''}
            `,
            onMouseEnter: (
              e:
                | React.MouseEvent<HTMLDivElement, MouseEvent>
                | React.MouseEvent<HTMLAnchorElement, MouseEvent>
            ) => handleMouseEnter(square, e),
            onMouseLeave: handleMouseLeave,
            title: square.tooltip,
          }

          if (hasData) {
            return (
              <Link
                key={key}
                {...baseProps}
                to={`/verification?startDate=${startDateStr}&endDate=${endDateStr}`}
              />
            )
          }

          return <div key={key} {...baseProps} />
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-base-content/70">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-[10px] h-[10px] bg-base-300 rounded-sm" />
          <div className="w-[10px] h-[10px] bg-success/60 rounded-sm" />
          <div className="w-[10px] h-[10px] bg-success/80 rounded-sm" />
          <div className="w-[10px] h-[10px] bg-success rounded-sm" />
        </div>
        <span>More</span>
        <div className="flex gap-1 ml-4">
          <div className="w-[10px] h-[10px] bg-error/60 rounded-sm" />
          <span className="text-error">Failed</span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredSquare && (
        <div
          className="fixed z-50 bg-base-100 border border-base-300 rounded-lg px-3 py-2 text-sm shadow-lg pointer-events-none"
          style={{
            left: hoveredSquare.x,
            top: hoveredSquare.y,
            transform: 'translateX(-50%) translateY(-100%)',
          }}
        >
          {hoveredSquare.square.tooltip}
        </div>
      )}
    </div>
  )
}

export default VerificationBar
