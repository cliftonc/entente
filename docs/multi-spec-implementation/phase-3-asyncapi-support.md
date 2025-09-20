---
title: "Phase 3: AsyncAPI Support"
description: "Implement AsyncAPI specification support with WebSocket and Server-Sent Events"
---

# Phase 3: AsyncAPI Support

**Duration**: 1 Week
**Prerequisites**: Phase 1 & 2 completed, understanding of AsyncAPI, WebSockets, and Server-Sent Events
**Goal**: Add comprehensive AsyncAPI support for event-driven APIs with real-time testing capabilities

## Overview

Phase 3 extends the functional spec abstraction to support AsyncAPI specifications. We'll implement event-based operation handling, WebSocket/SSE support, and real-time testing capabilities for asynchronous APIs.

## Task Breakdown

### Task 1: Create AsyncAPI Schema Test File (1 hour)

#### 1.1 Create `packages/fixtures/test/specs/castles-asyncapi.yaml`

```yaml
asyncapi: 2.6.0
info:
  title: Castle Events API
  version: 1.0.0
  description: Event-driven API for castle lifecycle events
  contact:
    name: Castle Service Team
    email: castles@example.com
  license:
    name: MIT

servers:
  development:
    url: ws://localhost:4001/ws
    protocol: ws
    description: Development WebSocket server
  production:
    url: wss://api.castles.example.com/ws
    protocol: wss
    description: Production WebSocket server

channels:
  castle/created:
    description: Event fired when a new castle is created
    publish:
      operationId: publishCastleCreated
      summary: Publish castle created event
      message:
        $ref: '#/components/messages/CastleCreated'
    subscribe:
      operationId: subscribeCastleCreated
      summary: Subscribe to castle created events
      message:
        $ref: '#/components/messages/CastleCreated'

  castle/updated:
    description: Event fired when a castle is updated
    publish:
      operationId: publishCastleUpdated
      summary: Publish castle updated event
      message:
        $ref: '#/components/messages/CastleUpdated'
    subscribe:
      operationId: subscribeCastleUpdated
      summary: Subscribe to castle updated events
      message:
        $ref: '#/components/messages/CastleUpdated'

  castle/deleted:
    description: Event fired when a castle is deleted
    publish:
      operationId: publishCastleDeleted
      summary: Publish castle deleted event
      message:
        $ref: '#/components/messages/CastleDeleted'
    subscribe:
      operationId: subscribeCastleDeleted
      summary: Subscribe to castle deleted events
      message:
        $ref: '#/components/messages/CastleDeleted'

  castle/status:
    description: Castle status updates (maintenance, renovation, etc.)
    parameters:
      castleId:
        description: The castle ID to get status updates for
        schema:
          type: string
          pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
    subscribe:
      operationId: subscribeCastleStatus
      summary: Subscribe to status updates for a specific castle
      message:
        $ref: '#/components/messages/CastleStatusUpdate'

components:
  messages:
    CastleCreated:
      name: CastleCreated
      title: Castle Created Event
      summary: A new castle has been created
      contentType: application/json
      payload:
        $ref: '#/components/schemas/CastleEvent'

    CastleUpdated:
      name: CastleUpdated
      title: Castle Updated Event
      summary: An existing castle has been updated
      contentType: application/json
      payload:
        $ref: '#/components/schemas/CastleEvent'

    CastleDeleted:
      name: CastleDeleted
      title: Castle Deleted Event
      summary: A castle has been deleted
      contentType: application/json
      payload:
        $ref: '#/components/schemas/CastleDeletedEvent'

    CastleStatusUpdate:
      name: CastleStatusUpdate
      title: Castle Status Update
      summary: Status update for a castle
      contentType: application/json
      payload:
        $ref: '#/components/schemas/CastleStatusEvent'

  schemas:
    Castle:
      type: object
      required:
        - id
        - name
        - region
        - yearBuilt
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier for the castle
        name:
          type: string
          description: Name of the castle
        region:
          type: string
          description: French region where the castle is located
        yearBuilt:
          type: integer
          minimum: 1000
          maximum: 2100
          description: Year the castle was built
        description:
          type: string
          description: Optional description of the castle
        status:
          type: string
          enum: [active, maintenance, renovation, closed]
          description: Current status of the castle

    CastleEvent:
      type: object
      required:
        - eventId
        - eventType
        - timestamp
        - castle
      properties:
        eventId:
          type: string
          format: uuid
          description: Unique identifier for this event
        eventType:
          type: string
          enum: [created, updated]
          description: Type of event
        timestamp:
          type: string
          format: date-time
          description: When the event occurred
        castle:
          $ref: '#/components/schemas/Castle'
        previousData:
          $ref: '#/components/schemas/Castle'
          description: Previous castle data (only for update events)

    CastleDeletedEvent:
      type: object
      required:
        - eventId
        - eventType
        - timestamp
        - castleId
      properties:
        eventId:
          type: string
          format: uuid
          description: Unique identifier for this event
        eventType:
          type: string
          enum: [deleted]
          description: Type of event
        timestamp:
          type: string
          format: date-time
          description: When the event occurred
        castleId:
          type: string
          format: uuid
          description: ID of the deleted castle
        castleName:
          type: string
          description: Name of the deleted castle

    CastleStatusEvent:
      type: object
      required:
        - eventId
        - castleId
        - status
        - timestamp
      properties:
        eventId:
          type: string
          format: uuid
          description: Unique identifier for this event
        castleId:
          type: string
          format: uuid
          description: ID of the castle
        status:
          type: string
          enum: [active, maintenance, renovation, closed]
          description: New status of the castle
        previousStatus:
          type: string
          enum: [active, maintenance, renovation, closed]
          description: Previous status of the castle
        timestamp:
          type: string
          format: date-time
          description: When the status changed
        reason:
          type: string
          description: Reason for the status change
```

### Task 2: Implement AsyncAPI Handler Functions (4 hours)

#### 2.1 Install AsyncAPI Dependencies

Add to `packages/fixtures/package.json`:

```json
{
  "dependencies": {
    "js-yaml": "^4.1.0",
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.8",
    "@types/ws": "^8.5.10"
  }
}
```

#### 2.2 Create `packages/fixtures/src/spec-handlers/asyncapi.ts`

```typescript
import type {
  APISpec,
  APIOperation,
  UnifiedRequest,
  UnifiedResponse,
  ValidationResult,
  Fixture,
  AsyncAPISpec as AsyncAPISpecType,
  SpecHandler
} from '@entente/types'
import {
  createSpecHandler,
  generateOperationId,
  createValidationError,
  createValidationSuccess,
  isEventRequest
} from './types'
import * as yaml from 'js-yaml'

// Pure function to check if spec is AsyncAPI
export const canHandleAsyncAPI = (spec: any): boolean => {
  // Check if it's a parsed AsyncAPI object
  if (spec && typeof spec === 'object' && spec.asyncapi) {
    return true
  }

  // Check if it's a YAML string that might be AsyncAPI
  if (typeof spec === 'string') {
    try {
      const parsed = yaml.load(spec) as any
      return parsed && typeof parsed === 'object' && parsed.asyncapi
    } catch {
      return false
    }
  }

  return false
}

// Pure function to parse AsyncAPI spec
export const parseAsyncAPISpec = (spec: any): APISpec => {
  let asyncApiSpec: AsyncAPISpecType

  if (typeof spec === 'string') {
    // Parse YAML string
    const parsed = yaml.load(spec) as any
    if (!parsed || !parsed.asyncapi) {
      throw new Error('Invalid AsyncAPI YAML format')
    }
    asyncApiSpec = parsed as AsyncAPISpecType
  } else if (spec && typeof spec === 'object' && spec.asyncapi) {
    // Already parsed object
    asyncApiSpec = spec as AsyncAPISpecType
  } else {
    throw new Error('Invalid AsyncAPI spec format')
  }

  return {
    type: 'asyncapi',
    version: asyncApiSpec.asyncapi,
    spec: asyncApiSpec
  }
}

// Pure function to extract operations from AsyncAPI spec
export const extractAsyncAPIOperations = (spec: APISpec): APIOperation[] => {
  const asyncSpec = spec.spec as AsyncAPISpecType
  const operations: APIOperation[] = []

  if (!asyncSpec.channels) {
    return operations
  }

  for (const [channel, channelDef] of Object.entries(asyncSpec.channels)) {
    if (!channelDef || typeof channelDef !== 'object') continue

    // Extract publish operations (server publishes, client subscribes)
    if (channelDef.publish) {
      const publishOp = extractAsyncAPIOperation(
        channel,
        channelDef.publish,
        'publish',
        channelDef.parameters
      )
      if (publishOp) operations.push(publishOp)
    }

    // Extract subscribe operations (server subscribes, client publishes)
    if (channelDef.subscribe) {
      const subscribeOp = extractAsyncAPIOperation(
        channel,
        channelDef.subscribe,
        'subscribe',
        channelDef.parameters
      )
      if (subscribeOp) operations.push(subscribeOp)
    }
  }

  return operations
}

// Pure function to match AsyncAPI request to operation
export const matchAsyncAPIRequest = (
  request: UnifiedRequest,
  operations: APIOperation[]
): APIOperation | null => {
  // AsyncAPI requests should have channel and eventType
  if (!isEventRequest(request)) {
    return null
  }

  const { channel, eventType } = request

  // Try to find exact match by channel and event type
  const channelMatch = operations.find(op =>
    op.channel === channel &&
    (op.type === 'event' && eventType?.includes(op.id.split('.')[1]))
  )

  if (channelMatch) {
    return channelMatch
  }

  // Try to find by channel only
  return operations.find(op => op.channel === channel) || null
}

// Pure function to generate AsyncAPI response
export const generateAsyncAPIResponse = (
  operation: APIOperation,
  fixtures: Fixture[]
): UnifiedResponse => {
  // Find matching fixture for AsyncAPI operation
  const fixture = findBestAsyncAPIFixture(operation, fixtures)

  if (fixture) {
    const responseData = fixture.data.response as any
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: responseData.body || responseData,
      eventId: generateEventId(),
      timestamp: new Date(),
      success: true
    }
  }

  // Generate mock event response
  return generateMockAsyncAPIResponse(operation)
}

// Pure function to validate AsyncAPI response
export const validateAsyncAPIResponse = (
  operation: APIOperation,
  expected: any,
  actual: any
): ValidationResult => {
  if (!actual) {
    return createValidationError(
      'response',
      'Response is null or undefined',
      expected,
      actual
    )
  }

  // AsyncAPI responses should have proper event structure
  if (operation.type === 'event') {
    const requiredFields = ['eventId', 'timestamp']

    for (const field of requiredFields) {
      if (!(field in actual)) {
        return createValidationError(
          `response.${field}`,
          `AsyncAPI event response must have ${field} field`,
          expected,
          actual
        )
      }
    }
  }

  return createValidationSuccess()
}

// Pure function to generate mock data for AsyncAPI operation
export const generateAsyncAPIMockData = (operation: APIOperation): any => {
  const channel = operation.channel || 'unknown'
  const operationType = operation.type

  if (operationType === 'event') {
    // Generate mock event data based on channel
    if (channel.includes('created')) {
      return {
        eventId: generateEventId(),
        eventType: 'created',
        timestamp: new Date().toISOString(),
        castle: {
          id: generateId(),
          name: 'Mock Castle',
          region: 'Mock Region',
          yearBuilt: 2024,
          status: 'active'
        }
      }
    } else if (channel.includes('deleted')) {
      return {
        eventId: generateEventId(),
        eventType: 'deleted',
        timestamp: new Date().toISOString(),
        castleId: generateId(),
        castleName: 'Mock Castle'
      }
    } else if (channel.includes('status')) {
      return {
        eventId: generateEventId(),
        castleId: generateId(),
        status: 'maintenance',
        previousStatus: 'active',
        timestamp: new Date().toISOString(),
        reason: 'Scheduled maintenance'
      }
    }
  }

  return {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    data: null
  }
}

// Pure function to get request schema (AsyncAPI events don't have traditional request schemas)
export const getAsyncAPIRequestSchema = (operation: APIOperation): any => {
  return operation.request?.schema || null
}

// Pure function to get response schema
export const getAsyncAPIResponseSchema = (operation: APIOperation): any => {
  return operation.response?.schema || null
}

// Helper functions (pure)
const extractAsyncAPIOperation = (
  channel: string,
  operationDef: any,
  direction: 'publish' | 'subscribe',
  parameters?: any
): APIOperation | null => {
  if (!operationDef || typeof operationDef !== 'object') {
    return null
  }

  const operationId = operationDef.operationId ||
                     generateOperationId(direction, channel.replace(/[^a-zA-Z0-9]/g, '_'))

  return {
    id: operationId,
    type: 'event',
    channel,
    description: operationDef.summary || operationDef.description,
    request: extractAsyncAPIMessageSchema(operationDef.message, 'request'),
    response: extractAsyncAPIMessageSchema(operationDef.message, 'response')
  }
}

const extractAsyncAPIMessageSchema = (message: any, type: 'request' | 'response'): any => {
  if (!message) return null

  // Handle $ref references
  if (message.$ref) {
    return { $ref: message.$ref }
  }

  // Extract payload schema
  if (message.payload) {
    return {
      type: 'object',
      schema: message.payload,
      contentType: message.contentType || 'application/json'
    }
  }

  return null
}

const findBestAsyncAPIFixture = (operation: APIOperation, fixtures: Fixture[]): Fixture | null => {
  // Try to find exact match first
  const exactMatch = fixtures.find(f => f.operation === operation.id)
  if (exactMatch) {
    return exactMatch
  }

  // Try to find by channel
  const channelMatch = fixtures.find(f =>
    f.operation.includes(operation.channel?.replace(/[^a-zA-Z0-9]/g, '_') || '')
  )
  if (channelMatch) {
    return channelMatch
  }

  return null
}

const generateMockAsyncAPIResponse = (operation: APIOperation): UnifiedResponse => {
  const mockData = generateAsyncAPIMockData(operation)

  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: mockData,
    eventId: mockData.eventId,
    timestamp: new Date(),
    success: true
  }
}

const generateEventId = (): string => {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Create the AsyncAPI handler using the pure functions
export const createAsyncAPIHandler = (): SpecHandler => createSpecHandler({
  type: 'asyncapi',
  name: 'AsyncAPI',
  canHandle: canHandleAsyncAPI,
  parseSpec: parseAsyncAPISpec,
  extractOperations: extractAsyncAPIOperations,
  matchRequest: matchAsyncAPIRequest,
  generateResponse: generateAsyncAPIResponse,
  validateResponse: validateAsyncAPIResponse,
  generateMockData: generateAsyncAPIMockData,
  getRequestSchema: getAsyncAPIRequestSchema,
  getResponseSchema: getAsyncAPIResponseSchema
})
```

### Task 3: Add WebSocket Support to Mock Server (3 hours)

#### 3.1 Create `packages/consumer/src/websocket-handler.ts`

```typescript
import type { UnifiedRequest, UnifiedResponse, APIOperation } from '@entente/types'
import { specRegistry, handleUnifiedMockRequest } from '@entente/fixtures'
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
    'upgrade': 'websocket'
  }
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
    return {
      status: 501,
      body: { error: 'AsyncAPI handler not available' },
      success: false
    }
  }

  // Try to match the request to an operation
  const matchedOp = asyncHandler.matchRequest(request, operations)
  if (!matchedOp) {
    return {
      status: 404,
      body: { error: 'No matching operation found' },
      success: false
    }
  }

  // Generate response using the handler
  return asyncHandler.generateResponse(matchedOp, [])
}

// Factory function to create WebSocket mock server
export const createWebSocketMockServer = async (
  port: number = 0,
  operations: APIOperation[] = []
): Promise<WebSocketMockServer> => {
  const actualPort = port || 8080 + Math.floor(Math.random() * 1000)

  const wss = new WebSocketServer({ port: actualPort })
  const connections = new Set<WebSocket>()
  const connectionHandlers: Array<(ws: WebSocket) => void> = []

  // Handle new connections
  wss.on('connection', (ws: WebSocket) => {
    connections.add(ws)
    console.log(`📡 WebSocket connection established (${connections.size} total)`)

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

        // Send response back if it's successful
        if (response.success && response.body) {
          ws.send(JSON.stringify({
            type: 'response',
            channel,
            data: response.body,
            eventId: response.eventId,
            timestamp: response.timestamp
          }))
        }
      } catch (error) {
        console.error('WebSocket message handling error:', error)
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format or processing error'
        }))
      }
    })

    // Handle connection close
    ws.on('close', () => {
      connections.delete(ws)
      console.log(`📡 WebSocket connection closed (${connections.size} remaining)`)
    })

    // Handle errors
    ws.on('error', (error) => {
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
      await new Promise<void>((resolve) => {
        wss.close(() => {
          console.log('📡 WebSocket server closed')
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
        timestamp: new Date().toISOString()
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
    }
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
```

#### 3.2 Update `packages/consumer/src/mock-detector.ts`

Add AsyncAPI detection:

```typescript
// Add this to the existing file

// Pure function to detect WebSocket upgrade requests
export const isWebSocketUpgrade = (request: UnifiedRequest): boolean => {
  if (!request.headers) return false

  const upgrade = request.headers['upgrade'] || request.headers['Upgrade']
  const connection = request.headers['connection'] || request.headers['Connection']

  return upgrade === 'websocket' ||
         connection?.toLowerCase().includes('upgrade')
}

// Pure function to detect Server-Sent Events requests
export const isSSERequest = (request: UnifiedRequest): boolean => {
  if (!request.headers) return false

  const accept = request.headers['accept'] || request.headers['Accept'] || ''
  return accept.includes('text/event-stream')
}

// Pure function to detect AsyncAPI paths
export const isAsyncAPIPath = (path?: string): boolean => {
  if (!path) return false

  const asyncPaths = ['/ws', '/websocket', '/events', '/stream', '/sse']
  return asyncPaths.some(asyncPath => path.includes(asyncPath))
}

// Update the main detectRequestType function
export const detectRequestType = (request: UnifiedRequest): SpecType | null => {
  // AsyncAPI detection (moved up in priority)
  if (isWebSocketUpgrade(request) || isSSERequest(request) || isAsyncAPIPath(request.path)) {
    return 'asyncapi'
  }

  // GraphQL detection
  if (isGraphQLRequestDetected(request)) {
    return 'graphql'
  }

  // gRPC detection (future)
  if (isGRPCRequest(request)) {
    return 'grpc'
  }

  // Default to OpenAPI for REST
  if (isHTTPRequest(request)) {
    return 'openapi'
  }

  return null
}
```

### Task 4: Update Consumer Package for AsyncAPI (2 hours)

#### 4.1 Update `packages/consumer/src/index.ts`

Add AsyncAPI mock support. Update the `EntenteMock` interface and `createMockServer` function:

```typescript
// Add WebSocket imports at the top
import { createWebSocketMockServer, extractChannelsFromOperations } from './websocket-handler'
import type { WebSocketMockServer } from './websocket-handler'

// Update the EntenteMock interface
export interface EntenteMock {
  url: string
  port: number
  close: () => Promise<void>
  getFixtures: () => Fixture[]
  proposeFixture: (
    operation: string,
    data: { request?: unknown; response: unknown }
  ) => Promise<void>

  // AsyncAPI-specific methods
  websocket?: WebSocketMockServer
  sendEvent?: (channel: string, data: any) => void
  getChannels?: () => string[]
}

// Update createMockServer function to handle AsyncAPI
const createMockServer = async (config: {
  spec: OpenAPISpec | any  // Now accepts any spec type
  fixtures: Fixture[]
  port: number
  validateRequest: boolean
  validateResponse: boolean
}): Promise<MockServer & { websocket?: WebSocketMockServer }> => {
  // Auto-detect spec type and parse
  const parsedSpec = specRegistry.parseSpec(config.spec)
  if (!parsedSpec) {
    throw new Error('Unsupported specification format')
  }

  console.log(`🔍 Detected spec type: ${parsedSpec.type}`)

  // Create unified mock handlers
  const mockHandlers = createUnifiedMockHandler(parsedSpec, config.fixtures)

  // Create the appropriate server based on spec type
  if (parsedSpec.type === 'asyncapi') {
    return await createAsyncAPIMockServer(parsedSpec, mockHandlers, config.port)
  } else {
    return await createUnifiedMockServer(parsedSpec, mockHandlers, config.port)
  }
}

// New function to create AsyncAPI mock server
const createAsyncAPIMockServer = async (
  spec: APISpec,
  mockHandlers: any[],
  port: number
): Promise<MockServer & { websocket?: WebSocketMockServer }> => {
  // Get AsyncAPI handler for operation extraction
  const handler = specRegistry.getHandler('asyncapi')
  if (!handler) {
    throw new Error('AsyncAPI handler not found')
  }

  const operations = handler.extractOperations(spec)
  const channels = extractChannelsFromOperations(operations)

  // Create WebSocket server for real-time communication
  const wsServer = await createWebSocketMockServer(port + 1, operations)

  // Also create HTTP server for REST-like endpoints (SSE, webhooks)
  const httpServer = await createUnifiedMockServer(spec, mockHandlers, port)

  return {
    ...httpServer,
    websocket: wsServer,

    // Override close to close both servers
    close: async () => {
      await Promise.all([
        httpServer.close(),
        wsServer.close()
      ])
    },

    // Override getOperations to include AsyncAPI operations
    getOperations: () => [
      ...httpServer.getOperations(),
      ...operations.map(op => ({
        method: 'WS',
        path: op.channel || '',
        operationId: op.id
      }))
    ]
  }
}

// Update createEntenteMock to handle AsyncAPI features
const createEntenteMock = (mockConfig: {
  service: string
  providerVersion: string
  mockServer: MockServer & { websocket?: WebSocketMockServer }
  recorder?: InteractionRecorder
  fixtures: Fixture[]
  fixtureManager: ReturnType<typeof createFixtureManager>
  hasFixtures: boolean
  config: ClientConfig & { consumer: string; consumerVersion: string }
  skipOperations: boolean
}): EntenteMock => {
  // ... existing code ...

  const result: EntenteMock = {
    url: mockConfig.mockServer.url,
    port: mockConfig.mockServer.port,
    close: async () => {
      // Upload collected fixtures before closing
      await fixtureCollector.uploadCollected()

      await mockConfig.mockServer.close()

      if (mockConfig.recorder) {
        await mockConfig.recorder.flush()
      }
    },
    getFixtures: () => mockConfig.fixtures,
    proposeFixture: async (operation: string, data: { request?: unknown; response: unknown }) => {
      if (mockConfig.skipOperations) {
        console.log(`🚫 Skipping fixture proposal for ${operation} - consumer info unavailable`)
        return
      }

      await mockConfig.fixtureManager.propose({
        service: mockConfig.service,
        serviceVersion: mockConfig.providerVersion,
        operation,
        source: 'consumer',
        data,
        createdFrom: {
          type: 'manual',
          timestamp: new Date(),
          generatedBy: 'manual-proposal',
        },
        notes: 'Manually proposed fixture',
      })
    }
  }

  // Add AsyncAPI-specific features if WebSocket server is available
  if (mockConfig.mockServer.websocket) {
    result.websocket = mockConfig.mockServer.websocket
    result.sendEvent = mockConfig.mockServer.websocket.sendEvent
    result.getChannels = () => extractChannelsFromOperations(
      mockConfig.mockServer.getOperations()
        .filter(op => op.method === 'WS')
        .map(op => ({
          id: op.operationId,
          type: 'event' as const,
          channel: op.path
        }))
    )
  }

  return result
}
```

### Task 5: Update Server API for AsyncAPI Specs (1 hour)

The server API changes from Phase 2 already support AsyncAPI since we use auto-detection. No additional changes needed, but let's add SSE endpoint support:

#### 5.1 Create `apps/server/src/api/routes/events.ts`

```typescript
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { specRegistry } from '@entente/fixtures'
import { specs } from '../../db/schema'
import { eq, and } from 'drizzle-orm'

export const eventsRouter = new Hono()

// Server-Sent Events endpoint for AsyncAPI specs
eventsRouter.get('/stream/:service/:version', async (c) => {
  const service = c.req.param('service')
  const version = c.req.param('version')
  const { tenantId } = c.get('session')

  // Get the AsyncAPI spec for this service
  const db = c.get('db')
  const spec = await db.query.specs.findFirst({
    where: and(
      eq(specs.tenantId, tenantId),
      eq(specs.service, service),
      eq(specs.version, version),
      eq(specs.specType, 'asyncapi')
    )
  })

  if (!spec) {
    return c.json({ error: 'AsyncAPI spec not found' }, 404)
  }

  // Parse the AsyncAPI spec
  const parsedSpec = specRegistry.parseSpec(spec.spec)
  if (!parsedSpec || parsedSpec.type !== 'asyncapi') {
    return c.json({ error: 'Invalid AsyncAPI spec' }, 400)
  }

  // Extract operations and channels
  const handler = specRegistry.getHandler('asyncapi')!
  const operations = handler.extractOperations(parsedSpec)

  return stream(c, async (stream) => {
    // Set SSE headers
    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')
    c.header('Access-Control-Allow-Origin', '*')

    // Send initial connection event
    await stream.write(`event: connected\n`)
    await stream.write(`data: ${JSON.stringify({
      service,
      version,
      channels: operations.map(op => op.channel).filter(Boolean),
      timestamp: new Date().toISOString()
    })}\n\n`)

    // Set up periodic heartbeat
    const heartbeatInterval = setInterval(async () => {
      try {
        await stream.write(`event: heartbeat\n`)
        await stream.write(`data: ${JSON.stringify({
          timestamp: new Date().toISOString()
        })}\n\n`)
      } catch (error) {
        clearInterval(heartbeatInterval)
      }
    }, 30000) // Every 30 seconds

    // Simulate events for demo purposes
    const eventInterval = setInterval(async () => {
      try {
        const randomOperation = operations[Math.floor(Math.random() * operations.length)]
        if (randomOperation) {
          const mockData = handler.generateMockData(randomOperation)

          await stream.write(`event: ${randomOperation.channel}\n`)
          await stream.write(`data: ${JSON.stringify(mockData)}\n\n`)
        }
      } catch (error) {
        clearInterval(eventInterval)
      }
    }, 10000) // Every 10 seconds

    // Handle client disconnect
    c.req.raw.signal?.addEventListener('abort', () => {
      clearInterval(heartbeatInterval)
      clearInterval(eventInterval)
    })
  })
})

// WebSocket upgrade endpoint
eventsRouter.get('/ws/:service/:version', async (c) => {
  const service = c.req.param('service')
  const version = c.req.param('version')

  // Check if this is a WebSocket upgrade request
  const upgrade = c.req.header('upgrade')
  if (upgrade !== 'websocket') {
    return c.json({
      error: 'WebSocket upgrade required',
      wsUrl: `ws://${c.req.header('host')}/api/events/ws/${service}/${version}`
    }, 400)
  }

  // Return WebSocket connection info
  return c.json({
    message: 'WebSocket endpoint available',
    wsUrl: `ws://${c.req.header('host')}/api/events/ws/${service}/${version}`,
    service,
    version
  })
})
```

### Task 6: Write Comprehensive AsyncAPI Tests (2 hours)

#### 6.1 Create `packages/fixtures/test/spec-handlers/asyncapi.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  canHandleAsyncAPI,
  parseAsyncAPISpec,
  extractAsyncAPIOperations,
  matchAsyncAPIRequest,
  generateAsyncAPIResponse,
  validateAsyncAPIResponse,
  createAsyncAPIHandler
} from '../../src/spec-handlers/asyncapi'
import type { Fixture } from '@entente/types'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('AsyncAPI Functional Spec Handler', () => {
  // Load the test AsyncAPI schema
  const sampleAsyncAPISpec = readFileSync(
    resolve(__dirname, '../specs/castles-asyncapi.yaml'),
    'utf-8'
  )

  describe('canHandleAsyncAPI', () => {
    it('should return true for AsyncAPI YAML strings', () => {
      expect(canHandleAsyncAPI(sampleAsyncAPISpec)).toBe(true)
    })

    it('should return true for AsyncAPI objects', () => {
      const asyncApiObject = {
        asyncapi: '2.6.0',
        info: { title: 'Test', version: '1.0.0' },
        channels: {}
      }
      expect(canHandleAsyncAPI(asyncApiObject)).toBe(true)
    })

    it('should return false for non-AsyncAPI specs', () => {
      expect(canHandleAsyncAPI({})).toBe(false)
      expect(canHandleAsyncAPI(null)).toBe(false)
      expect(canHandleAsyncAPI('invalid yaml')).toBe(false)
      expect(canHandleAsyncAPI({ openapi: '3.0.0' })).toBe(false)
    })
  })

  describe('parseAsyncAPISpec', () => {
    it('should parse AsyncAPI YAML strings correctly', () => {
      const result = parseAsyncAPISpec(sampleAsyncAPISpec)

      expect(result.type).toBe('asyncapi')
      expect(result.version).toBe('2.6.0')
      expect(result.spec.asyncapi).toBe('2.6.0')
      expect(result.spec.channels).toBeDefined()
    })

    it('should parse AsyncAPI objects correctly', () => {
      const asyncApiObject = {
        asyncapi: '2.6.0',
        info: { title: 'Test', version: '1.0.0' },
        channels: {
          'test/channel': {
            publish: {
              operationId: 'testPublish',
              message: { payload: { type: 'object' } }
            }
          }
        }
      }

      const result = parseAsyncAPISpec(asyncApiObject)

      expect(result.type).toBe('asyncapi')
      expect(result.spec.channels).toEqual(asyncApiObject.channels)
    })
  })

  describe('extractAsyncAPIOperations', () => {
    it('should extract all operations from AsyncAPI spec', () => {
      const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
      const operations = extractAsyncAPIOperations(apiSpec)

      expect(operations.length).toBeGreaterThan(0)

      // Check for publish operations
      const publishOps = operations.filter(op => op.id.includes('publish'))
      expect(publishOps.length).toBeGreaterThan(0)

      // Check for subscribe operations
      const subscribeOps = operations.filter(op => op.id.includes('subscribe'))
      expect(subscribeOps.length).toBeGreaterThan(0)

      // Check that operations have proper channel references
      const channelOps = operations.filter(op => op.channel)
      expect(channelOps.length).toBe(operations.length)
    })

    it('should handle operations with parameters', () => {
      const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
      const operations = extractAsyncAPIOperations(apiSpec)

      const statusOp = operations.find(op => op.channel === 'castle/status')
      expect(statusOp).toBeDefined()
      expect(statusOp?.id).toBe('subscribeCastleStatus')
    })
  })

  describe('matchAsyncAPIRequest', () => {
    const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
    const operations = extractAsyncAPIOperations(apiSpec)

    it('should match event requests by channel', () => {
      const request = {
        channel: 'castle/created',
        eventType: 'created',
        body: {
          eventId: 'test-event',
          eventType: 'created',
          castle: { id: '123', name: 'Test Castle' }
        }
      }

      const matched = matchAsyncAPIRequest(request, operations)
      expect(matched).toBeDefined()
      expect(matched?.channel).toBe('castle/created')
    })

    it('should match by channel when exact eventType match not found', () => {
      const request = {
        channel: 'castle/deleted',
        eventType: 'removed', // Different from spec, but channel matches
        body: {
          eventId: 'test-event',
          castleId: '123'
        }
      }

      const matched = matchAsyncAPIRequest(request, operations)
      expect(matched).toBeDefined()
      expect(matched?.channel).toBe('castle/deleted')
    })

    it('should return null for non-event requests', () => {
      const request = {
        method: 'GET',
        path: '/api/test'
      }

      const matched = matchAsyncAPIRequest(request, operations)
      expect(matched).toBeNull()
    })
  })

  describe('generateAsyncAPIResponse', () => {
    const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
    const operations = extractAsyncAPIOperations(apiSpec)
    const createdOp = operations.find(op => op.channel === 'castle/created')!

    it('should use fixture data when available', () => {
      const fixture: Fixture = {
        id: 'test-fixture',
        service: 'castle-service',
        serviceVersion: '1.0.0',
        serviceVersions: ['1.0.0'],
        operation: 'publishCastleCreated',
        status: 'approved',
        source: 'manual',
        priority: 1,
        data: {
          response: {
            eventId: 'fixture-event',
            eventType: 'created',
            castle: { id: '1', name: 'Fixture Castle', region: 'Fixture', yearBuilt: 2000 }
          }
        },
        createdFrom: {
          type: 'manual',
          timestamp: new Date()
        },
        createdAt: new Date()
      }

      const response = generateAsyncAPIResponse(createdOp, [fixture])

      expect(response.status).toBe(200)
      expect(response.eventId).toBeDefined()
      expect(response.timestamp).toBeDefined()
      expect(response.body.eventType).toBe('created')
    })

    it('should generate mock data when no fixtures available', () => {
      const response = generateAsyncAPIResponse(createdOp, [])

      expect(response.status).toBe(200)
      expect(response.eventId).toBeDefined()
      expect(response.timestamp).toBeDefined()
      expect(response.body).toBeDefined()
    })
  })

  describe('validateAsyncAPIResponse', () => {
    const apiSpec = parseAsyncAPISpec(sampleAsyncAPISpec)
    const operations = extractAsyncAPIOperations(apiSpec)
    const eventOp = operations.find(op => op.type === 'event')!

    it('should validate successful AsyncAPI event responses', () => {
      const expected = { eventId: 'test', timestamp: '2024-01-01T00:00:00Z' }
      const actual = {
        eventId: 'actual-event',
        timestamp: '2024-01-01T00:00:00Z',
        eventType: 'created',
        data: { test: 'value' }
      }

      const result = validateAsyncAPIResponse(eventOp, expected, actual)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required event fields', () => {
      const expected = { eventId: 'test', timestamp: '2024-01-01T00:00:00Z' }
      const actual = { eventType: 'created' } // missing eventId and timestamp

      const result = validateAsyncAPIResponse(eventOp, expected, actual)
      expect(result.valid).toBe(false)
      expect(result.errors[0].path).toBe('response.eventId')
    })
  })

  describe('createAsyncAPIHandler (functional handler creation)', () => {
    it('should create a working AsyncAPI handler', () => {
      const handler = createAsyncAPIHandler()

      expect(handler.type).toBe('asyncapi')
      expect(handler.name).toBe('AsyncAPI')
      expect(typeof handler.canHandle).toBe('function')
      expect(typeof handler.parseSpec).toBe('function')
      expect(typeof handler.extractOperations).toBe('function')
    })

    it('should work end-to-end with the handler', () => {
      const handler = createAsyncAPIHandler()

      // Test the full flow
      expect(handler.canHandle(sampleAsyncAPISpec)).toBe(true)

      const parsedSpec = handler.parseSpec(sampleAsyncAPISpec)
      expect(parsedSpec.type).toBe('asyncapi')

      const operations = handler.extractOperations(parsedSpec)
      expect(operations.length).toBeGreaterThan(0)

      const request = {
        channel: 'castle/created',
        eventType: 'created',
        body: { eventType: 'created' }
      }
      const matchedOp = handler.matchRequest(request, operations)
      expect(matchedOp?.channel).toBe('castle/created')

      const response = handler.generateResponse(matchedOp!, [])
      expect(response.status).toBe(200)
      expect(response.eventId).toBeDefined()
    })
  })
})
```

#### 6.2 Create `packages/consumer/test/asyncapi-integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '../src'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import WebSocket from 'ws'

describe('AsyncAPI Integration Tests', () => {
  let client: any

  beforeAll(() => {
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
      await mock.close()
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
      await mock.close()
    })

    it('should auto-detect SSE requests', async () => {
      const mock = await client.createMock('test-service', '1.0.0')

      const response = await fetch(`${mock.url}/events`, {
        headers: {
          'Accept': 'text/event-stream'
        }
      })

      expect(response.headers.get('x-detected-type')).toBe('asyncapi')
      await mock.close()
    })
  })
})
```

## Testing Phase 3

### Run the Tests

```bash
# Install AsyncAPI dependencies
pnpm install

# Run type checking
pnpm typecheck

# Run all tests to ensure no regressions
pnpm test

# Run the new AsyncAPI tests specifically
pnpm --filter @entente/fixtures test spec-handlers/asyncapi
pnpm --filter @entente/consumer test asyncapi-integration

# Test the WebSocket server manually
pnpm --filter @entente/server dev
# Use a WebSocket client to connect to the mock server
```

### Manual Testing

1. **Test AsyncAPI Schema Upload**:
   ```bash
   # Upload the AsyncAPI schema using the CLI
   entente upload-spec \
     --service castle-events \
     --version 1.0.0 \
     --environment development \
     --spec packages/fixtures/test/specs/castles-asyncapi.yaml
   ```

2. **Test WebSocket Connection**:
   ```javascript
   const ws = new WebSocket('ws://localhost:8081')

   ws.on('open', () => {
     ws.send(JSON.stringify({
       channel: 'castle/created',
       eventType: 'created',
       castle: { id: '123', name: 'Test Castle' }
     }))
   })

   ws.on('message', (data) => {
     console.log('Response:', JSON.parse(data))
   })
   ```

3. **Test Server-Sent Events**:
   ```bash
   curl -H "Accept: text/event-stream" \
        http://localhost:3000/api/events/stream/castle-events/1.0.0
   ```

## Acceptance Criteria

- [ ] AsyncAPI handler functions pass all tests
- [ ] AsyncAPI schemas can be uploaded and stored with correct spec type
- [ ] WebSocket mock server is created for AsyncAPI specs
- [ ] WebSocket connections and message handling work correctly
- [ ] Server-Sent Events endpoints are functional
- [ ] Event broadcasting to multiple clients works
- [ ] Auto-detection correctly identifies AsyncAPI requests
- [ ] All existing OpenAPI and GraphQL tests continue to pass
- [ ] Cross-spec compatibility is maintained

## Common Issues and Solutions

### Issue: WebSocket connection fails
**Solution**: Ensure the WebSocket server is properly started and that the port is not already in use. Check firewall settings.

### Issue: AsyncAPI YAML parsing errors
**Solution**: Validate the AsyncAPI schema using online tools or CLI validators. Ensure proper YAML syntax.

### Issue: Events not broadcasting
**Solution**: Verify that WebSocket connections are maintained and that the event broadcasting logic is working correctly.

### Issue: SSE not working
**Solution**: Check that proper SSE headers are set and that the response stream is correctly formatted.

---

**Next Phase**: [Phase 4: Testing & Documentation](./phase-4-testing-documentation.md)