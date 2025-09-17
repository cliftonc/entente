import { Hono } from 'hono'
import type { Context } from 'hono'

// For Node.js development, we'll create a simpler WebSocket handler
// In production (Cloudflare Workers), we would use upgradeWebSocket from 'hono/cloudflare-workers'

export interface WebSocketConnection {
  id: string
  tenantId: string
  userId?: string
  ws: WebSocket
  lastPing: Date
  subscriptions: Set<string>
}

// Global connection manager (in production, this would be in Redis or similar)
const connections = new Map<string, WebSocketConnection>()

export const websocketRouter = new Hono()

// For Node.js development, create a simple endpoint that returns WebSocket connection info
// In production, this would be replaced with proper WebSocket upgrade logic
websocketRouter.get('/ws', async (c: Context) => {
  // In a real implementation with Node.js WebSocket server,
  // this would handle the WebSocket upgrade
  return c.json({
    message: 'WebSocket endpoint - would upgrade in production',
    timestamp: new Date().toISOString(),
    status: 'development_mode'
  })
})

// WebSocket notification broadcaster
export const websocketBroadcaster = {
  /**
   * Broadcast message to all connections in a tenant
   */
  broadcastToTenant: (tenantId: string, message: any) => {
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

    console.log(`Broadcasted message to ${sentCount} connections in tenant ${tenantId}`)
    return sentCount
  },

  /**
   * Broadcast message to specific channel subscribers in a tenant
   */
  broadcastToChannel: (tenantId: string, channel: string, message: any) => {
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

    console.log(`Broadcasted message to ${sentCount} connections in channel ${channel} for tenant ${tenantId}`)
    return sentCount
  },

  /**
   * Get connection stats
   */
  getStats: () => {
    const totalConnections = connections.size
    const tenantCounts = Array.from(connections.values()).reduce((acc, conn) => {
      acc[conn.tenantId] = (acc[conn.tenantId] || 0) + 1
      return acc
    }, {} as Record<string, number>)

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
        console.log(`Cleaned up stale connection: ${connectionId}`)
      }
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} stale connections`)
    }
  },
}

// Set up periodic cleanup
setInterval(websocketBroadcaster.cleanup, 5 * 60 * 1000) // Every 5 minutes