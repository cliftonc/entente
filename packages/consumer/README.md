# @entente/consumer

Consumer testing library for schema-first contract testing. Supports both mock server creation and lightweight request interception with automatic interaction recording and smart fixture support.

## Installation

```bash
npm install @entente/consumer
```

## Quick Start

```typescript
import { createClient } from '@entente/consumer'

const entente = await createClient({
  serviceUrl: 'https://entente.company.com',
  apiKey: 'your-api-key',
  consumer: 'my-app',
  consumerVersion: '1.0.0',
  environment: 'test'
})

// Create a mock server
const mock = await entente.createMock('order-service', '2.1.0')
console.log(`Mock server running at ${mock.url}`)

// Use in your tests
const response = await fetch(`${mock.url}/orders/123`)
await mock.close()
```

## Two Testing Modes

### Mock Server Mode (OpenAPI/AsyncAPI)

Creates a dedicated mock server for isolated testing with fixture responses. Currently supports OpenAPI REST APIs and AsyncAPI WebSocket services.

```typescript
const mock = await entente.createMock('order-service', '2.1.0', {
  port: 3001,
  useFixtures: true,
  validateRequests: true
})

// Use mock.url in your HTTP client
const orderApi = new OrderApiClient(mock.url)
const orders = await orderApi.getOrders()

// Clean up
await mock.close()
```

### Request Interceptor Mode (All Protocols)

Intercepts real HTTP requests for integration testing with actual APIs. Works with any service type including GraphQL, gRPC, SOAP, and others.

```typescript
{
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // All HTTP requests are now intercepted and recorded
  await fetch('https://api.example.com/orders/123')  // Real API call
  await request(app).get('/orders/123')             // Supertest
  await axios.get('https://api.example.com/orders') // Axios

} // Automatically cleans up and uploads interactions
```

### Which Mode to Choose?

**Use Mock Server Mode when:**
- Testing OpenAPI REST APIs or AsyncAPI WebSocket services
- You want isolated unit tests with fast, deterministic responses
- Testing error scenarios with specific fixture data
- Working offline or with unreliable external services

**Use Request Interceptor Mode when:**
- Testing GraphQL, gRPC, SOAP, or other non-OpenAPI services
- You want integration tests against real APIs
- Testing against live staging/development environments
- Recording real interaction patterns for provider verification

## Fixture Management

The library automatically manages test fixtures through a smart workflow:

1. **First run**: Uses OpenAPI schema for dynamic responses
2. **CI recording**: Captures real responses as fixture proposals
3. **Team approval**: Approved fixtures become deterministic test data
4. **Subsequent runs**: Uses approved fixtures for consistent testing

```typescript
// Propose a custom fixture
await mock.proposeFixture('getOrder', {
  request: { orderId: '123' },
  response: { id: '123', total: 99.99, status: 'completed' }
})

// View fixture statistics
const stats = mock.getStats()
console.log(`Collected ${stats.fixturesCollected} fixtures`)
```

## Automatic Resource Management

Both modes support automatic cleanup using JavaScript's disposal pattern:

```typescript
// Automatic cleanup with 'using'
{
  using mock = await entente.createMock('order-service', '2.1.0')
  // Test your code here
} // Mock automatically closed

// Manual cleanup
const mock = await entente.createMock('order-service', '2.1.0')
try {
  // Test your code here
} finally {
  await mock.close()
}
```

## Multi-Protocol Support

### Request Interceptor Mode (All Protocols)

Interceptors work with any specification format - they record real HTTP traffic regardless of the underlying protocol:

```typescript
// Works with any service type
{
  using interceptor = await entente.patchRequests('graphql-service', '1.0.0')
  // GraphQL queries are intercepted and recorded
  await fetch('/graphql', { method: 'POST', body: graphqlQuery })
}

{
  using interceptor = await entente.patchRequests('grpc-gateway', '2.0.0')
  // gRPC-Web requests are intercepted and recorded
  await grpcClient.getUserProfile({ userId: '123' })
}
```

### Mock Server Mode (OpenAPI + AsyncAPI Only)

Mock servers currently support OpenAPI REST APIs and AsyncAPI WebSocket services:

```typescript
// OpenAPI REST service - full support
const restMock = await entente.createMock('user-service', '1.0.0')

// AsyncAPI WebSocket service - full support
const asyncMock = await entente.createMock('notification-service', '1.5.0')
if (asyncMock.websocket) {
  asyncMock.sendEvent('user/123', { type: 'welcome' })
}

// GraphQL, gRPC, SOAP - use interceptor mode instead
// Mock server mode not yet supported for these protocols
```

## Configuration

### Client Configuration

```typescript
interface ClientConfig {
  serviceUrl: string           // Entente service URL
  apiKey: string              // Authentication key
  consumer?: string           // Consumer name (auto-detected from package.json)
  consumerVersion?: string    // Consumer version (auto-detected)
  environment: string         // Test environment name
  recordingEnabled?: boolean  // Enable interaction recording (default: CI === 'true')
}
```

### Mock Options

```typescript
interface MockOptions {
  port?: number               // Specific port (default: random)
  useFixtures?: boolean       // Use approved fixtures (default: true)
  validateRequests?: boolean  // Validate against schema (default: true)
  validateResponses?: boolean // Validate responses (default: true)
  localFixtures?: Fixture[]   // Fallback fixtures for offline testing
  localMockData?: LocalMockData // Alternative fixture format
}
```

### Interceptor Options

```typescript
interface InterceptOptions {
  recording?: boolean         // Enable recording (default: true)
  filter?: (url: string) => boolean // URL filter function
}
```

## Real-World Example

```typescript
import { createClient } from '@entente/consumer'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('Order Service Integration', () => {
  let entente: any
  let mock: any

  beforeAll(async () => {
    entente = await createClient({
      serviceUrl: process.env.ENTENTE_SERVICE_URL,
      apiKey: process.env.ENTENTE_API_KEY,
      consumer: 'checkout-service',
      consumerVersion: '2.1.0',
      environment: 'test'
    })

    mock = await entente.createMock('order-service', '3.0.0', {
      validateRequests: true,
      validateResponses: true
    })
  })

  afterAll(async () => {
    await mock?.close()
  })

  it('should create orders successfully', async () => {
    const orderData = {
      customerId: 'cust-123',
      items: [{ productId: 'prod-456', quantity: 2 }],
      total: 199.98
    }

    const response = await fetch(`${mock.url}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    })

    expect(response.status).toBe(201)
    const order = await response.json()
    expect(order.id).toBeDefined()
    expect(order.status).toBe('pending')
  })

  it('should handle validation errors', async () => {
    const invalidOrder = { customerId: '', items: [] }

    const response = await fetch(`${mock.url}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidOrder)
    })

    expect(response.status).toBe(400)
  })
})
```

## Environment Variables

Set these in your CI/CD pipeline and local development:

```bash
ENTENTE_SERVICE_URL=https://entente.company.com
ENTENTE_API_KEY=your-api-key
CI=true  # Enables automatic recording in CI environments
```

## API Reference

### Client Methods

- `createMock(service, version, options?)` - Create mock server
- `patchRequests(service, version, options?)` - Create request interceptor
- `uploadSpec(service, version, spec, metadata)` - Upload specification
- `downloadFixtures(service, version)` - Download approved fixtures

### Mock Instance Methods

- `close()` - Stop mock server and upload data
- `getFixtures()` - Get current fixture list
- `proposeFixture(operation, data)` - Propose new fixture
- `getStats()` - Get usage statistics
- `[Symbol.dispose]()` - Automatic cleanup support

### Interceptor Methods

- `unpatch()` - Remove interceptors and upload data
- `isPatched()` - Check if interceptors are active
- `getInterceptedCalls()` - Get recorded calls
- `getStats()` - Get interception statistics
- `[Symbol.dispose]()` - Automatic cleanup support

## Development

```bash
# Install dependencies
pnpm install

# Build package
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## Architecture

Built on functional programming principles with:

- Shared operation matching across modes
- Unified fixture collection and interaction recording
- Consistent error handling and resource management
- Support for multiple specification formats
- Automatic cleanup and resource disposal