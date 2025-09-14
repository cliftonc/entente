# Entente

Schema-first contract testing with centralized management. Entente combines OpenAPI specifications with real interaction recording to provide automated contract testing between services.

## Features

- **OpenAPI-First**: All contracts start with OpenAPI specifications
- **Automatic Recording**: CI environments record real interactions transparently
- **Smart Fixtures**: Self-bootstrapping from test outputs with approval workflow
- **Deployment Aware**: Only test against actively deployed service versions
- **Real Verification**: Providers verify against actual consumer usage patterns
- **Cloud Native**: Deployable as Cloudflare Worker with Neon PostgreSQL

## How Contract Testing Works in Entente

### The Three-Phase Flow

**1. Consumer Records Expectations (Testing Phase)**
```
Consumer (v1.0.0 / SHA: abc1234)
  → Records interactions against mock server
  → Captures: "I expect these responses for these requests"
  → Tagged with environment context (e.g., "ci", "test", "local")
  → Doesn't know what provider version will satisfy these expectations
```

**2. Provider Verifies Capabilities (Verification Phase)**
```
Provider (v2.0.0 / SHA: def5678)
  → Fetches recorded consumer expectations
  → Verifies: "I can satisfy these consumer expectations"
  → Creates version linkage: "Provider def5678 ✓ Consumer abc1234"
  → Tagged with verification environment
```

**3. Deployment Decision (can-i-deploy)**
```
Question: Can consumer abc1234 deploy to staging?
  → What provider version is in staging? (e.g., def5678)
  → Has provider def5678 verified against consumer abc1234?
  → Decision: Safe to deploy ✓ or Not verified ✗
```

### Key Principles

- **Interactions are version-agnostic** - they're consumer expectations, not contracts with specific providers
- **Verifications create version linkages** - they prove "provider X can satisfy consumer Y"
- **Environments serve different purposes**:
  - For interactions: test context/quality level (ci vs local)
  - For verifications: where verification was performed
  - For deployments: actual runtime environment (staging, production)
- **Git SHA versioning** - automatic, precise identification of what code was actually tested

### Benefits

- **Decoupled Development**: Consumers and providers evolve independently
- **Flexible Compatibility**: One provider version can satisfy multiple consumer versions
- **Clear Separation**: Expectations vs capabilities vs deployment state
- **No Manual Versioning**: Git SHA eliminates version management overhead

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