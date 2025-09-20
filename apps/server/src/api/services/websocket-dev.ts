import type { IncomingMessage } from 'node:http'
import { parse } from 'node:url'
import { WebSocket, type WebSocketServer } from 'ws'
import { debugLog } from '@entente/types'

export interface WebSocketConnection {
  id: string
  tenantId: string
  userId?: string
  ws: WebSocket
  lastPing: Date
  subscriptions: Set<string>
}

// Global connection manager for development
const connections = new Map<string, WebSocketConnection>()

// Export the broadcaster for use by other parts of the application
export const devWebSocketBroadcaster = {
  /**
   * Broadcast message to all connections in a tenant
   */
  broadcastToTenant: async (tenantId: string, message: any) => {
    const relevantConnections = Array.from(connections.values()).filter(
      conn => conn.tenantId === tenantId && conn.ws.readyState === WebSocket.OPEN
    )

    const messageStr = JSON.stringify(message)
    let sentCount = 0

    for (const connection of relevantConnections) {
      try {
        connection.ws.send(messageStr)
        sentCount++
      } catch (error) {
        console.error(`Failed to send message to connection ${connection.id}:`, error)
        // Remove dead connection
        connections.delete(connection.id)
      }
    }

    debugLog(`📡 [DEV] Broadcasted message to ${sentCount} connections in tenant ${tenantId}`)
    return sentCount
  },

  /**
   * Broadcast message to specific channel subscribers in a tenant
   */
  broadcastToChannel: async (tenantId: string, channel: string, message: any) => {
    const relevantConnections = Array.from(connections.values()).filter(
      conn =>
        conn.tenantId === tenantId &&
        conn.ws.readyState === WebSocket.OPEN &&
        conn.subscriptions.has(channel)
    )

    const messageStr = JSON.stringify(message)
    let sentCount = 0

    for (const connection of relevantConnections) {
      try {
        connection.ws.send(messageStr)
        sentCount++
      } catch (error) {
        console.error(`Failed to send message to connection ${connection.id}:`, error)
        // Remove dead connection
        connections.delete(connection.id)
      }
    }

    debugLog(
      `📡 [DEV] Broadcasted message to ${sentCount} connections in channel ${channel} for tenant ${tenantId}`
    )
    return sentCount
  },

  /**
   * Get connection stats
   */
  getStats: () => {
    const totalConnections = connections.size
    const tenantCounts = Array.from(connections.values()).reduce(
      (acc, conn) => {
        acc[conn.tenantId] = (acc[conn.tenantId] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return {
      totalConnections,
      tenantCounts,
      connections: Array.from(connections.values()).map(conn => ({
        id: conn.id,
        tenantId: conn.tenantId,
        userId: conn.userId,
        lastPing: conn.lastPing,
        subscriptions: Array.from(conn.subscriptions),
      })),
    }
  },

  /**
   * Clean up stale connections
   */
  cleanup: () => {
    const now = new Date()
    const staleThreshold = 2 * 60 * 1000 // 2 minutes

    let removedCount = 0
    for (const [connectionId, connection] of connections) {
      const timeSinceLastPing = now.getTime() - connection.lastPing.getTime()
      if (timeSinceLastPing > staleThreshold || connection.ws.readyState !== WebSocket.OPEN) {
        connections.delete(connectionId)
        removedCount++
        debugLog(`🧹 [DEV] Cleaned up stale connection: ${connectionId}`)
      }
    }

    if (removedCount > 0) {
      debugLog(`🧹 [DEV] Cleaned up ${removedCount} stale connections`)
    }
  },
}

/**
 * Extract tenant ID from request (for development, we'll use a simple approach)
 * In production, this would validate the session/auth token
 */
function extractTenantFromRequest(req: IncomingMessage): { tenantId?: string; userId?: string } {
  // For development, we'll use query parameters or default to a test tenant
  const query = parse(req.url || '', true).query

  debugLog(`🔍 [DEV] WebSocket request URL: ${req.url}`)
  debugLog(`🔍 [DEV] Parsed query:`, query)

  const tenantId = query.tenantId as string
  const userId = query.userId as string

  return {
    tenantId: tenantId && tenantId !== 'undefined' ? tenantId : 'dev-tenant-1',
    userId: userId && userId !== 'undefined' ? userId : 'dev-user-1',
  }
}

/**
 * Set up WebSocket server for development
 */
export function setupWebSocketServer(wss: WebSocketServer) {
  debugLog('🔧 Setting up WebSocket server for development')

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const { tenantId, userId } = extractTenantFromRequest(req)

    if (!tenantId) {
      console.warn('⚠️  [DEV] WebSocket connection attempted without tenant ID')
      ws.close(1008, 'Tenant ID required')
      return
    }

    const connectionId = crypto.randomUUID()
    const connection: WebSocketConnection = {
      id: connectionId,
      tenantId,
      userId,
      ws,
      lastPing: new Date(),
      subscriptions: new Set(),
    }

    connections.set(connectionId, connection)

    debugLog(`🔗 [DEV] WebSocket connected: ${connectionId} for tenant ${tenantId}`)

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'welcome',
        connectionId,
        tenantId,
        timestamp: new Date().toISOString(),
      })
    )

    // Set up ping interval
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'ping',
            timestamp: new Date().toISOString(),
          })
        )
        connection.lastPing = new Date()
      } else {
        clearInterval(pingInterval)
      }
    }, 30000) // Ping every 30 seconds

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())

        switch (message.type) {
          case 'pong':
            connection.lastPing = new Date()
            break

          case 'subscribe':
            if (message.channel) {
              connection.subscriptions.add(message.channel)
              debugLog(`📬 [DEV] Connection ${connection.id} subscribed to ${message.channel}`)
            }
            break

          case 'unsubscribe':
            if (message.channel) {
              connection.subscriptions.delete(message.channel)
              debugLog(
                `📭 [DEV] Connection ${connection.id} unsubscribed from ${message.channel}`
              )
            }
            break

          default:
            debugLog('❓ [DEV] Unknown WebSocket message type:', message.type)
        }
      } catch (error) {
        console.error('❌ [DEV] Error processing WebSocket message:', error)
      }
    })

    // Handle connection close
    ws.on('close', () => {
      connections.delete(connectionId)
      debugLog(`💔 [DEV] WebSocket disconnected: ${connectionId}`)
      clearInterval(pingInterval)
    })

    // Handle errors
    ws.on('error', (error: Error) => {
      console.error(`❌ [DEV] WebSocket error for ${connectionId}:`, error)
      connections.delete(connectionId)
      clearInterval(pingInterval)
    })
  })

  // Set up periodic cleanup
  const cleanupInterval = setInterval(devWebSocketBroadcaster.cleanup, 5 * 60 * 1000) // Every 5 minutes

  // Handle server shutdown
  wss.on('close', () => {
    clearInterval(cleanupInterval)
    debugLog('🔌 [DEV] WebSocket server closed')
  })

  debugLog('✅ [DEV] WebSocket server setup complete')
}
