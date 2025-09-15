# @entente/provider

Provider verification library for Entente contract testing. This package implements the provider-side functionality, enabling providers to verify their implementations against real recorded consumer interactions.

## Overview

The provider library allows service providers to verify their implementations against real consumer usage patterns recorded by the central Entente service. It supports state handler-based setup and response structure validation.

## Core Features

### Real Interaction Verification
```typescript
import { createProvider } from '@entente/provider'
import { serve } from '@hono/node-server'
import { resetCastles } from '../src/db.js'
import app from '../src/index.js'

const provider = createProvider({
  serviceUrl: process.env.ENTENTE_SERVICE_URL,
  apiKey: process.env.ENTENTE_API_KEY,
  provider: 'castle-service',
})

const results = await provider.verify({
  baseUrl: `http://localhost:4001`,
  environment: 'test', // Verification context (where verification runs)
  stateHandlers: {
    listCastles: async () => {
      console.log('🔄 Resetting castles to default state')
      resetCastles()
    },
    getCastle: async () => {
      console.log('🔄 Resetting castles to default state')
      resetCastles()
    },
    createCastle: async () => {
      console.log('🔄 Resetting castles to default state')
      resetCastles()
    },
    deleteCastle: async () => {
      console.log('🔄 Resetting castles to default state')
      resetCastles()
    },
  },
  cleanup: async () => {
    resetCastles()
  },
})

console.log(`📋 Total interactions tested: ${results.results.length}`)

const failedResults = results.results.filter(r => !r.success)
if (failedResults.length > 0) {
  console.log('❌ Failed verifications:')
  for (const result of failedResults) {
    console.log(`  - ${result.interactionId}: ${result.error}`)
  }
}

// All verifications should pass
expect(failedResults.length).toBe(0)
```

### State Management

The provider uses state handlers for test data setup:

1. **State Handlers**: Custom setup functions for each operation
2. **Cleanup Support**: Automatic cleanup after each verification
3. **Environment Isolation**: Separate state management per environment

### Response Structure Validation

Validates that provider responses match the structure of recorded consumer interactions:
- Status code matching
- JSON structure validation (not exact values)
- Allows extra fields in actual responses
- Type checking for all expected fields

## Implementation Status

### ✅ Complete
- Core verification workflow against recorded interactions
- Response structure validation with deep JSON comparison
- State handler system for test data setup
- Functional API design

### 🔄 In Progress
- Enhanced verification reporting

### ❌ TODO - High Priority
1. **Real Database State Setup**: Example implementations for common databases
2. **Parallel Verification**: Run multiple verifications concurrently
3. **Enhanced Error Reporting**: Detailed failure analysis and debugging info
4. **State Conflict Resolution**: Handle overlapping state setup requirements

### ❌ TODO - Lower Priority
- Verification result caching
- Advanced state setup patterns
- Integration with popular ORMs/databases
- Verification performance optimization
- Historical verification tracking

## Usage Examples

### Real Provider Verification from Castle Service
```typescript
import { createProvider } from '@entente/provider'
import { serve } from '@hono/node-server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetCastles } from '../src/db.js'
import app from '../src/index.js'

describe('Castle Service Provider Verification', () => {
  let server: ReturnType<typeof serve>
  const testPort = 4001

  beforeEach(async () => {
    resetCastles()

    server = serve({
      fetch: app.fetch,
      port: testPort,
    })

    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterEach(async () => {
    if (server) {
      server.close()
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  })

  it('should verify provider against recorded consumer interactions', async () => {
    const provider = createProvider({
      serviceUrl: process.env.ENTENTE_SERVICE_URL,
      apiKey: process.env.ENTENTE_API_KEY,
      provider: 'castle-service',
    })

    const results = await provider.verify({
      baseUrl: `http://localhost:${testPort}`,
      environment: 'test', // Verification context (where verification runs)
      stateHandlers: {
        listCastles: async () => {
          console.log('🔄 Resetting castles to default state')
          resetCastles()
        },
        getCastle: async () => {
          resetCastles()
        },
        createCastle: async () => {
          resetCastles()
        },
        deleteCastle: async () => {
          resetCastles()
        },
      },
      cleanup: async () => {
        resetCastles()
      },
    })

    console.log('\n📀 Provider verification completed')
    console.log(`📋 Total interactions tested: ${results.results.length}`)

    const successfulResults = results.results.filter(r => r.success)
    const failedResults = results.results.filter(r => !r.success)

    console.log(`✅ Successful verifications: ${successfulResults.length}`)
    console.log(`❌ Failed verifications: ${failedResults.length}`)

    if (failedResults.length > 0) {
      console.log('\n❌ Failed verifications:')
      for (const result of failedResults) {
        console.log(`  - ${result.interactionId}: ${result.error}`)
      }
    }

    // All verifications should pass if the provider correctly implements the contract
    expect(failedResults.length).toBe(0)
  })
})
```

### State Handler-Based Setup
```typescript
const results = await provider.verify({
  baseUrl: 'http://localhost:3000',
  stateHandlers: {
    'getOrder': async () => setupTestOrder('ord-123'),
    'createOrder': async () => setupTestCustomer('cust-456')
  },
  cleanup: async () => {
    await cleanupTestData()
  }
})

console.log(`✅ Verified ${results.results.length} interactions`)
```

### State Handler Implementation
```typescript
// Real example from castle-service tests
const stateHandlers = {
  listCastles: async () => {
    // Reset to default castle data
    resetCastles()
  },

  getCastle: async () => {
    // Ensure specific castle exists for retrieval
    resetCastles() // This populates default test castles
  },

  createCastle: async () => {
    // Clear data for fresh castle creation
    resetCastles()
  },

  deleteCastle: async () => {
    // Ensure castle exists to be deleted
    resetCastles()
  }
}

// Example of database reset function
function resetCastles() {
  // Reset in-memory castle data to known state
  castleDatabase = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Château de Versailles',
      region: 'Île-de-France',
      yearBuilt: 1623,
      description: 'Famous royal residence known for its opulent architecture'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Château de Fontainebleau',
      region: 'Île-de-France',
      yearBuilt: 1137,
      description: 'Historic royal palace with Renaissance architecture'
    }
  ]
}
```

## Verification Process

1. **Fetch Tasks**: Get verification tasks from central service for this provider
2. **Setup State**: Use state handlers to prepare test data
3. **Replay Requests**: Send recorded consumer requests to real provider
4. **Validate Responses**: Compare actual vs expected response structures
5. **Submit Results**: Send verification results back to central service
6. **Cleanup**: Clean up test data after each interaction

## Response Validation

The library implements structural response validation:

```typescript
// Validates that actual response contains all expected fields
// Allows extra fields in actual response
// Checks type compatibility for all fields
const isValid = validateJsonStructure(expectedResponse, actualResponse)
```

## Configuration

### Environment Variables
- `ENTENTE_SERVICE_URL` - URL of your Entente service
- `ENTENTE_API_KEY` - API key for authentication
- `ENVIRONMENT` - Target environment for verification
- `CI` - Set to 'true' in CI environments

### Verify Options
```typescript
interface VerifyOptions {
  baseUrl: string                                    // Provider service URL
  environment?: string                               // Environment filter
  stateHandlers?: Record<string, () => Promise<void>> // State setup functions
  cleanup?: () => Promise<void>                      // Cleanup function
}
```

## ContractFlow Specification Alignment

This package implements ContractFlow's core principles:

- **Provider Verification**: Verify against recorded real-world usage
- **Deployment Awareness**: Only test against actively deployed consumer versions
- **State Management**: Flexible state handler system for test setup
- **Real Data Focus**: Use actual consumer interactions, not hypothetical contracts
- **State Management**: Flexible setup for provider testing requirements

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

The package uses functional programming patterns and native fetch for HTTP requests, avoiding external dependencies where possible.