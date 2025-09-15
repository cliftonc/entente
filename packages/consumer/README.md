# @entente/consumer

Consumer testing library for Entente contract testing. This package implements the client-side functionality from the ContractFlow specification, enabling schema-first contract testing with automatic interaction recording and smart fixture support.

## Overview

The client library allows consumer applications to create mock servers from OpenAPI specifications, automatically record real interactions in CI environments, and use approved fixtures for deterministic testing. It follows ContractFlow's principle of "CI-Only Recording" where local tests run fast and CI builds contribute real data.

## Core Features

### OpenAPI-First Mock Creation
```typescript
import { createClient } from '@entente/consumer'
import type { Fixture } from '@entente/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const entente = createClient({
  serviceUrl: process.env.ENTENTE_SERVICE_URL || '',
  apiKey: process.env.ENTENTE_API_KEY || '',
  consumer: 'castle-client',
  environment: 'test', // Test context (not deployment environment)
  recordingEnabled: process.env.CI === 'true', // Only record in CI
})

// Load local fixtures for fallback
const fixturesPath = join(process.cwd(), 'fixtures', 'castle-service.json')
const localFixtures: Fixture[] = JSON.parse(readFileSync(fixturesPath, 'utf-8'))

// Create mock from centrally managed OpenAPI spec
const mock = await entente.createMock('castle-service', '0.1.0', {
  useFixtures: true,
  validateRequests: true,
  validateResponses: true,
  localFixtures, // Fallback fixtures when service is unavailable
})

// Use the mock URL in your API client
const castleApi = new CastleApiClient(mock.url)
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

### Real Consumer Test from Castle Client
```typescript
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@entente/consumer'
import type { Fixture } from '@entente/types'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CastleApiClient } from '../src/castle-api.js'

// Load environment variables from .env file
dotenv.config()

describe('Castle Client Consumer Contract Tests', () => {
  let client: ReturnType<typeof createClient>
  let mock: Awaited<ReturnType<typeof client.createMock>>
  let castleApi: CastleApiClient

  beforeAll(async () => {
    // Load local fixtures
    const fixturesPath = join(process.cwd(), 'fixtures', 'castle-service.json')
    const localFixtures: Fixture[] = JSON.parse(readFileSync(fixturesPath, 'utf-8'))

    client = createClient({
      serviceUrl: process.env.ENTENTE_SERVICE_URL || '',
      apiKey: process.env.ENTENTE_API_KEY || '',
      consumer: 'castle-client',
      environment: 'test', // Test context (not deployment environment)
      recordingEnabled: process.env.CI === 'true',
    })

    mock = await client.createMock('castle-service', '0.1.0', {
      useFixtures: true,
      validateRequests: true,
      validateResponses: true,
      localFixtures,
    })

    castleApi = new CastleApiClient(mock.url)
  })

  afterAll(async () => {
    if (mock) {
      await mock.close()
    }
  })

  it('should get all castles from the service', async () => {
    const castles = await castleApi.getAllCastles()

    expect(Array.isArray(castles)).toBe(true)
    expect(castles.length).toBeGreaterThan(0)

    const castle = castles[0]
    expect(castle).toHaveProperty('id')
    expect(castle).toHaveProperty('name')
    expect(castle).toHaveProperty('region')
    expect(castle).toHaveProperty('yearBuilt')

    expect(typeof castle.id).toBe('string')
    expect(typeof castle.name).toBe('string')
    expect(typeof castle.region).toBe('string')
    expect(typeof castle.yearBuilt).toBe('number')
  })

  it('should create a new castle', async () => {
    const newCastleData = {
      name: 'Château de Test',
      region: 'Test Region',
      yearBuilt: 1500,
    }

    const createdCastle = await castleApi.createCastle(newCastleData)

    expect(createdCastle).toHaveProperty('id')
    expect(createdCastle.name).toBe(newCastleData.name)
    expect(createdCastle.region).toBe(newCastleData.region)
    expect(createdCastle.yearBuilt).toBe(newCastleData.yearBuilt)
  })

  it('should handle validation errors for castle creation', async () => {
    const invalidCastleData = {
      name: '',
      region: 'Test Region',
      yearBuilt: 999,
    }

    await expect(castleApi.createCastle(invalidCastleData)).rejects.toThrow()
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
- `ENTENTE_SERVICE_URL` - URL of your Entente service
- `ENTENTE_API_KEY` - API key for authentication
- `CI` - Enables interaction recording when 'true'
- `ENVIRONMENT` - Target environment (test, staging, production)

### Mock Options
```typescript
interface MockOptions {
  useFixtures?: boolean       // Use approved fixtures when available (default: true)
  validateRequests?: boolean  // Validate requests against OpenAPI (default: true)
  validateResponses?: boolean // Validate responses against OpenAPI (default: true)
  localFixtures?: Fixture[]   // Local fallback fixtures
  port?: number              // Specific port (default: random)
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