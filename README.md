# Entente

Schema-first contract testing with centralized management. Entente combines OpenAPI specifications with real interaction recording to provide automated contract testing between services.

## Features

- **OpenAPI-First**: All contracts start with OpenAPI specifications
- **Automatic Recording**: CI environments record real interactions transparently
- **Smart Fixtures**: Self-bootstrapping from test outputs with approval workflow
- **Deployment Aware**: Only test against actively deployed service versions
- **Real Verification**: Providers verify against actual consumer usage patterns
- **Cloud Native**: Deployable as Cloudflare Worker with Neon PostgreSQL

## Architecture

### Packages

- `@entente/types` - Shared TypeScript types
- `@entente/client` - Consumer testing library
- `@entente/provider` - Provider verification library
- `@entente/fixtures` - Fixture management utilities
- `@entente/cli` - Command line interface

### Apps

- `apps/server` - Central Entente service (Hono API + React UI)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm server:dev

# Run tests
pnpm test

# Lint and format
pnpm lint:fix
pnpm format
```

## Usage

### Consumer Testing

```typescript
import { createClient } from '@entente/client'

const entente = createClient({
  serviceUrl: 'https://entente.company.com',
  consumer: 'web-app',
  version: '1.0.0'
})

const mock = await entente.createMock('order-service', '2.1.0')
// Use mock.url for testing...
await mock.close()
```

### Provider Verification

```typescript
import { createProvider } from '@entente/provider'

const provider = createProvider({
  serviceUrl: 'https://entente.company.com',
  provider: 'order-service',
  version: '2.1.0'
})

const results = await provider.verify({
  baseUrl: 'http://localhost:3000',
  stateHandlers: {
    'getOrder': async () => setupTestData()
  }
})
```

## License

MIT