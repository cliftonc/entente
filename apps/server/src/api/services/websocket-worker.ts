// Production (Cloudflare Workers) WebSocket broadcaster using Durable Object
// The Durable Object holds active WebSocket connections; we send it messages via fetch.

interface BroadcastOptions {
  channel?: string
}

export function createWorkerWebSocketBroadcaster(env: any) {
  if (!env?.NOTIFICATIONS_HUB) {
    return {
      broadcastToTenant: () => 0,
      broadcastToChannel: () => 0,
      getStats: () => ({ totalConnections: 0, tenantCounts: {}, connections: [] }),
    }
  }

  async function sendToDO(tenantId: string, body: any & { tenantId: string }) {
    const id = env.NOTIFICATIONS_HUB.idFromName(tenantId)
    const stub = env.NOTIFICATIONS_HUB.get(id)
    return await stub.fetch('https://notifications-hub/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  return {
    broadcastToTenant: (tenantId: string, message: any) => {
      return sendToDO(tenantId, { ...message, tenantId }).then(async r => {
        try {
          const data = await r.json()
          return data.sent ?? 0
        } catch {
          return 0
        }
      })
    },
    broadcastToChannel: (tenantId: string, channel: string, message: any) => {
      return sendToDO(tenantId, { ...message, tenantId, __channel: channel }).then(async r => {
        try {
          const data = await r.json()
          return data.sent ?? 0
        } catch {
          return 0
        }
      })
    },
    getStats: () => ({ totalConnections: 0, tenantCounts: {}, connections: [] }), // Optionally implement via /stats
  }
}
