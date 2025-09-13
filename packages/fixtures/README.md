# @entente/fixtures

Fixture management utilities for Entente contract testing. This package provides shared functionality for managing test fixtures across both consumer and provider packages, implementing ContractFlow's smart fixture system with approval workflow.

## Overview

The fixtures package enables the ContractFlow fixture lifecycle: automatic proposal from test outputs, approval workflow, priority-based selection, and usage in both consumer mocking and provider state setup. It serves as the bridge between recorded interactions and deterministic test data.

## Core Features

### Fixture Lifecycle Management
```typescript
import { createFixtureManager } from '@entente/fixtures'

const fixtureManager = createFixtureManager('https://entente.company.com')

// Approve a fixture proposal
await fixtureManager.approve('fixture_123', 'john.doe', 'Looks good!')

// Bulk approve from successful test run
const count = await fixtureManager.bulkApprove('build-456', 'ci-bot')

// Get fixtures for operation
const fixtures = await fixtureManager.getByOperation(
  'order-service', '2.1.0', 'getOrder', 'approved'
)
```

### Priority-Based Fixture Selection
The package implements ContractFlow's fixture priority system:

1. **Provider fixtures** (priority 2+) - Real responses from provider verification
2. **Manual fixtures** (priority varies) - Hand-crafted test data  
3. **Consumer fixtures** (priority 1) - Generated from consumer tests

```typescript
import { prioritizeFixtures } from '@entente/fixtures'

// Sort fixtures by priority and source
const sortedFixtures = prioritizeFixtures(allFixtures)
const bestFixture = sortedFixtures[0] // Highest priority fixture
```

### Fixture Data Validation
```typescript
import { validateFixtureData } from '@entente/fixtures'

const isValid = validateFixtureData({
  response: { status: 200, body: { id: '123' } },
  request: { method: 'GET', path: '/orders/123' }, // Optional
  state: { orders: [{ id: '123' }] }              // Optional
})
```

## Fixture Structure

Fixtures follow the ContractFlow specification:

```typescript
interface Fixture {
  id: string                    // Unique identifier
  service: string              // Target service
  serviceVersion: string       // Service version
  operation: string           // OpenAPI operation ID
  status: 'draft' | 'approved' | 'deprecated'
  source: 'consumer' | 'provider' | 'manual'
  priority: number            // Higher = preferred
  data: {
    request?: any            // Optional request data
    response: any           // Required response data
    state?: Record<string, any> // Provider state data
  }
  createdFrom: {
    type: 'test_output' | 'manual' | 'generated'
    testRun?: string       // Build/test run ID
    timestamp: Date
    generatedBy?: string   // User or system
  }
  approvedBy?: string      // Approver
  approvedAt?: Date        // Approval timestamp
  notes?: string          // Additional notes
}
```

## Implementation Status

### ✅ Complete
- Complete CRUD operations for fixtures
- Approval workflow implementation
- Priority-based fixture selection
- Validation utilities for fixture data
- Bulk operations for CI/CD integration
- Integration with central service API

### 🔄 In Progress
- None - core functionality complete

### ❌ TODO - High Priority
1. **Fixture Versioning**: Support for fixture evolution across service versions
2. **Conflict Resolution**: Handle overlapping fixtures for same operations
3. **Usage Analytics**: Track which fixtures are used and how often
4. **Migration Utilities**: Tools for migrating fixtures between versions

### ❌ TODO - Lower Priority
- Fixture templates and generation helpers
- Advanced search and filtering
- Fixture dependency tracking
- Performance optimization for large fixture sets
- Integration with popular testing frameworks

## Usage Examples

### Consumer Test Integration
```typescript
// In consumer tests - automatic fixture proposal
describe('Order Service Tests', () => {
  it('should create order', async () => {
    const response = await orderClient.createOrder(orderData)
    
    // In CI: This response automatically becomes a fixture proposal
    expect(response.id).toBeDefined()
  })
})
```

### Provider Verification Integration
```typescript
// In provider verification - fixture-based state setup
await provider.verify({
  fixtureBasedSetup: true, // Use fixtures to set up provider state
  proposeFixtures: true,   // Generate new fixtures from real responses
})
```

### Manual Fixture Management
```typescript
const fixtureManager = createFixtureManager('https://entente.company.com')

// Get pending fixtures for approval
const pending = await fixtureManager.getPending('order-service')

// Approve selected fixtures
for (const fixture of pending) {
  await fixtureManager.approve(fixture.id, 'team-lead', 'Approved after review')
}

// Update existing fixture
await fixtureManager.update('fixture_123', {
  priority: 3,
  notes: 'Updated for v2.1.0 compatibility'
})
```

## Fixture Sources and Workflow

### From Consumer Tests
1. Consumer test runs in CI
2. Mock server captures response
3. Response proposed as fixture automatically
4. Status: `draft`, Source: `consumer`, Priority: `1`

### From Provider Verification  
1. Provider verification succeeds
2. Real response captured
3. Response proposed as fixture with state data
4. Status: `draft`, Source: `provider`, Priority: `2`

### Manual Creation
1. Developer creates fixture manually
2. Custom priority assigned
3. Status: `draft`, Source: `manual`

### Approval Process
1. Fixtures start as `draft` status
2. Team reviews and approves
3. Status changes to `approved`
4. Fixtures become available for use

## API Methods

### Core Operations
- `approve(id, approver, notes?)` - Approve fixture proposal
- `update(id, updates)` - Update existing fixture
- `deprecate(id, reason?)` - Mark fixture as deprecated

### Querying
- `getPending(service?)` - Get draft fixtures awaiting approval
- `getByOperation(service, version, operation, status?)` - Get fixtures for operation

### Bulk Operations  
- `propose(proposal)` - Create new fixture proposal
- `bulkApprove(testRunId, approver)` - Approve all fixtures from test run

## Utility Functions

### Fixture Prioritization
```typescript
// Sort fixtures by priority and source preference
const prioritized = prioritizeFixtures(fixtures)
```

### Operation ID Generation
```typescript  
// Generate operation ID from HTTP method and path
const operationId = extractOperationFromPath('GET', '/orders/{id}')
// Returns: 'getOrders'
```

### Data Validation
```typescript
// Validate fixture data structure
const isValid = validateFixtureData(fixtureData)
```

## ContractFlow Specification Alignment

This package implements ContractFlow's fixture principles:

- **Automatic Recording**: Fixtures proposed from test outputs automatically
- **Approval Workflow**: Team controls which fixtures become official
- **Priority System**: Provider fixtures preferred over consumer fixtures
- **State Integration**: Fixtures include provider state setup data
- **CI Integration**: Bulk operations for build pipeline integration

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

This package serves as a shared utility used by both `@entente/client` and `@entente/provider` packages, implementing the fixture management layer that enables ContractFlow's smart fixture system.