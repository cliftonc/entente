import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { websocketClient } from '../lib/websocketClient'
import { useWebSocketStore } from '../stores/websocketStore'

interface WebSocketProviderProps {
  children: ReactNode
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { authenticated, currentTenantId } = useAuth()
  const isConnected = useWebSocketStore(state => state.isConnected)

  useEffect(() => {
    console.log('WebSocketProvider: Auth state changed:', { authenticated, currentTenantId })

    // Only connect if authenticated and we have a tenant ID
    if (!authenticated || !currentTenantId) {
      console.log('WebSocketProvider: Not authenticated or no tenant, skipping connection')
      return
    }

    // Check if already connected to prevent multiple connection attempts
    if (isConnected) {
      console.log('WebSocketProvider: Already connected, skipping connect call')
      return
    }

    // Small delay to ensure everything is properly initialized
    const timer = setTimeout(() => {
      console.log('WebSocketProvider: Calling websocketClient.connect() with tenant:', currentTenantId)
      websocketClient.connect(currentTenantId)
    }, 100)

    // Cleanup on unmount - but don't disconnect since it's a singleton
    return () => {
      clearTimeout(timer)
      console.log('WebSocketProvider: Component unmounting (singleton connection remains)')
    }
  }, [authenticated, currentTenantId, isConnected])

  return <>{children}</>
}