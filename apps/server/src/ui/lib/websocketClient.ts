// Singleton WebSocket client that exists outside of React component lifecycle
import { useWebSocketStore } from '../stores/websocketStore'

class WebSocketClient {
  private static instance: WebSocketClient | null = null
  private ws: WebSocket | null = null
  private connectionId: string | null = null
  private isConnecting = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 5
  private reconnectTimeout: NodeJS.Timeout | null = null

  private constructor() {}

  static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient()
    }
    return WebSocketClient.instance
  }

  private lastTenantId: string | null = null

  connect(tenantId: string): void {
    this.lastTenantId = tenantId
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('WebSocket: Already connected or connecting')
      return
    }

    this.isConnecting = true
    this.connectionId = crypto.randomUUID()
    const currentConnectionId = this.connectionId

    console.log(`WebSocket: Starting singleton connection ${currentConnectionId}`)

    // Close existing connection if any
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // Get the store for updating state
    const store = useWebSocketStore.getState()
    store.setConnectionState('connecting')

    try {
      const baseUrl = import.meta.env.DEV
        ? 'ws://localhost:3001/ws'
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

      // Add tenant ID as query parameter
      const wsUrl = `${baseUrl}?tenantId=${encodeURIComponent(tenantId)}`

      console.log(`WebSocket: Connecting to ${wsUrl}`)
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        // Verify this is still the current connection attempt
        if (this.connectionId !== currentConnectionId) {
          console.log(
            `WebSocket: Connection ${currentConnectionId} opened but is no longer current, closing`
          )
          this.ws?.close()
          return
        }

        this.isConnecting = false
        this.reconnectAttempts = 0
        const store = useWebSocketStore.getState()
        store.setConnectionState('connected')
        store.resetReconnectAttempts()
        store.updateLastPingTime()

        // Resubscribe to all previous subscriptions
        const { subscriptions } = store
        subscriptions.forEach(channel => {
          this.ws?.send(
            JSON.stringify({
              type: 'subscribe',
              channel,
            })
          )
        })

        console.log(`WebSocket: Singleton connected ${currentConnectionId}`)
      }

      this.ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data)

          // Handle ping messages by sending pong
          if (data.type === 'ping') {
            this.ws?.send(
              JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
              })
            )
          }

          const store = useWebSocketStore.getState()
          store.handleEvent(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = event => {
        this.isConnecting = false
        const store = useWebSocketStore.getState()
        store.setConnectionState('disconnected')

        console.log(`WebSocket: Singleton disconnected ${currentConnectionId}`, {
          code: event.code,
          reason: event.reason,
        })

        // Only reconnect if this was the current connection and it's an unexpected close
        if (
          this.connectionId === currentConnectionId &&
          this.reconnectAttempts < this.maxReconnectAttempts &&
          event.code !== 1000
        ) {
          this.reconnectAttempts++
          const delay = 1000 * Math.pow(2, this.reconnectAttempts)
          console.log(
            `WebSocket: Singleton reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
          )

          this.reconnectTimeout = setTimeout(() => {
            // Only reconnect if still the current connection
            if (this.connectionId === currentConnectionId) {
              if (this.lastTenantId) {
                this.connect(this.lastTenantId)
              }
            }
          }, delay)
        }
      }

      this.ws.onerror = error => {
        console.error('WebSocket singleton error:', error)
        const store = useWebSocketStore.getState()
        store.setConnectionError('WebSocket connection failed')
      }
    } catch (error) {
      this.isConnecting = false
      const store = useWebSocketStore.getState()
      store.setConnectionError(error instanceof Error ? error.message : 'Connection failed')
      console.log(`WebSocket singleton connection attempt ${currentConnectionId} failed:`, error)
    }
  }

  disconnect(): void {
    console.log(`WebSocket: Singleton disconnect called, clearing connection ${this.connectionId}`)

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this.connectionId = null
    this.isConnecting = false
    this.reconnectAttempts = 0

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    const store = useWebSocketStore.getState()
    store.setConnectionState('disconnected')
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket: Attempted to send message but connection is not open')
    }
  }

  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (this.isConnecting) return 'connecting'
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected'
    return 'disconnected'
  }
}

export const websocketClient = WebSocketClient.getInstance()
