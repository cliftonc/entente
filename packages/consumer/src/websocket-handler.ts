import { specRegistry } from '@entente/fixtures'
import type { APIOperation, UnifiedRequest, UnifiedResponse } from '@entente/types'
import { debugLog } from '@entente/types'
import WebSocket, { WebSocketServer } from 'ws'

export interface WebSocketMockServer {
  port: number
  url: string
  close: () => Promise<void>
  sendEvent: (channel: string, data: any) => void
  onConnection: (handler: (ws: WebSocket) => void) => void
}

// Pure function to create WebSocket request from message
export const createWebSocketRequest = (
  channel: string,
  message: any,
  eventType?: string
): UnifiedRequest => ({
  channel,
  eventType: eventType || message.eventType || 'message',
  body: message,
  headers: {
    'content-type': 'application/json',
    upgrade: 'websocket',
  },
})

// Pure function to handle WebSocket message with spec operations
export const handleWebSocketMessage = (
  message: any,
  channel: string,
  operations: APIOperation[]
): UnifiedResponse => {
  const request = createWebSocketRequest(channel, message, message.eventType)

  // Find AsyncAPI handler
  const asyncHandler = specRegistry.getHandler('asyncapi')
  if (!asyncHandler) {
    // Return a basic successful response if no handler is available
    return {
      status: 200,
      body: {
        message: 'Message received',
        channel,
        eventType: message.eventType || 'message',
      },
      success: true,
    }
  }

  // Try to match the request to an operation
  const matchResult = asyncHandler.matchOperation({
    request,
    operations,
    specType: 'asyncapi'
  })
  if (!matchResult.selected) {
    // Return a basic response even if no operation matches
    return {
      status: 200,
      body: {
        message: 'Message received (no operation match)',
        channel,
        eventType: message.eventType || 'message',
      },
      success: true,
    }
  }

  // Generate response using the handler
  return asyncHandler.generateResponse({
    operation: matchResult.selected.operation,
    fixtures: [],
    request,
    match: matchResult.selected,
  })
}

// Factory function to create WebSocket mock server
export const createWebSocketMockServer = async (
  port = 0,
  operations: APIOperation[] = []
): Promise<WebSocketMockServer> => {
  const actualPort = port || 8080 + Math.floor(Math.random() * 1000)

  const wss = new WebSocketServer({ port: actualPort })
  const connections = new Set<WebSocket>()
  const connectionHandlers: Array<(ws: WebSocket) => void> = []

  // Handle new connections
  wss.on('connection', (ws: WebSocket) => {
    connections.add(ws)
    debugLog(`📡 WebSocket connection established (${connections.size} total)`)

    // Apply connection handlers
    for (const handler of connectionHandlers) {
      try {
        handler(ws)
      } catch (error) {
        console.error('Connection handler error:', error)
      }
    }

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        const channel = message.channel || 'default'

        // Handle the message using AsyncAPI operations
        const response = handleWebSocketMessage(message, channel, operations)

        // Always send a response back
        if (response.success) {
          ws.send(
            JSON.stringify({
              type: 'response',
              channel,
              eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              data: response.body || { received: true },
            })
          )
        } else {
          ws.send(
            JSON.stringify({
              type: 'error',
              channel,
              error: 'Failed to process message',
            })
          )
        }
      } catch (error) {
        console.error('WebSocket message handling error:', error)
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Invalid message format or processing error',
          })
        )
      }
    })

    // Handle connection close
    ws.on('close', () => {
      connections.delete(ws)
      debugLog(`📡 WebSocket connection closed (${connections.size} remaining)`)
    })

    // Handle errors
    ws.on('error', error => {
      console.error('WebSocket error:', error)
      connections.delete(ws)
    })
  })

  return {
    port: actualPort,
    url: `ws://localhost:${actualPort}`,

    close: async () => {
      // Close all connections
      for (const ws of connections) {
        ws.close()
      }

      // Close the server
      await new Promise<void>(resolve => {
        wss.close(() => {
          debugLog('📡 WebSocket server closed')
          resolve()
        })
      })
    },

    sendEvent: (channel: string, data: any) => {
      const message = JSON.stringify({
        type: 'event',
        channel,
        data,
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
      })

      // Send to all connected clients
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message)
        }
      }
    },

    onConnection: (handler: (ws: WebSocket) => void) => {
      connectionHandlers.push(handler)
    },
  }
}

// Helper function to extract channels from AsyncAPI operations
export const extractChannelsFromOperations = (operations: APIOperation[]): string[] => {
  const channels = new Set<string>()

  for (const operation of operations) {
    if (operation.channel) {
      channels.add(operation.channel)
    }
  }

  return Array.from(channels)
}

// Helper function to create Server-Sent Events response
export const createSSEResponse = (data: any, event?: string): string => {
  let sseData = ''

  if (event) {
    sseData += `event: ${event}\n`
  }

  sseData += `data: ${JSON.stringify(data)}\n`
  sseData += `id: ${Date.now()}\n`
  sseData += '\n'

  return sseData
}
