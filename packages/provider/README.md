# @entente/provider

Provider verification library for Entente contract testing. This package implements the provider-side functionality, enabling providers to verify their implementations against real recorded consumer interactions.

## Overview

The provider library allows service providers to verify their implementations against real consumer usage patterns recorded by the central Entente service. It supports state handler-based setup and response structure validation.

## Core Features

### Real Interaction Verification
```typescript
import { createProvider } from '@entente/provider'

const provider = createProvider({
  serviceUrl: 'https://entente.company.com',
  provider: 'order-service',
  providerVersion: '2.1.0'
})

const results = await provider.verify({
  baseUrl: 'http://localhost:3000',
  environment: 'test',
  stateHandlers: {
    'getOrder': async () => {
      // Setup test data for getOrder operation
      await setupTestOrder('ord-123')
    },
    'createOrder': async () => {
      // Setup test data for createOrder operation
      await setupTestCustomer('cust-456')
    }
  },
  cleanup: async () => {
    // Clean up test data after each interaction
    await cleanupTestData()
  }
})
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

### Basic Provider Verification
```typescript
describe('Order Service Provider Verification', () => {
  let app: any
  let provider: ReturnType<typeof createProvider>

  beforeAll(async () => {
    // Start your application
    app = await startApp()
    
    provider = createProvider({
      serviceUrl: 'https://entente.company.com',
      provider: 'order-service',
      providerVersion: process.env.PROVIDER_VERSION || '2.1.0'
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('should verify all recorded consumer interactions', async () => {
    const results = await provider.verify({
      baseUrl: `http://localhost:${app.port}`,
      environment: process.env.ENVIRONMENT || 'test',
      
      stateHandlers: {
        'getOrder': async () => {
          await setupTestOrder('ord-123')
        },
        'createOrder': async () => {
          await setupTestCustomer('cust-456')
        }
      },
      
      cleanup: async () => {
        await cleanupTestData()
      }
    })

    console.log(`Verification completed: ${results.passed}/${results.totalInteractions} passed`)
    expect(results.failed).toBe(0)
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
const stateHandlers = {
  'getOrder': async () => {
    // Setup database state for order retrieval
    await database.orders.create({
      id: 'ord-123',
      customerId: 'cust-456',
      status: 'completed',
      total: 99.99
    })
  },
  
  'createOrder': async () => {
    // Setup required customer data
    await database.customers.create({
      id: 'cust-456',
      name: 'Test Customer',
      email: 'test@example.com'
    })
  }
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
- `PROVIDER_VERSION` - Version of the provider service
- `ENVIRONMENT` - Target environment for verification
- `BUILD_ID` - Build identifier for verification tracking

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