import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createClient } from '../src'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import WebSocket from 'ws'
import { setupDefaultMocks } from '../tests/setup.js'

describe('AsyncAPI Integration Tests', () => {
  let client: any
  let mocks: ReturnType<typeof setupDefaultMocks>

  beforeAll(() => {
    mocks = setupDefaultMocks()
    client = createClient({
      serviceUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      consumer: 'test-consumer',
      consumerVersion: '1.0.0',
      environment: 'test'
    })
  })

  describe('AsyncAPI Mock Server', () => {
    let mock: any

    beforeAll(async () => {
      const schema = readFileSync(
        resolve(__dirname, '../test/specs/castles-asyncapi.yaml'),
        'utf-8'
      )

      // Upload AsyncAPI schema
      await client.uploadSpec('castle-events', '1.0.0', schema, {
        environment: 'test',
        branch: 'main'
      })

      mock = await client.createMock('castle-events', '1.0.0')
    })

    afterAll(async () => {
      if (mock?.close) {
        await mock.close()
      }
    })

    it('should create WebSocket server for AsyncAPI specs', () => {
      expect(mock.websocket).toBeDefined()
      expect(mock.websocket.url).toMatch(/^ws:\/\/localhost:\d+$/)
      expect(typeof mock.sendEvent).toBe('function')
      expect(typeof mock.getChannels).toBe('function')
    })

    it('should handle WebSocket connections and messages', async () => {
      const wsUrl = mock.websocket.url
      const ws = new WebSocket(wsUrl)

      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          // Send a test message
          ws.send(JSON.stringify({
            channel: 'castle/created',
            eventType: 'created',
            castle: {
              id: 'test-id',
              name: 'Test Castle',
              region: 'Test Region',
              yearBuilt: 2024
            }
          }))
        })

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString())
          expect(message.type).toBe('response')
          expect(message.channel).toBe('castle/created')
          expect(message.eventId).toBeDefined()
          ws.close()
          resolve(undefined)
        })

        ws.on('error', reject)

        // Timeout after 5 seconds
        setTimeout(() => {
          ws.close()
          reject(new Error('WebSocket test timeout'))
        }, 5000)
      })
    })

    it('should support Server-Sent Events endpoints', async () => {
      // Test SSE endpoint
      const response = await fetch(`${mock.url}/events/stream`, {
        headers: {
          'Accept': 'text/event-stream'
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      expect(response.headers.get('x-detected-type')).toBe('asyncapi')
    })

    it('should broadcast events to connected clients', async () => {
      const wsUrl = mock.websocket.url
      const ws = new WebSocket(wsUrl)

      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          // Send an event from the server side
          mock.sendEvent('castle/created', {
            eventId: 'broadcast-test',
            eventType: 'created',
            castle: {
              id: 'broadcast-castle',
              name: 'Broadcast Castle'
            }
          })
        })

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString())
          if (message.type === 'event') {
            expect(message.channel).toBe('castle/created')
            expect(message.data.eventId).toBe('broadcast-test')
            ws.close()
            resolve(undefined)
          }
        })

        ws.on('error', reject)

        setTimeout(() => {
          ws.close()
          reject(new Error('Broadcast test timeout'))
        }, 5000)
      })
    })

    it('should list available channels', () => {
      const channels = mock.getChannels()
      expect(Array.isArray(channels)).toBe(true)
      expect(channels).toContain('castle/created')
      expect(channels).toContain('castle/deleted')
      expect(channels).toContain('castle/status')
    })
  })

  describe('AsyncAPI Auto-detection', () => {
    it('should auto-detect WebSocket upgrade requests', async () => {
      const mock = await client.createMock('test-service', '1.0.0')

      const response = await fetch(`${mock.url}/api/ws`, {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade'
        }
      })

      expect(response.headers.get('x-detected-type')).toBe('asyncapi')
      if (mock?.close) await mock.close()
    })

    it('should auto-detect SSE requests', async () => {
      const mock = await client.createMock('test-service', '1.0.0')

      const response = await fetch(`${mock.url}/events`, {
        headers: {
          'Accept': 'text/event-stream'
        }
      })

      expect(response.headers.get('x-detected-type')).toBe('asyncapi')
      if (mock?.close) await mock.close()
    })
  })
})