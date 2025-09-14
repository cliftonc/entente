# @entente/consumer - Claude Development Guide

## Purpose
Consumer testing library that creates mock servers from OpenAPI specs and records real interactions.

## Key Features
- OpenAPI-based mock server creation
- Fixture-aware deterministic mocking
- Automatic interaction recording in CI
- Integration with Prism mock server (to be implemented)

## Main Exports
- `createClient(config)` - Factory function for Entente client
- `EntenteClient` interface - Main client API
- `EntenteMock` interface - Mock server instance

## Architecture
- Functional programming (no classes)
- Factory functions return objects with methods
- Depends on @entente/types and @entente/fixtures
- Peer dependency on @stoplight/prism-cli

## Usage Example
```typescript
import { createClient } from '@entente/consumer'

const entente = createClient({
  serviceUrl: 'https://entente.company.com',
  consumer: 'web-app',
  consumerVersion: '1.0.0',
  environment: 'test',
  recordingEnabled: process.env.CI === 'true'
})

const mock = await entente.createMock('order-service', '2.1.0')
// Use mock.url for testing
await mock.close()
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

## Implementation Status
- ✅ Functional API structure
- ✅ Fixture management integration
- ✅ Interaction recording
- ❌ Real Prism integration (currently simplified mock)
- ❌ WebSocket support for real-time updates

## Next Steps
1. Integrate real Prism mock server
2. Implement fixture injection into OpenAPI specs
3. Add request/response validation
4. Improve error handling and logging