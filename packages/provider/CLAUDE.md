# @entente/provider - Claude Development Guide

## Purpose
Provider verification library that replays recorded consumer interactions against real provider implementations.

## Key Features
- Verification against real recorded interactions
- Fixture-based state setup
- Response structure validation (not exact values)
- Fixture proposal generation from successful verifications

## Main Exports
- `createProvider(config)` - Factory function for provider verification
- `replayRequest(baseUrl, request)` - Replay recorded requests
- `validateResponse(expected, actual)` - Structure validation
- `validateJsonStructure(expected, actual)` - Deep structure comparison

## Architecture
- Functional programming (no classes)
- Factory functions return objects with methods
- Depends on @entente/types and @entente/fixtures
- Uses native fetch for HTTP requests

## Usage Example
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
  proposeFixtures: true,
  cleanup: async () => cleanupTestData()
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
- `setupFromFixtures()` - Automatic state setup from fixtures
- `submitFixtureProposals()` - Create fixture proposals from real responses
- `extractStateInformation()` - Extract provider state (user-implementable)

## Implementation Status
- ✅ Core verification workflow
- ✅ Response structure validation
- ✅ Fixture proposal generation
- ❌ Real database state setup examples
- ❌ Advanced state extraction helpers

## Next Steps
1. Add example state setup implementations
2. Improve state extraction utilities
3. Add parallel verification support
4. Implement verification result caching