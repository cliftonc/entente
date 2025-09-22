# @entente/consumer - Claude Development Guide

## Purpose
Consumer testing library that supports both mock server creation and lightweight request interception for recording real API interactions.

## Key Features
- **Mock Server Mode**: Creates mock servers from OpenAPI specs with fixture responses
- **Interceptor Mode**: Lightweight request interception with real API passthrough
- Fixture-aware deterministic mocking
- Automatic interaction recording in CI
- Support for fetch, http module, supertest, axios, etc.

## Main Exports
- `createClient(config)` - Factory function for Entente client
- `EntenteClient` interface - Main client API with both modes
- `EntenteMock` interface - Mock server instance (server mode)
- `RequestInterceptor` interface - Request interceptor (intercept mode)

## Architecture
- Functional programming (no classes)
- Factory functions return objects with methods
- Depends on @entente/types and @entente/fixtures
- Peer dependency on @stoplight/prism-cli

## Usage Examples

### Mock Server Mode (Full Mocking)
```typescript
import { createClient } from '@entente/consumer'

const entente = await createClient({
  serviceUrl: 'https://entente.company.com',
  consumer: 'web-app',
  consumerVersion: '1.0.0',
  environment: 'test',
  recordingEnabled: process.env.CI === 'true'
})

const mock = await entente.createMock('order-service', '2.1.0')
// Use mock.url for testing with fixture responses
await mock.close()
```

### Interceptor Mode (Real API with Recording)
```typescript
{
  using interceptor = await entente.patchRequests('order-service', '2.1.0')

  // All HTTP requests are intercepted and recorded
  await fetch('https://api.example.com/orders/123')  // Real API call
  await request(app).get('/orders/123')             // Supertest
  await axios.get('https://api.example.com/orders') // Axios

} // Automatically unpatch and batch send interactions
```

### Manual Fixture Download
```typescript
const fixtures = await entente.downloadFixtures('order-service', '2.1.0')
// Use fixtures for custom mock implementations
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
- ✅ Mock Server Mode - Functional API structure
- ✅ Interceptor Mode - Request interception with MSW interceptors
- ✅ Fixture management integration
- ✅ Interaction recording and batching
- ✅ Operation matching for OpenAPI/GraphQL/AsyncAPI
- ✅ Support for fetch, http module, supertest, axios
- ✅ Symbol.dispose for automatic cleanup
- ❌ Real Prism integration (currently simplified mock)
- ❌ WebSocket support for real-time updates

## Mode Comparison

| Feature | Mock Server Mode | Interceptor Mode |
|---------|------------------|------------------|
| **Purpose** | Isolated testing with fixtures | Integration testing with real APIs |
| **API Calls** | Mocked responses | Real API responses |
| **Port Required** | Yes | No |
| **Fixture Usage** | Yes | No (just for operation matching) |
| **Recording** | Yes | Yes |
| **Works with** | Any HTTP client | fetch + http module clients |
| **Cleanup** | `mock.close()` | `using` statement |

## Next Steps
1. Integrate real Prism mock server for better OpenAPI validation
2. Add WebSocket interception for AsyncAPI
3. Improve error handling and logging
4. Add more comprehensive GraphQL operation matching