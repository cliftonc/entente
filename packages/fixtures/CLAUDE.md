# @entente/fixtures - Claude Development Guide

## Purpose
Shared fixture management utilities used by both client and provider packages for test data lifecycle management.

## Key Features
- Fixture CRUD operations
- Approval workflow management
- Bulk operations for CI/CD
- Priority-based fixture selection
- Validation utilities

## Main Exports
- `createFixtureManager(serviceUrl)` - Factory function for fixture management
- `validateFixtureData(data)` - Validate fixture structure
- `prioritizeFixtures(fixtures)` - Sort fixtures by priority and source
- `extractOperationFromPath(method, path)` - Generate operation IDs

## Architecture
- Functional programming (no classes)
- Factory function returns object with methods
- Depends only on @entente/types
- RESTful API communication

## Usage Example
```typescript
import { createFixtureManager } from '@entente/fixtures'

const fixtureManager = createFixtureManager('https://entente.company.com')

// Approve a fixture
await fixtureManager.approve('fixture_123', 'john.doe', 'Looks good!')

// Bulk approve from test run
const count = await fixtureManager.bulkApprove('build-456', 'ci-bot')

// Get fixtures for operation
const fixtures = await fixtureManager.getByOperation(
  'order-service', '2.1.0', 'getOrder', 'approved'
)
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

## API Methods
- `approve(id, approver, notes?)` - Approve fixture proposal
- `update(id, updates)` - Update existing fixture
- `getPending(service?)` - Get draft fixtures awaiting approval
- `getByOperation(service, version, operation, status?)` - Get fixtures for operation
- `propose(proposal)` - Create new fixture proposal
- `bulkApprove(testRunId, approver)` - Approve all fixtures from test run
- `deprecate(id, reason?)` - Mark fixture as deprecated

## Fixture Priority System
1. **Provider fixtures** (priority 2+) - Real responses from provider verification
2. **Manual fixtures** (priority varies) - Hand-crafted test data
3. **Consumer fixtures** (priority 1) - Generated from consumer tests

## Implementation Status
- ✅ Complete CRUD operations
- ✅ Approval workflow
- ✅ Priority system
- ✅ Validation utilities
- ❌ Fixture versioning/migration
- ❌ Fixture conflict resolution

## Next Steps
1. Add fixture versioning support
2. Implement conflict resolution for overlapping fixtures
3. Add fixture usage analytics
4. Create fixture migration utilities