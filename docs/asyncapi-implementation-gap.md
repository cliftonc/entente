# AsyncAPI Implementation Gap Analysis

## Overview

Entente currently has comprehensive OpenAPI support but lacks full AsyncAPI implementation. This document outlines the current state, failing tests, and required work to complete AsyncAPI support for event-driven API contract testing.

## Current State

### ✅ What's Working
- AsyncAPI spec file parsing and upload via `uploadSpec()`
- Basic test infrastructure with AsyncAPI schema files
- Mock setup with fetch interception for AsyncAPI workflows
- Schema validation for AsyncAPI 2.6.0 format

### ❌ What's Missing
- WebSocket mock server implementation
- Server-Sent Events (SSE) support
- Real-time event broadcasting
- AsyncAPI-specific mock response generation
- Channel-based event routing
- Event subscription/publication mechanisms

## Failing Tests Analysis

### File: `packages/consumer/test/asyncapi-integration.test.ts`

#### 1. WebSocket Server Creation
```typescript
// FAILING: mock.websocket is undefined
it('should create WebSocket server for AsyncAPI specs', () => {
  expect(mock.websocket).toBeDefined()
  expect(mock.websocket.url).toMatch(/^ws:\/\/localhost:\d+$/)
  expect(typeof mock.sendEvent).toBe('function')
  expect(typeof mock.getChannels).toBe('function')
})
```
**Root Cause**: `createMock()` doesn't detect AsyncAPI specs and doesn't create WebSocket server instances.

#### 2. WebSocket Connection Handling
```typescript
// FAILING: mock.websocket.url is undefined
it('should handle WebSocket connections and messages', async () => {
  const wsUrl = mock.websocket.url
  const ws = new WebSocket(wsUrl)
  // ... connection logic
})
```
**Root Cause**: No WebSocket server implementation in mock creation pipeline.

#### 3. Server-Sent Events (SSE)
```typescript
// FAILING: Missing content-type header
expect(response.headers.get('content-type')).toBe('text/event-stream')
expect(response.headers.get('x-detected-type')).toBe('asyncapi')
```
**Root Cause**: Mock fetch responses don't include proper SSE headers.

#### 4. Event Broadcasting
```typescript
// FAILING: No WebSocket server to connect to
const wsUrl = mock.websocket.url
const ws = new WebSocket(wsUrl)
// ... broadcasting tests
```
**Root Cause**: No real-time event infrastructure.

#### 5. Channel Enumeration
```typescript
// FAILING: mock.getChannels is not a function
const channels = mock.getChannels()
expect(channels).toContain('castle/created')
```
**Root Cause**: Missing AsyncAPI schema parsing to extract channels.

## Implementation Requirements

### Phase 1: Core AsyncAPI Detection and Parsing

#### 1.1 Spec Type Detection Enhancement
**File**: `packages/consumer/src/index.ts`
**Current**: Only detects OpenAPI specs
**Required**:
```typescript
interface SpecMetadata {
  specType: 'openapi' | 'asyncapi' | 'graphql'
  // ... existing fields
}

function detectSpecType(spec: string): 'openapi' | 'asyncapi' | 'graphql' {
  // Add asyncapi detection logic
  if (spec.includes('asyncapi:')) return 'asyncapi'
  // ... existing logic
}
```

#### 1.2 AsyncAPI Schema Parsing
**New File**: `packages/consumer/src/asyncapi-parser.ts`
**Purpose**: Extract channels, operations, and message schemas from AsyncAPI specs
```typescript
interface AsyncAPIChannel {
  name: string
  description?: string
  subscribe?: AsyncAPIOperation
  publish?: AsyncAPIOperation
}

interface AsyncAPIOperation {
  operationId: string
  summary?: string
  message: AsyncAPIMessage
}

function parseAsyncAPISpec(spec: any): {
  channels: AsyncAPIChannel[]
  servers: Record<string, any>
  components: any
}
```

### Phase 2: WebSocket Mock Server Implementation

#### 2.1 WebSocket Server Factory
**New File**: `packages/consumer/src/websocket-server.ts`
**Purpose**: Create and manage WebSocket mock servers
```typescript
interface WebSocketMockServer {
  url: string
  port: number
  sendEvent(channel: string, data: any): void
  close(): Promise<void>
  getConnectedClients(): number
}

function createWebSocketMockServer(
  channels: AsyncAPIChannel[],
  port?: number
): Promise<WebSocketMockServer>
```

#### 2.2 Event Broadcasting System
**Purpose**: Handle real-time event distribution to connected clients
```typescript
interface EventBroadcaster {
  broadcast(channel: string, event: any): void
  subscribe(channel: string, clientId: string): void
  unsubscribe(channel: string, clientId: string): void
}
```

### Phase 3: SSE Support Implementation

#### 3.1 SSE Endpoint Creation
**Purpose**: Create Server-Sent Events endpoints for AsyncAPI channels
```typescript
interface SSEEndpoint {
  path: string
  contentType: 'text/event-stream'
  channel: string
}

function createSSEEndpoints(channels: AsyncAPIChannel[]): SSEEndpoint[]
```

#### 3.2 HTTP Mock Server Enhancement
**File**: `packages/consumer/src/index.ts`
**Purpose**: Add SSE response handling to existing HTTP mock server
```typescript
// Add to mock response handler
if (request.headers['accept'] === 'text/event-stream') {
  return createSSEResponse(channel, eventData)
}
```

### Phase 4: Mock Integration Updates

#### 4.1 EntenteMock Interface Extension
**File**: `packages/consumer/src/index.ts`
```typescript
interface EntenteMock {
  url: string
  port: number
  close(): Promise<void>

  // NEW: AsyncAPI-specific properties
  websocket?: WebSocketMockServer
  sendEvent?(channel: string, data: any): void
  getChannels?(): string[]

  // Existing methods...
  getFixtures(): any[]
  proposeFixture(data: any): Promise<any>
}
```

#### 4.2 createMock Function Enhancement
**File**: `packages/consumer/src/index.ts`
```typescript
async function createMock(service: string, version: string, options?: MockOptions): Promise<EntenteMock> {
  const specData = await fetchSpec(/* ... */)

  if (specData.metadata.specType === 'asyncapi') {
    const channels = parseAsyncAPISpec(specData.spec)
    const websocketServer = await createWebSocketMockServer(channels, options?.port)
    const sseEndpoints = createSSEEndpoints(channels)

    return {
      // ... existing properties
      websocket: websocketServer,
      sendEvent: (channel, data) => websocketServer.sendEvent(channel, data),
      getChannels: () => channels.map(c => c.name)
    }
  }

  // Existing OpenAPI logic...
}
```

### Phase 5: Testing Infrastructure

#### 5.1 AsyncAPI Test Fixtures
**Purpose**: Create realistic AsyncAPI message examples
**Files**:
- `packages/fixtures/test/specs/castles-asyncapi.yaml` ✅ (exists)
- `packages/fixtures/test/asyncapi-messages/` (new directory)

#### 5.2 WebSocket Testing Utilities
**New File**: `packages/consumer/test/utils/websocket-test-helpers.ts`
```typescript
async function connectToWebSocket(url: string): Promise<WebSocket>
function waitForWebSocketMessage(ws: WebSocket, timeout?: number): Promise<any>
function sendWebSocketMessage(ws: WebSocket, channel: string, data: any): void
```

## Implementation Plan

### Sprint 1: Foundation (1-2 weeks)
1. ✅ Fix existing test mocking issues
2. Implement AsyncAPI spec detection in `detectSpecType()`
3. Create `asyncapi-parser.ts` with basic channel extraction
4. Update `EntenteMock` interface with AsyncAPI properties

### Sprint 2: WebSocket Core (2-3 weeks)
1. Implement `WebSocketMockServer` class
2. Add WebSocket server creation to `createMock()`
3. Basic event broadcasting system
4. WebSocket connection and message tests passing

### Sprint 3: SSE and Advanced Features (1-2 weeks)
1. Server-Sent Events endpoint creation
2. HTTP mock server SSE response handling
3. Channel enumeration (`getChannels()`)
4. Event subscription/unsubscription logic

### Sprint 4: Polish and Integration (1 week)
1. Error handling and edge cases
2. Performance optimization
3. Documentation updates
4. End-to-end integration tests

## Dependencies

### External Libraries
- `ws` - WebSocket server implementation (already in package.json)
- Consider `@asyncapi/parser` for robust AsyncAPI spec parsing

### Internal Dependencies
- `@entente/types` - Add AsyncAPI type definitions
- `@entente/fixtures` - AsyncAPI fixture support

## Test Coverage Goals

- ✅ AsyncAPI spec upload and validation
- ✅ WebSocket mock server creation
- ✅ Real-time event broadcasting
- ✅ SSE endpoint functionality
- ✅ Channel enumeration
- ✅ Multi-client WebSocket connections
- ✅ Error handling for malformed messages

## Success Criteria

1. All tests in `asyncapi-integration.test.ts` pass
2. AsyncAPI specs create functional WebSocket mock servers
3. Real-time events can be sent and received
4. SSE endpoints work correctly
5. Performance meets requirements (WebSocket handling, concurrent connections)
6. Full feature parity with OpenAPI mock functionality

## Notes

- Current implementation is OpenAPI-focused; AsyncAPI requires different mock strategy
- WebSocket servers need different lifecycle management than HTTP servers
- Real-time event broadcasting adds complexity to mock server architecture
- Consider AsyncAPI 3.0 future compatibility
- Event-driven testing paradigm differs from request/response testing

---

**Status**: Implementation required - all AsyncAPI functionality currently missing
**Priority**: High - required for complete event-driven API contract testing
**Effort Estimate**: 6-8 weeks for full implementation