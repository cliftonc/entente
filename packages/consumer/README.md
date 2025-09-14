# @entente/consumer

Consumer testing library for Entente contract testing. This package implements the client-side functionality from the ContractFlow specification, enabling schema-first contract testing with automatic interaction recording and smart fixture support.

## Overview

The client library allows consumer applications to create mock servers from OpenAPI specifications, automatically record real interactions in CI environments, and use approved fixtures for deterministic testing. It follows ContractFlow's principle of "CI-Only Recording" where local tests run fast and CI builds contribute real data.

## Core Features

### OpenAPI-First Mock Creation
```typescript
import { createClient } from '@entente/consumer'

const entente = createClient({
  serviceUrl: 'https://entente.company.com',
  consumer: 'web-app',
  consumerVersion: '1.0.0',
  environment: 'test',
  recordingEnabled: process.env.CI === 'true' // Only record in CI
})

// Create mock from centrally managed OpenAPI spec
const mock = await entente.createMock('order-service', '2.1.0', {
  validateRequests: true,
  validateResponses: true,
  useFixtures: true // Default: use approved fixtures when available
})
```

### Smart Fixture Support

The client implements ContractFlow's smart fixture system:

1. **First Run**: No fixtures exist → Uses OpenAPI schema for dynamic mocking
2. **CI Recording**: Captures responses → Proposes fixtures automatically
3. **Fixture Approval**: Team approves fixtures → Deterministic mocking
4. **Subsequent Runs**: Uses approved fixtures → Consistent test behavior

### Automatic Interaction Recording

When `recordingEnabled: true` (CI environments):
- All mock interactions are captured
- Sent to central service for provider verification
- Includes request/response data, timing, and metadata
- Zero developer intervention required

## Implementation Status

### ✅ Complete
- Functional API structure (`createClient`, `createMock`)
- Integration with `@entente/fixtures` package
- Interaction recording infrastructure
- Configuration and typing
- Mock server lifecycle management

### 🔄 In Progress
- Mock response fixtures integration (simplified implementation)

### ❌ TODO - High Priority
1. **Real Prism Integration**: Replace simplified mock with actual `@stoplight/prism-cli`
2. **Fixture Injection**: Implement `injectFixturesIntoSpec()` to add fixtures as OpenAPI examples
3. **Operation Derivation**: Implement `deriveOperation()` to map requests to OpenAPI operations
4. **Request/Response Validation**: Add OpenAPI validation for requests and responses
5. **WebSocket Support**: Real-time updates for fixture approvals

### ❌ TODO - Lower Priority
- Enhanced error handling and logging
- Retry mechanisms for central service communication
- Metrics and analytics collection
- Support for multiple OpenAPI versions
- Custom mock server configurations

## Usage Examples

### Basic Consumer Test
```typescript
describe('Order Service Client Tests', () => {
  let entente: ReturnType<typeof createClient>
  let orderMock: Awaited<ReturnType<typeof entente.createMock>>

  beforeAll(async () => {
    entente = createClient({
      serviceUrl: 'https://entente.company.com',
      consumer: 'order-web',
      consumerVersion: process.env.CONSUMER_VERSION || '1.0.0',
      environment: process.env.ENVIRONMENT || 'test',
      recordingEnabled: process.env.CI === 'true'
    })

    orderMock = await entente.createMock('order-service', '2.1.0')
  })

  afterAll(async () => {
    await orderMock.close()
  })

  it('should get order successfully', async () => {
    const orderClient = new OrderClient({ baseUrl: orderMock.url })
    
    // This interaction is automatically recorded in CI
    const order = await orderClient.getOrder('ord-123')
    
    expect(order).toMatchObject({
      id: 'ord-123',
      status: expect.any(String)
    })
  })
})
```

### Self-Bootstrapping Workflow

**First Run (No Fixtures)**:
```typescript
// Mock server uses OpenAPI schema for dynamic response generation
// In CI: Responses are captured and proposed as fixtures
console.log('🚀 No fixtures found - using schema-based mocking')
```

**After Fixture Approval**:
```typescript
// Mock server uses approved fixtures for deterministic responses
console.log('📋 Using approved fixtures for deterministic mocking')
```

## Configuration

### Environment Variables
- `CI` - Enables interaction recording when 'true'
- `CONSUMER_VERSION` - Version of the consumer service
- `ENVIRONMENT` - Target environment (test, staging, production)
- `BUILD_ID` - Build identifier for fixture tracking

### Mock Options
```typescript
interface MockOptions {
  branch?: string              // Git branch for spec (default: 'main')
  port?: number               // Specific port (default: random)
  validateRequests?: boolean  // Validate requests against OpenAPI (default: true)
  validateResponses?: boolean // Validate responses against OpenAPI (default: true)  
  useFixtures?: boolean      // Use approved fixtures when available (default: true)
}
```

## ContractFlow Specification Alignment

This package implements ContractFlow's core principles:

- **Schema-First Always**: Specs fetched from central service, code follows
- **Centralized Contract Management**: All specs managed centrally
- **Automatic Recording**: Transparent capture during CI testing  
- **CI-Only Recording**: Local tests fast, CI builds contribute real data
- **Provider Verification**: Recorded interactions drive provider testing

## Development

```bash
# Build package
pnpm build

# Watch for changes during development
pnpm dev

# Run tests
pnpm test
```

## Dependencies

- `@entente/types` - Shared type definitions
- `@entente/fixtures` - Fixture management utilities
- `@stoplight/prism-cli` - OpenAPI mock server (peer dependency)

The package uses functional programming patterns and avoids classes, following the project's architectural principles.