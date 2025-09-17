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

// WebSocket endpoint:
// - In development: handled by standalone ws server at ws://localhost:3001/ws (see dev-server.ts)
// - In production (Workers): proxy upgrade to Durable Object instance for the tenant
websocketRouter.get('/ws', async (c: Context) => {
  const isNode = typeof process !== 'undefined' && process.release?.name === 'node'
  if (isNode) {
    return c.json({
      message: 'WebSocket endpoint (development handled by Node ws server)',
      timestamp: new Date().toISOString(),
      status: 'development_mode',
    })
  }

  // Workers environment: forward upgrade to Durable Object
  const env: any = c.env
  if (!env?.NOTIFICATIONS_HUB) {
    return c.json({ error: 'Notifications Durable Object not bound' }, 500)
  }

  const url = new URL(c.req.url)
  // Derive tenant/user from authenticated session when available (preferred)
  const session = c.get('session') as { tenantId: string; userId?: string } | undefined
  const tenantId = session?.tenantId || url.searchParams.get('tenantId') || 'unknown-tenant'
  const userId = session?.userId || url.searchParams.get('userId') || undefined

  const id = env.NOTIFICATIONS_HUB.idFromName(tenantId)
  const stub = env.NOTIFICATIONS_HUB.get(id)

  // Build DO connect URL with query params
  const connectUrl = new URL('/connect', 'https://notifications-hub')
  connectUrl.searchParams.set('tenantId', tenantId)
  if (userId) connectUrl.searchParams.set('userId', userId)

  const upgradeHeaders = new Headers(c.req.raw.headers)
  upgradeHeaders.set('Upgrade', 'websocket')

  const response: Response = await stub.fetch(connectUrl.toString(), {
    headers: upgradeHeaders,
  })

  // Return the upgraded response directly (Workers runtime handles 101 switching protocol)
  return response
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

    console.log(
      `Broadcasted message to ${sentCount} connections in channel ${channel} for tenant ${tenantId}`
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
        console.log(`Cleaned up stale connection: ${connectionId}`)
      }
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} stale connections`)
    }
  },
}

// Set up periodic cleanup
const isNodeRuntime = typeof process !== 'undefined' && process.release?.name === 'node'
// In Cloudflare Workers, scheduling timers (setInterval/setTimeout) in global scope is disallowed.
// We only enable periodic cleanup when running under the Node.js dev server. In the Workers
// environment we'll rely on per-message operations (broadcasts) to naturally prune closed sockets
// and can later add a Durable Object with an alarm for maintenance.
if (isNodeRuntime) {
  setInterval(websocketBroadcaster.cleanup, 5 * 60 * 1000) // Every 5 minutes
}
