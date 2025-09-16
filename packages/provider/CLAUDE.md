# @entente/provider - Claude Development Guide

## Purpose
Provider verification library that replays recorded consumer interactions against real provider implementations.

## Key Features
- Verification against real recorded interactions
- State handler-based setup
- Response structure validation (not exact values)
- **NEW: Normalized fixtures support** - Automatic entity-based test data setup

## Main Exports
- `createProvider(config)` - Factory function for provider verification
- `replayRequest(baseUrl, request)` - Replay recorded requests
- `validateResponse(expected, actual)` - Structure validation
- `validateJsonStructure(expected, actual)` - Deep structure comparison

## Architecture
- Functional programming (no classes)
- Factory functions return objects with methods
- Depends on @entente/types only
- Uses native fetch for HTTP requests

## Usage Example

### Traditional State Handlers
```typescript
import { createProvider } from '@entente/provider'

const provider = createProvider({
  serviceUrl: 'https://entente.company.com',
  provider: 'order-service',
  providerVersion: '2.1.0'
})

const results = await provider.verify({
  baseUrl: 'http://localhost:3000',
  stateHandlers: {
    'getOrder': async () => setupTestData()
  },
  cleanup: async () => cleanupTestData()
})
```

### NEW: Normalized Fixtures (Automatic Setup)
```typescript
import { createProvider } from '@entente/provider'
import type { NormalizedFixtures } from '@entente/types'

const provider = createProvider({
  serviceUrl: 'https://entente.company.com',
  provider: 'order-service',
  providerVersion: '2.1.0',

  // Enable automatic fixture normalization
  useNormalizedFixtures: true,

  // Provide database setup callback
  dataSetupCallback: async (fixtures: NormalizedFixtures) => {
    // Automatically insert all test entities into your database
    for (const [entityType, entities] of Object.entries(fixtures.entities)) {
      const tableName = entityType.toLowerCase() + 's'
      const records = entities.map(e => e.data)
      await db.batchInsert(tableName, records)
    }
  }
})

// Verification now runs with pre-populated test data
const results = await provider.verify({
  baseUrl: 'http://localhost:3000',
  environment: 'test'
  // No state handlers needed - data is already set up!
})
```

## Development
```bash
# Build package
pnpm build

# Watch for changes
pnpm dev

# Run tests
pnpm test
```

## Key Functions
- `verify()` - Main verification workflow
- `replayRequest()` - Replay recorded requests against provider
- `validateResponse()` - Structure validation of responses
- `validateJsonStructure()` - Deep structure comparison

## Implementation Status
- ✅ Core verification workflow
- ✅ Response structure validation
- ✅ State handler integration
- ✅ **NEW: Normalized fixtures support**
- ❌ Advanced verification reporting
- ❌ Parallel verification support

## Normalized Fixtures Feature

### Overview
The normalized fixtures feature automatically downloads and processes all approved fixture data for your service, converting operation-based test data into entity-based database records. This eliminates the need for manual state handlers in most cases.

### How It Works
1. **Download**: Provider downloads all approved fixtures for the service/version
2. **Normalize**: Fixtures are analyzed and converted from operations (GET, POST, etc.) into entities (User, Order, etc.)
3. **Setup**: Your `dataSetupCallback` receives the normalized entities for database insertion
4. **Verify**: Provider verification runs against the pre-populated test database

### Benefits
- **Automatic Setup**: No manual state handlers needed for basic CRUD operations
- **Consistent Data**: All tests use the same normalized dataset
- **Entity-Centric**: Maps naturally to your database schema
- **Dependency Resolution**: Handles entity relationships automatically

### Entity Extraction Rules
- `POST /users` + response → User entity creation
- `GET /users/{id}` + response → User entity state
- `PUT /users/{id}` + request/response → User entity update
- `DELETE /users/{id}` → User entity deletion
- `GET /users` + response → Multiple User entities

### Configuration Options
```typescript
interface ProviderConfig {
  // Enable normalized fixtures
  useNormalizedFixtures?: boolean

  // Callback for database setup
  dataSetupCallback?: (fixtures: NormalizedFixtures) => Promise<void>
}

interface NormalizedFixtures {
  entities: Record<string, EntityData[]>      // Entities grouped by type
  relationships: EntityRelationship[]         // Entity relationships
  metadata: {
    service: string
    version: string
    totalFixtures: number
    extractedAt: Date
  }
}
```

### Advanced Usage
```typescript
// Custom table mapping
const dataSetupCallback = async (fixtures: NormalizedFixtures) => {
  const tableMapping = {
    'User': 'users',
    'Order': 'sales_orders',
    'Product': 'inventory_items'
  }

  await db.transaction(async () => {
    // Insert entities in dependency order
    for (const [entityType, entities] of Object.entries(fixtures.entities)) {
      const tableName = tableMapping[entityType] || entityType.toLowerCase()
      const records = entities.map(e => transformForDatabase(e.data))
      await db.batchInsert(tableName, records)
    }
  })
}
```

### Backwards Compatibility
Normalized fixtures work alongside traditional state handlers:
- Use normalized fixtures for basic entity setup
- Use state handlers for complex scenarios (external APIs, special state)
- Both can be used together in the same verification

## Next Steps
1. Add relationship detection and foreign key handling
2. Add parallel verification support
3. Implement verification result caching
4. Add advanced verification reporting
5. Add database-specific helpers (SQL generation, migrations)