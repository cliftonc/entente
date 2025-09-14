# @entente/provider - Claude Development Guide

## Purpose
Provider verification library that replays recorded consumer interactions against real provider implementations.

## Key Features
- Verification against real recorded interactions
- State handler-based setup
- Response structure validation (not exact values)

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
- ❌ Advanced verification reporting
- ❌ Parallel verification support

## Next Steps
1. Add example state setup implementations
2. Add parallel verification support
3. Implement verification result caching
4. Add advanced verification reporting