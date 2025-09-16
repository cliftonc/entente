---
title: Creating Mock Servers
description: Learn how to create and configure mock servers from provider OpenAPI specifications for realistic consumer testing
---

Mock servers are the foundation of consumer testing in Entente. They're created from provider OpenAPI specifications and can serve both dynamic responses and deterministic fixture-based responses.

## Mock Server Creation

### Basic Mock Server

Create a mock server from a provider's OpenAPI specification:

```typescript
import { createClient } from '@entente/consumer'

const client = createClient({
  serviceUrl: 'https://entente.company.com',
  apiKey: process.env.ENTENTE_API_KEY,
  consumer: 'castle-client',
  environment: 'test'
})

const mock = await client.createMock('castle-service', '0.1.0')

console.log(`Mock server URL: ${mock.url}`) // http://localhost:45623
console.log(`Mock server port: ${mock.port}`) // 45623

// Use in your tests
const response = await fetch(`${mock.url}/castles`)
const castles = await response.json()

// Always close when done
await mock.close()
```

### Advanced Configuration

Configure mock server behavior with detailed options:

```typescript
const mock = await client.createMock('castle-service', '0.1.0', {
  // Use fixtures for deterministic responses
  useFixtures: true,

  // Provide local fixtures for offline development
  localFixtures: loadLocalFixtures(),

  // Validate requests against OpenAPI spec
  validateRequests: true,

  // Validate responses against OpenAPI spec
  validateResponses: true,

  // Use specific port (optional, random port if not specified)
  port: 3001,

  // Git branch for spec lookup (defaults to 'main')
  branch: 'feature/new-api'
})
```

## Mock Server Modes

### Fixture-Based Mode (Deterministic)

When fixtures are available, mock servers return deterministic responses:

```typescript
const mock = await client.createMock('castle-service', '0.1.0', {
  useFixtures: true,
  localFixtures: [
    {
      id: 'fixture_1',
      operation: 'listCastles',
      data: {
        request: {
          method: 'GET',
          path: '/castles'
        },
        response: {
          status: 200,
          body: [
            { id: '1', name: 'Versailles', region: 'Île-de-France' },
            { id: '2', name: 'Fontainebleau', region: 'Île-de-France' }
          ]
        }
      }
    }
  ]
})

// Always returns the same castles from fixtures
const castles = await fetch(`${mock.url}/castles`).then(r => r.json())
console.log(castles.length) // Always 2
```

### Dynamic Mode (Schema-Based)

Without fixtures, mock servers generate responses based on OpenAPI schemas:

```typescript
const mock = await client.createMock('castle-service', '0.1.0', {
  useFixtures: false
})

// Returns randomly generated data matching the schema
const castles = await fetch(`${mock.url}/castles`).then(r => r.json())
console.log(castles) // Different data each time, but matches schema
```

## Request/Response Validation

### Request Validation

Enable request validation to catch client-side errors:

```typescript
const mock = await client.createMock('castle-service', '0.1.0', {
  validateRequests: true
})

// This will fail validation and return 400:
await fetch(`${mock.url}/castles`, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' }, // ❌ Spec requires application/json
  body: 'invalid json'
})
```

**Common Request Validation Errors:**
- Wrong content type
- Missing required headers
- Invalid request body structure
- Missing required fields
- Invalid field types

### Response Validation

Enable response validation to catch provider spec issues:

```typescript
const mock = await client.createMock('castle-service', '0.1.0', {
  validateResponses: true
})

// If fixtures or generated responses don't match the spec,
// the mock server will return a validation error
```

**Common Response Validation Errors:**
- Fixture responses don't match OpenAPI schema
- Generated examples in spec are invalid
- Missing required response fields
- Wrong response content types

## Fixture Management

### Local Fixtures

Provide fixtures for offline development and deterministic testing:

```typescript
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const loadLocalFixtures = () => {
  try {
    const fixturesPath = join(process.cwd(), 'fixtures', 'castle-service.json')
    return JSON.parse(readFileSync(fixturesPath, 'utf-8'))
  } catch (error) {
    console.warn('No local fixtures found, using server fixtures')
    return []
  }
}

const mock = await client.createMock('castle-service', '0.1.0', {
  useFixtures: true,
  localFixtures: loadLocalFixtures()
})
```

### Fixture Priority

When both local and server fixtures are available, Entente prioritizes them:

1. **Local fixtures** - Highest priority, used for specific test scenarios
2. **Approved server fixtures** - Provider-verified responses
3. **Draft server fixtures** - Pending approval, used as fallback
4. **Dynamic responses** - Generated from OpenAPI schema

```typescript
const mock = await client.createMock('castle-service', '0.1.0', {
  useFixtures: true,
  localFixtures: localFixtures, // Priority 1
  // Server fixtures automatically loaded:
  // - Approved fixtures (Priority 2)
  // - Draft fixtures (Priority 3)
  // - Dynamic generation (Priority 4)
})
```

### Fixture Matching

Fixtures are matched based on:

1. **HTTP Method** - Must match exactly (GET, POST, etc.)
2. **Path Pattern** - Exact match or parameterized match
3. **Request Body** - For POST/PUT requests (if specified in fixture)

```typescript
// Fixture for GET /castles/{id}
{
  "data": {
    "request": {
      "method": "GET",
      "path": "/castles/550e8400-e29b-41d4-a716-446655440000"
    },
    "response": {
      "status": 200,
      "body": { "id": "550e8400-e29b-41d4-a716-446655440000", "name": "Versailles" }
    }
  }
}

// Matches these requests:
// GET /castles/550e8400-e29b-41d4-a716-446655440000 ✅
// GET /castles/abc123 ✅ (parameter matching)
// GET /castles ❌ (different path)
// POST /castles/550e8400-e29b-41d4-a716-446655440000 ❌ (different method)
```

## Error Simulation

### Fixture-Based Errors

Include error responses in fixtures for comprehensive testing:

```typescript
const errorFixtures = [
  {
    id: 'castle_not_found',
    operation: 'getCastle',
    data: {
      request: {
        method: 'GET',
        path: '/castles/nonexistent'
      },
      response: {
        status: 404,
        headers: { 'content-type': 'application/json' },
        body: {
          error: 'not_found',
          message: 'Castle not found'
        }
      }
    }
  },
  {
    id: 'validation_error',
    operation: 'createCastle',
    data: {
      request: {
        method: 'POST',
        path: '/castles',
        body: { name: '', region: 'Test', yearBuilt: 999 }
      },
      response: {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: {
          error: 'validation_error',
          message: 'Name cannot be empty and year must be >= 1000'
        }
      }
    }
  }
]

const mock = await client.createMock('castle-service', '0.1.0', {
  useFixtures: true,
  localFixtures: errorFixtures
})

// Test error handling
await expect(
  fetch(`${mock.url}/castles/nonexistent`)
).rejects.toThrow('Castle not found')
```

### Dynamic Error Responses

Without specific error fixtures, mock servers return errors defined in the OpenAPI spec:

```json
{
  "paths": {
    "/castles/{id}": {
      "get": {
        "responses": {
          "200": { "description": "Castle found" },
          "404": {
            "description": "Castle not found",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Error" },
                "example": {
                  "error": "not_found",
                  "message": "Castle not found"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Mock Server Lifecycle

### Setup and Teardown

Properly manage mock server lifecycle in tests:

```typescript
describe('Castle API Tests', () => {
  let client: ReturnType<typeof createClient>
  let mock: Awaited<ReturnType<typeof client.createMock>>
  let castleApi: CastleApiClient

  beforeAll(async () => {
    client = createClient({
      serviceUrl: process.env.ENTENTE_SERVICE_URL,
      apiKey: process.env.ENTENTE_API_KEY,
      consumer: 'castle-client',
      environment: 'test'
    })

    mock = await client.createMock('castle-service', '0.1.0', {
      useFixtures: true,
      localFixtures: loadLocalFixtures()
    })

    castleApi = new CastleApiClient(mock.url)
  })

  afterAll(async () => {
    if (mock) {
      await mock.close() // Important: uploads recorded interactions
    }
  })

  // Your tests here...
})
```

### Per-Test Mock Servers

For isolation, create separate mock servers per test:

```typescript
describe('Castle API Tests', () => {
  let client: ReturnType<typeof createClient>

  beforeAll(async () => {
    client = createClient({
      serviceUrl: process.env.ENTENTE_SERVICE_URL,
      apiKey: process.env.ENTENTE_API_KEY,
      consumer: 'castle-client',
      environment: 'test'
    })
  })

  it('should list castles', async () => {
    const mock = await client.createMock('castle-service', '0.1.0', {
      useFixtures: true,
      localFixtures: listCastlesFixtures
    })

    try {
      const castleApi = new CastleApiClient(mock.url)
      const castles = await castleApi.getAllCastles()
      expect(castles).toHaveLength(2)
    } finally {
      await mock.close()
    }
  })

  it('should create castle', async () => {
    const mock = await client.createMock('castle-service', '0.1.0', {
      useFixtures: true,
      localFixtures: createCastleFixtures
    })

    try {
      const castleApi = new CastleApiClient(mock.url)
      const castle = await castleApi.createCastle({
        name: 'Test Castle',
        region: 'Test Region',
        yearBuilt: 1500
      })
      expect(castle).toHaveProperty('id')
    } finally {
      await mock.close()
    }
  })
})
```

## Provider Version Management

### Version Selection

Specify which provider version to mock:

```typescript
// Use specific version
const mock = await client.createMock('castle-service', '0.1.0')

// Use latest version (may change over time)
const mock = await client.createMock('castle-service', 'latest')

// Use version from specific branch
const mock = await client.createMock('castle-service', '0.1.0', {
  branch: 'feature/new-endpoints'
})
```

### Version Compatibility

Entente handles version compatibility automatically:

```typescript
// Request: castle-service v0.1.0
const mock = await client.createMock('castle-service', '0.1.0')

// If v0.1.0 not deployed, Entente may use v0.1.2 and log:
// "📋 Using latest provider version: 0.1.2 for castle-service"
// "ℹ️ Using spec for castle-service@0.1.2 (not currently deployed in test)"
```

## Debugging Mock Servers

### Logging and Debugging

Enable detailed logging to debug mock server behavior:

```typescript
const mock = await client.createMock('castle-service', '0.1.0', {
  useFixtures: true,
  localFixtures: fixtures
})

// Monitor requests and responses
mock.onRequest((request, response) => {
  console.log(`📥 ${request.method} ${request.path}`)
  console.log(`📤 ${response.status} (${response.duration}ms)`)
})
```

### Fixture Inspection

Check which fixtures are loaded:

```typescript
const mock = await client.createMock('castle-service', '0.1.0', {
  useFixtures: true,
  localFixtures: fixtures
})

const loadedFixtures = mock.getFixtures()
console.log(`Loaded ${loadedFixtures.length} fixtures:`)
loadedFixtures.forEach(fixture => {
  console.log(`- ${fixture.operation}: ${fixture.status}`)
})
```

### Network Inspection

Use browser dev tools or network debugging tools to inspect requests:

```typescript
// Mock server runs on localhost, visible in browser dev tools
const mock = await client.createMock('castle-service', '0.1.0')
console.log(`Debug at: ${mock.url}`)

// You can also make requests directly:
const response = await fetch(`${mock.url}/castles`)
console.log('Response headers:', Object.fromEntries(response.headers))
```

## Performance Considerations

### Mock Server Startup Time

Mock servers using Prism have some startup overhead:

```typescript
// Faster: Reuse mock server across tests
let globalMock: EntenteMock

beforeAll(async () => {
  globalMock = await client.createMock('castle-service', '0.1.0', {
    useFixtures: true,
    localFixtures: allFixtures
  })
})

// Slower: Create new mock server per test
beforeEach(async () => {
  const mock = await client.createMock('castle-service', '0.1.0')
  // ...
})
```

### Fixture Loading

Local fixtures load faster than server fixtures:

```typescript
// Faster: Local fixtures
const mock = await client.createMock('castle-service', '0.1.0', {
  useFixtures: true,
  localFixtures: require('./fixtures/castle-service.json')
})

// Slower: Server fixtures (requires API call)
const mock = await client.createMock('castle-service', '0.1.0', {
  useFixtures: true
  // No localFixtures - will fetch from server
})
```

## Next Steps

- **[Managing Fixtures](/consumers/fixtures/)** - Learn fixture management and approval workflows
- **[Recording Interactions](/consumers/recording/)** - Understand how interactions are captured
- **[GitHub Actions](/consumers/github-actions/)** - Integrate consumer testing into CI/CD

Mock servers provide the foundation for reliable consumer testing. Use fixtures for deterministic tests and enable recording in CI to capture real usage patterns that providers can verify against.