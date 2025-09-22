# Request Interceptor Mode

The Entente consumer library now supports a lightweight **Request Interceptor Mode** that patches `fetch` and `http` module requests to observe and record API interactions without creating a mock server.

## Overview

**Interceptor Mode** vs **Mock Server Mode**:

| Feature | Mock Server Mode (`createMock`) | Interceptor Mode (`patchRequests`) |
|---------|--------------------------------|-------------------------------------|
| Creates server | Yes (port required) | No |
| Uses fixtures | Yes | No |
| Mocks responses | Yes | No |
| Calls real API | No | Yes |
| Records interactions | Yes | Yes |
| Matches operations | Yes | Yes |
| Works with supertest | Yes | Yes |
| Works with fetch | Yes | Yes |

## Usage

### Basic Usage

```typescript
import { createClient } from '@entente/consumer'

const entente = await createClient({
  serviceUrl: 'https://entente.company.com',
  consumer: 'web-app',
  consumerVersion: '1.0.0',
  environment: 'test',
  recordingEnabled: true
})

// Using Symbol.dispose (automatic cleanup)
{
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // All HTTP requests are now intercepted and recorded
  await fetch('https://api.example.com/orders/123')
  await axios.get('https://api.example.com/orders')

} // Automatically unpatch and batch send interactions
```

### Manual Cleanup

```typescript
const interceptor = await entente.patchRequests('order-service', '2.1.0')

try {
  // Make API calls
  await fetch('https://api.example.com/orders/123')
} finally {
  // Always clean up
  await interceptor.unpatch()
}
```

### With Testing Frameworks

#### Vitest/Jest with fetch

```typescript
import { test, expect } from 'vitest'

test('should process order', async () => {
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // This calls real API and records interaction
  const response = await fetch('https://api.example.com/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: 'widget', quantity: 5 })
  })

  expect(response.status).toBe(201)

  // Check intercepted calls
  const calls = interceptor.getInterceptedCalls()
  expect(calls).toHaveLength(1)
  expect(calls[0].operation).toBe('createOrder')
})
```

#### Supertest (HTTP Module)

```typescript
import request from 'supertest'
import app from './app.js'

test('should get order', async () => {
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // Supertest uses http module - also intercepted!
  const response = await request(app)
    .get('/orders/123')
    .expect(200)

  const stats = interceptor.getStats()
  expect(stats.http).toBe(1) // HTTP module request intercepted
})
```

#### Axios (HTTP Module)

```typescript
import axios from 'axios'

test('should handle axios requests', async () => {
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // Axios uses http module under the hood
  const response = await axios.get('https://api.example.com/orders/123')

  expect(response.status).toBe(200)

  const calls = interceptor.getInterceptedCalls()
  expect(calls[0].operation).toBe('getOrder')
})
```

## Options

```typescript
interface InterceptOptions {
  // Recording options
  recording?: boolean  // Default: true

  // Optional URL filter
  filter?: (url: string) => boolean
}

// Example with options
const interceptor = await entente.patchRequests('order-service', '2.1.0', {
  recording: true,
  filter: (url) => url.includes('api.example.com')  // Only intercept specific URLs
})
```

## API Reference

### RequestInterceptor

```typescript
interface RequestInterceptor {
  // Control
  unpatch(): Promise<void>
  isPatched(): boolean

  // Inspection
  getInterceptedCalls(): InterceptedCall[]
  getRecordedInteractions(): ClientInteraction[]

  // Statistics
  getStats(): {
    fetch: number    // Number of fetch requests intercepted
    http: number     // Number of http module requests intercepted
    total: number    // Total requests intercepted
  }

  // Automatic cleanup
  [Symbol.dispose](): Promise<void>
}
```

### InterceptedCall

```typescript
interface InterceptedCall {
  request: {
    method: string
    url: string
    headers: Record<string, string>
    body: unknown
  }
  response: {
    status: number
    headers: Record<string, string>
    body: unknown
  }

  // Operation matching (same as mock server)
  operation: string  // e.g., 'getOrder', 'createOrder'
  matchContext: {
    selectedOperationId: string
    candidates: Array<{
      operationId: string
      confidence: number
      reasons: string[]
    }>
  }

  // Metadata
  duration: number
  timestamp: Date
  consumer: string
  consumerVersion: string
  environment: string
}
```

## Operation Matching

The interceptor performs the same operation matching as mock server mode:

- **OpenAPI**: Matches by HTTP method, path patterns, and parameters
- **GraphQL**: Parses queries/mutations to extract operation names
- **AsyncAPI**: Matches by channel and message type (for WebSocket/SSE)

```typescript
{
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // OpenAPI operation matching
  await fetch('https://api.example.com/orders/123')
  // → Matched to operation: 'getOrder'

  // GraphQL operation matching
  await fetch('https://api.example.com/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: 'mutation CreateOrder($input: OrderInput!) { createOrder(input: $input) { id } }'
    })
  })
  // → Matched to operation: 'createOrder'
}
```

## Recording and Batching

Interactions are automatically recorded and batch sent to the Entente service:

- **In CI environments**: Auto-flush every 10 interactions
- **On dispose**: All remaining interactions are sent
- **Deduplication**: Same interaction hashes are filtered out
- **Git context**: Includes commit SHA and build information

## Manual Fixture Download

For developers who want to work with fixtures manually:

```typescript
// Download approved fixtures for a service
const fixtures = await entente.downloadFixtures('order-service', '2.1.0')

// Use fixtures however you want:
// - Save to disk for offline testing
// - Use in custom mock implementations
// - Analyze for test coverage
console.log(`Downloaded ${fixtures.length} fixtures`)

// Save to local file
import { writeFileSync } from 'fs'
writeFileSync('./fixtures/order-service.json', JSON.stringify(fixtures, null, 2))
```

## Use Cases

### Integration Testing
Perfect for testing against real APIs while recording interactions:

```typescript
test('full order workflow', async () => {
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // Real API calls
  const order = await createOrder({ product: 'widget' })
  await updateOrder(order.id, { quantity: 10 })
  await cancelOrder(order.id)

  // All interactions recorded with operation context
  const calls = interceptor.getInterceptedCalls()
  expect(calls.map(c => c.operation)).toEqual([
    'createOrder', 'updateOrder', 'cancelOrder'
  ])
})
```

### Development Recording
Record real usage patterns during development:

```typescript
// In development environment
if (process.env.NODE_ENV === 'development') {
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // Normal application flow
  await app.run()

  // All API interactions automatically recorded
}
```

### Contract Testing
Verify your application works with specific service versions:

```typescript
test('compatible with order-service v2.1.0', async () => {
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // Your application code
  await processOrders()

  // Verify all operations were successfully matched
  const calls = interceptor.getInterceptedCalls()
  const unknownOps = calls.filter(c => c.operation === 'unknown')
  expect(unknownOps).toHaveLength(0)
})
```

## Implementation Details

Under the hood, the interceptor uses `@mswjs/interceptors` to patch:

- **fetch API**: Native fetch and fetch polyfills
- **http module**: `http.request`, `http.get`, `https.request`, `https.get`
- **ClientRequest**: Low-level HTTP client used by most libraries

This means it works with:
- fetch (native and polyfilled)
- axios, got, node-fetch (use http module)
- supertest (uses http module)
- Custom HTTP clients