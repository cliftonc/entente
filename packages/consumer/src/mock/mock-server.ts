import { createServer, type Server } from 'node:http'
import type { SupportedSpec, Fixture } from '@entente/types'
import { debugLog } from '@entente/types'
import {
  createOperationMatchingService,
  createFixtureCollectionService,
  createInteractionRecordingService,
  withErrorHandling,
  type OperationMatchingService,
  type FixtureCollectionService,
  type InteractionRecordingService,
} from '../shared/index.js'

export interface MockRequest {
  method: string
  path: string
  headers: Record<string, string>
  query: Record<string, unknown>
  body: unknown
}

export interface MockResponse {
  status: number
  headers: Record<string, string>
  body: unknown
  duration: number
}

export interface MockServer {
  url: string
  port: number
  close(): Promise<void>
  onRequest(handler: (req: MockRequest, res: MockResponse) => Promise<void>): void
  getOperations(): Array<{ method: string; path: string; operationId?: string }>
  [Symbol.dispose](): Promise<void>

  // AsyncAPI support (optional)
  websocket?: any
  sendEvent?: (channel: string, data: any) => void
  getChannels?: () => string[]
}

export interface MockServerConfig {
  spec: SupportedSpec
  fixtures: Fixture[]
  port?: number
  service: string
  providerVersion: string
  serviceUrl: string
  apiKey: string
  consumer: string
  consumerVersion: string
  environment: string
  enableRecording?: boolean
  enableFixtureCollection?: boolean
}

export const createMockServer = async (
  config: MockServerConfig
): Promise<MockServer> => {
  const actualPort = config.port || 3000 + Math.floor(Math.random() * 1000)

  // Initialize shared services
  const operationMatching = createOperationMatchingService(config.spec, config.fixtures, {
    debug: process.env.ENTENTE_DEBUG === 'true',
    useRouter: true, // Mock mode needs response generation
  })

  const fixtureCollection = createFixtureCollectionService({
    service: config.service,
    providerVersion: config.providerVersion,
    specType: operationMatching.getSpec().type,
    serviceUrl: config.serviceUrl,
    apiKey: config.apiKey,
    enabled: config.enableFixtureCollection !== false,
  })

  const interactionRecording = createInteractionRecordingService({
    consumer: config.consumer,
    consumerVersion: config.consumerVersion,
    environment: config.environment,
    serviceUrl: config.serviceUrl,
    apiKey: config.apiKey,
    enabled: config.enableRecording !== false,
  })

  // Get operations for introspection
  const spec = operationMatching.getSpec()
  const operations = (() => {
    try {
      // This would need to be implemented properly based on spec type
      return [] // Placeholder
    } catch {
      return []
    }
  })()

  let httpServer: Server | null = null
  const requestHandlers: Array<(req: MockRequest, res: MockResponse) => Promise<void>> = []

  const startServer = async () => {
    httpServer = createServer(async (req, res) => {
      const startTime = Date.now()

      await withErrorHandling(
        async () => {
          // Parse request
          const url = new URL(req.url || '/', `http://localhost:${actualPort}`)
          const method = req.method || 'GET'

          // Extract headers
          const headers: Record<string, string> = {}
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') {
              headers[key.toLowerCase()] = value
            } else if (Array.isArray(value)) {
              headers[key.toLowerCase()] = value.join(', ')
            }
          }

          // Extract query parameters
          const query: Record<string, unknown> = {}
          for (const [key, value] of url.searchParams.entries()) {
            query[key] = value
          }

          // Extract body if present
          let body: unknown = undefined
          if (method !== 'GET' && method !== 'HEAD') {
            try {
              const chunks: Buffer[] = []
              for await (const chunk of req) {
                chunks.push(chunk)
              }
              const bodyText = Buffer.concat(chunks).toString()

              if (bodyText) {
                const contentType = headers['content-type'] || ''
                if (contentType.includes('application/json')) {
                  body = JSON.parse(bodyText)
                } else {
                  body = bodyText
                }
              }
            } catch {
              // Ignore body parsing errors
            }
          }

          // Convert to unified request
          const unifiedRequest = {
            method,
            path: url.pathname,
            headers,
            query,
            body,
          }

          // Handle request using shared operation matching
          const handleResult = operationMatching.handleRequest(unifiedRequest)

          // Set response
          res.statusCode = handleResult.response.status
          for (const [key, value] of Object.entries(handleResult.response.headers || {})) {
            res.setHeader(key, String(value))
          }

          const responseBody = typeof handleResult.response.body === 'string'
            ? handleResult.response.body
            : JSON.stringify(handleResult.response.body)

          res.end(responseBody)

          const duration = Date.now() - startTime

          // Create mock objects for handlers
          const mockReq: MockRequest = {
            method,
            path: url.pathname,
            headers,
            query,
            body,
          }

          const mockRes: MockResponse = {
            status: handleResult.response.status,
            headers: handleResult.response.headers,
            body: handleResult.response.body,
            duration,
          }

          // Record interaction
          await interactionRecording.record({
            service: config.service,
            providerVersion: config.providerVersion,
            operation: handleResult.match.operation,
            request: {
              method: mockReq.method,
              path: mockReq.path,
              headers: mockReq.headers,
              query: mockReq.query,
              body: mockReq.body,
            },
            response: {
              status: mockRes.status,
              headers: mockRes.headers,
              body: mockRes.body,
            },
            matchContext: handleResult.match.metadata,
            duration: mockRes.duration,
          })

          // Collect fixture for successful responses
          if (mockRes.status >= 200 && mockRes.status < 300) {
            await fixtureCollection.collect(handleResult.match.operation, {
              request: {
                method: mockReq.method,
                path: mockReq.path,
                headers: mockReq.headers,
                query: mockReq.query,
                body: mockReq.body,
              },
              response: {
                status: mockRes.status,
                headers: mockRes.headers,
                body: mockRes.body,
              },
            })
          }

          // Invoke registered handlers
          for (const handler of requestHandlers) {
            try {
              await handler(mockReq, mockRes)
            } catch (handlerError) {
              console.error('Handler error:', handlerError)
            }
          }
        },
        { service: config.service, mode: 'mock', phase: 'request' },
        () => {
          // Fallback response
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      )
    })

    await new Promise<void>((resolve, reject) => {
      httpServer!.listen(actualPort, (err?: Error) => {
        if (err) reject(err)
        else resolve()
      })
    })

    debugLog(`🚀 [MockServer] Unified mock server started on port ${actualPort}`)
  }

  await startServer()

  const close = async (): Promise<void> => {
    debugLog('🔄 [MockServer] Starting cleanup...')

    // Close HTTP server
    if (httpServer) {
      await new Promise<void>(resolve => {
        httpServer!.close(() => resolve())
      })
      httpServer = null
    }

    // Flush shared services
    await Promise.all([
      fixtureCollection.flush(),
      interactionRecording.flush(),
    ])

    debugLog('✅ [MockServer] Cleanup completed')
  }

  return {
    url: `http://localhost:${actualPort}`,
    port: actualPort,
    close,
    onRequest: (handler) => {
      requestHandlers.push(handler)
    },
    getOperations: () => operations,
    [Symbol.dispose]: close,

    // AsyncAPI support (optional)
    websocket: undefined,
    sendEvent: undefined,
    getChannels: undefined,
  }
}