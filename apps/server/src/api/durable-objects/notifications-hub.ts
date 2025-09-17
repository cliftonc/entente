// Minimal type shims for Cloudflare Durable Objects to satisfy TypeScript when
// building in a Node + Workers compatible project without the workers-types package.
// (The runtime actually provides these in the Workers environment.)
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DurableObjectState {
  setAlarm: (time: number) => void
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DurableObjectNamespace {
  idFromName(name: string): any
  get(id: any): any
}

export interface Env {
  NOTIFICATIONS_HUB: DurableObjectNamespace
}

interface BroadcastMessage {
  type: string
  tenantId?: string
  __channel?: string
  [key: string]: any
}

interface ConnectionInfo {
  id: string
  ws: WebSocket
  tenantId: string
  userId?: string
  lastSeen: number
  subscriptions: Set<string>
}

export class NotificationsHub {
  private state: DurableObjectState
  private env: Env
  private connections: Map<string, ConnectionInfo>

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.connections = new Map()
    if (typeof (this.state as any).setAlarm === 'function') {
      ;(this.state as any).setAlarm(Date.now() + 5 * 60 * 1000)
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket upgrade path
    if (request.headers.get('Upgrade') === 'websocket' && url.pathname === '/connect') {
      // Use global WebSocketPair (available in Workers runtime)
      // @ts-ignore - provided by Workers
      const pair = new WebSocketPair()
      const client: WebSocket = (pair[0] || pair['0']) as WebSocket
      const server: WebSocket = (pair[1] || pair['1']) as WebSocket
      const connectionId = crypto.randomUUID()

      // @ts-ignore - accept() exists in Workers runtime
      ;(server as any).accept()

      const tenantId = url.searchParams.get('tenantId') || 'unknown-tenant'
      const userId = url.searchParams.get('userId') || undefined

      const info: ConnectionInfo = {
        id: connectionId,
        ws: server,
        tenantId,
        userId,
        lastSeen: Date.now(),
        subscriptions: new Set(),
      }
      this.connections.set(connectionId, info)

      server.addEventListener('message', (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data as string)
          info.lastSeen = Date.now()
          switch (data.type) {
            case 'pong':
              break
            case 'ping':
              server.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
              break
            case 'subscribe':
              if (data.channel) info.subscriptions.add(data.channel)
              break
            case 'unsubscribe':
              if (data.channel) info.subscriptions.delete(data.channel)
              break
            default:
              break
          }
        } catch {
          // ignore
        }
      })

      const remove = () => this.connections.delete(connectionId)
      server.addEventListener('close', remove)
      server.addEventListener('error', remove)

      server.send(
        JSON.stringify({
          type: 'welcome',
          connectionId,
          tenantId,
          ts: Date.now(),
        })
      )

      // Return 101 switching protocols
      // Cast to any to satisfy TS; Workers runtime supports 'webSocket' init.
      return new Response(null as any, {
        status: 101, // @ts-ignore
        webSocket: client as any,
      })
    }

    // Broadcast endpoint (internal use by API)
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const body = (await request.json()) as BroadcastMessage
      const tenantId = body.tenantId
      const channel = body.__channel
      const payload = JSON.stringify(body)
      let count = 0
      for (const c of this.connections.values()) {
        if (tenantId && c.tenantId !== tenantId) continue
        if (channel && !c.subscriptions.has(channel)) continue
        try {
          c.ws.send(payload)
          count++
        } catch {
          this.connections.delete(c.id)
        }
      }
      return new Response(JSON.stringify({ sent: count }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.pathname === '/stats') {
      const stats = {
        total: this.connections.size,
        byTenant: Array.from(this.connections.values()).reduce<Record<string, number>>((acc, c) => {
          acc[c.tenantId] = (acc[c.tenantId] || 0) + 1
          return acc
        }, {}),
        connections: Array.from(this.connections.values()).map(c => ({
          id: c.id,
          tenantId: c.tenantId,
          userId: c.userId,
          lastSeen: c.lastSeen,
          subscriptions: Array.from(c.subscriptions),
        })),
      }
      return new Response(JSON.stringify(stats), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404 })
  }

  async alarm() {
    const now = Date.now()
    const staleMs = 2 * 60 * 1000
    for (const [id, info] of this.connections) {
      if (now - info.lastSeen > staleMs) {
        try {
          info.ws.close(1001, 'Stale')
        } catch {}
        this.connections.delete(id)
      }
    }
    if (typeof (this.state as any).setAlarm === 'function') {
      ;(this.state as any).setAlarm(Date.now() + 5 * 60 * 1000)
    }
  }
}

export default { NotificationsHub }
