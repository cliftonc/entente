import { AnimatePresence, motion } from 'framer-motion'
import type React from 'react'
import { useEffect, useState } from 'react'
import { useWebSocketStore } from '../stores/websocketStore'

// Animation variants (loosened typing to avoid framer type friction in Workers)
const indicatorVariants: any = {
  idle: { scale: 1, opacity: 1 },
  pulse: {
    scale: [1, 1.15, 1],
    transition: { duration: 0.6, ease: 'easeOut' },
  },
  shake: {
    x: [0, -2, 2, -2, 0],
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
}

const rippleVariants: any = {
  hidden: { scale: 1, opacity: 0 },
  visible: {
    scale: [1, 3, 4],
    opacity: [0.6, 0.3, 0],
    transition: { duration: 1.0, ease: 'easeOut' },
  },
}

/**
 * Unified compact WebSocket status indicator (previous full variant removed)
 */
export const WebSocketStatus: React.FC = () => {
  const { isConnected, isConnecting, lastEvent, connectionError } = useWebSocketStore()
  const [isFlashing, setIsFlashing] = useState(false)

  const flashKey = lastEvent?.timestamp || 'no-event'
  const shouldAnimate = Boolean(lastEvent)

  // Flash purple briefly when a message/event arrives
  useEffect(() => {
    if (lastEvent) {
      setIsFlashing(true)
      const timer = setTimeout(() => setIsFlashing(false), 1200)
      return () => clearTimeout(timer)
    }
  }, [lastEvent?.timestamp])

  const getStatusColor = () => {
    if (isFlashing) return 'text-purple-500'
    if (isConnecting) return 'text-yellow-500'
    if (isConnected) return 'text-green-500'
    return 'text-red-500'
  }

  const getRippleColor = () => {
    if (isFlashing) return 'border-purple-500'
    if (isConnecting) return 'border-yellow-500'
    if (isConnected) return 'border-green-500'
    return 'border-red-500'
  }

  return (
    <div className="relative flex items-center justify-center w-4 h-4" title="WebSocket Status">
      <motion.span
        key={flashKey}
        className={`text-sm ${getStatusColor()} relative z-10`}
        variants={indicatorVariants}
        initial="idle"
        animate={
          connectionError && !isConnected
            ? 'shake'
            : shouldAnimate
              ? 'pulse'
              : isConnecting
                ? 'pulse'
                : 'idle'
        }
      >
        ●
      </motion.span>

      <AnimatePresence>
        {shouldAnimate && (
          <>
            <motion.div
              key={`ripple-1-${flashKey}`}
              className={`absolute w-3 h-3 rounded-full border ${getRippleColor()} pointer-events-none inset-0 m-auto`}
              variants={rippleVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            />
            <motion.div
              key={`ripple-2-${flashKey}`}
              className={`absolute w-3 h-3 rounded-full border ${getRippleColor()} pointer-events-none inset-0 m-auto`}
              variants={rippleVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ delay: 0.15, duration: 1.0, ease: 'easeOut' }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
