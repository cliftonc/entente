# Entente

🌐 **Website**: [entente.dev](https://entente.dev) | 📚 **Documentation**: [docs.entente.dev](https://docs.entente.dev)

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
Consumer (v1.0.0)
  → Records interactions against mock server
  → Captures: "I expect these responses for these requests"
  → Tagged with environment context (e.g., "ci", "test", "local")
  → Specifies a version of the server and uses this to retrieve openapi spec and fixture data from entente
```

**2. Provider Verifies Capabilities (Verification Phase)**
```
Provider (v2.0.0)
  → Fetches recorded consumer expectations
  → Verifies: "I can satisfy these consumer expectations"
  → Creates version linkage: "Provider v2.0.0 ✓ Consumer v1.0.0"
```

**3. Deployment Decision (can-i-deploy)**
```
Question: Can consumer v1.0.0 deploy to staging?
  → What provider version is in staging? (e.g., v2.0.0)
  → Has provider v2.0.0 verified against consumer v1.0.0?
  → Decision: Safe to deploy ✓ or Not verified ✗
  → If not verified, it can automatically trigger a verification action in Github if configured
```

### Key Principles

- **Interactions are version-agnostic** - they're consumer expectations, not contracts with specific providers
- **Verifications create version linkages** - they prove "provider X can satisfy consumer Y"
- **Environments serve different purposes**:
  - For interactions: test context/quality level (ci vs local)
  - For verifications: where verification was performed
  - For deployments: actual runtime environment (staging, production)
- **Semantic versioning** - clear identification of what service versions were tested

### Benefits

- **Decoupled Development**: Consumers and providers evolve independently
- **Flexible Compatibility**: One provider version can satisfy multiple consumer versions
- **Clear Separation**: Expectations vs capabilities vs deployment state
- **Semantic Versioning**: Clear version management using standard versioning practices

## Architecture

### Packages

- `@entente/types` - Shared TypeScript types
- `@entente/consumer` - Consumer testing library
- `@entente/provider` - Provider verification library
- `@entente/fixtures` - Fixture management utilities
- `@entente/cli` - Command line interface

### Apps

- `apps/server` - Central Entente service (Hono API + React UI)

## Getting Started

### Prerequisites

- **Node.js 20+** - Required for all packages
- **pnpm 9+** - Package manager for the monorepo
- **Entente API Key** - Get this from your Entente service dashboard

### Environment Setup

1. **Clone the repository** (or create a new service)
2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in your service directory:
   ```bash
   ENTENTE_SERVICE_URL=https://your-entente-service.com // Optional - defaults to https://entente.dev
   ENTENTE_API_KEY=your-api-key-here

   # For GitHub integration (optional)
   GITHUB_CLIENT_ID=your-github-app-client-id
   GITHUB_CLIENT_SECRET=your-github-app-client-secret
   ```

4. **Install Entente CLI globally**:
   ```bash
   npm install -g @entente/cli
   ```

5. **Authenticate with CLI**:
   ```bash
   entente login
   ```

### Quick Start for New Services

1. **Create your OpenAPI specification** (for providers):
   ```bash
   mkdir spec
   # Create spec/openapi.json with your API definition
   ```

2. **Register your service**:
   ```bash
   # For consumers
   entente register-service --type consumer --name my-service --environment test

   # For providers
   entente register-service --type provider --name my-service --spec spec/openapi.json --environment test
   ```

3. **Add Entente to your tests**:
   ```bash
   npm install @entente/consumer  # for consumer tests
   npm install @entente/provider  # for provider tests
   ```

4. **Write contract tests** (see Usage section for examples)

### Development Commands

```bash
# Start development server (for the main Entente server)
pnpm server:dev

# Run tests
pnpm test

# Run tests for specific example
pnpm --filter @entente/example-castle-client test
pnpm --filter @entente/example-castle-service test

# Lint and format
pnpm lint:fix
pnpm format

# Build all packages
pnpm build
```

### API Key Setup

Your Entente API key can be configured in several ways:

1. **Environment variable**: `ENTENTE_API_KEY=your-key`
2. **CLI login**: `entente login` (stores in `~/.entente/entente.json`)
3. **GitHub Secrets**: For CI/CD workflows
4. **Local config file**: `~/.entente/entente.json`

### Fixture Management

Fixtures provide fallback data when services aren't available:

1. **Create fixtures directory**:
   ```bash
   mkdir fixtures
   ```

2. **Add fixture files**:
   ```json
   // fixtures/my-provider-service.json
   [
     {
       "service": "my-provider-service",
       "operation": "getUsers",
       "data": {
         "request": { "method": "GET", "path": "/users" },
         "response": { "status": 200, "body": [...] }
       }
     }
   ]
   ```

3. **Use fixtures in tests**:
   ```typescript
   const mock = await client.createMock('my-provider-service', '1.0.0', {
     useFixtures: true,
     localFixtures: require('./fixtures/my-provider-service.json')
   })
   ```

## Usage

### Consumer Testing

Consumer testing records your application's expectations when calling external services. The `@entente/consumer` library creates real mock servers based on OpenAPI specs and automatically records interactions in CI environments.

#### How it Works

1. **Create a Client** - The `createClient()` function configures your Entente connection
2. **Create a Mock** - The `client.createMock()` method:
   - Fetches the provider's OpenAPI spec from Entente
   - Starts a real HTTP server using Prism (mock server)
   - Uses fixtures for deterministic responses when available
   - Sets up automatic interaction recording when `recordingEnabled: true`
3. **Test Against the Mock** - Your application calls the mock server URL
4. **Automatic Recording** - In CI, all requests/responses are recorded to Entente
5. **Clean Up** - `mock.close()` uploads any collected data and shuts down the server

Here's a real example from the castle-client:

```typescript
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@entente/consumer'
import type { Fixture } from '@entente/types'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CastleApiClient } from '../src/castle-api.js'

// Load environment variables
dotenv.config()

describe('Castle Client Consumer Contract Tests', () => {
  let client: ReturnType<typeof createClient>
  let mock: Awaited<ReturnType<typeof client.createMock>>
  let castleApi: CastleApiClient

  beforeAll(async () => {
    // Load local fixtures for fallback
    const fixturesPath = join(process.cwd(), 'fixtures', 'castle-service.json')
    const localFixtures: Fixture[] = JSON.parse(readFileSync(fixturesPath, 'utf-8'))

    // 1. Create Entente client with your service configuration
    client = createClient({
      serviceUrl: process.env.ENTENTE_SERVICE_URL || '',
      apiKey: process.env.ENTENTE_API_KEY || '',
      consumer: 'castle-client',                    // Your app name
      environment: 'test',                          // Test context
      recordingEnabled: process.env.CI === 'true', // Record in CI only
    })

    // 2. Create mock server for the provider service
    // This fetches castle-service's OpenAPI spec and starts a real HTTP server
    mock = await client.createMock('castle-service', '0.1.0', {
      useFixtures: true,        // Use fixtures for deterministic responses
      validateRequests: true,   // Validate requests against OpenAPI spec
      validateResponses: true,  // Validate responses against OpenAPI spec
      localFixtures,           // Fallback fixtures if server is unavailable
    })

    // 3. Initialize your API client to point at the mock server
    // mock.url is a real HTTP URL like http://localhost:3041
    castleApi = new CastleApiClient(mock.url)
  })

  afterAll(async () => {
    // 4. Clean up: uploads recorded interactions and shuts down server
    if (mock) {
      await mock.close()
    }
  })

  // 5. Write normal tests - interactions are automatically recorded in CI
  it('should get all castles from the service', async () => {
    const castles = await castleApi.getAllCastles()

    expect(Array.isArray(castles)).toBe(true)
    expect(castles.length).toBeGreaterThan(0)

    const castle = castles[0]
    expect(castle).toHaveProperty('id')
    expect(castle).toHaveProperty('name')
    expect(castle).toHaveProperty('region')
    expect(castle).toHaveProperty('yearBuilt')
  })

  it('should create a new castle', async () => {
    const newCastleData = {
      name: 'Château de Test',
      region: 'Test Region',
      yearBuilt: 1500,
    }

    const createdCastle = await castleApi.createCastle(newCastleData)

    expect(createdCastle).toHaveProperty('id')
    expect(createdCastle.name).toBe(newCastleData.name)
  })
})
```

#### Key Points

- **Real HTTP Server**: `mock.url` points to an actual running HTTP server powered by Prism
- **OpenAPI-Driven**: Responses are generated from the provider's OpenAPI specification
- **Fixture-Aware**: Uses approved fixtures when available for deterministic testing
- **Automatic Recording**: In CI (`recordingEnabled: true`), all interactions are captured
- **Validation**: Requests and responses are validated against the OpenAPI spec
- **Local Development**: Works offline using local fixtures when the Entente service is unavailable

### Provider Verification

Verify that your provider service can handle recorded consumer interactions. Here's the castle-service provider test:

```typescript
import { createProvider } from '@entente/provider'
import { serve } from '@hono/node-server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetCastles } from '../src/db.js'
import app from '../src/index.js'

describe('Castle Service Provider Verification', () => {
  let server: ReturnType<typeof serve>
  const testPort = 4001

  beforeEach(async () => {
    resetCastles() // Reset test data

    // This would be your real API server
    server = serve({
      fetch: app.fetch,
      port: testPort,
    })

    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterEach(async () => {
    if (server) {
      server.close()
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  })

  it('should verify provider against recorded consumer interactions', async () => {
    const provider = createProvider({
      serviceUrl: process.env.ENTENTE_SERVICE_URL,
      apiKey: process.env.ENTENTE_API_KEY,
      provider: 'castle-service',
    })

    const results = await provider.verify({
      baseUrl: `http://localhost:${testPort}`,
      environment: 'test', // Verification context
      stateHandlers: {
        listCastles: async () => {
          console.log('🔄 Resetting castles to default state')
          resetCastles()
        },
        getCastle: async () => {
          resetCastles()
        },
        createCastle: async () => {
          resetCastles()
        },
        deleteCastle: async () => {
          resetCastles()
        },
      },
      cleanup: async () => {
        resetCastles()
      },
    })

    console.log(`📋 Total interactions tested: ${results.results.length}`)

    const failedResults = results.results.filter(r => !r.success)
    if (failedResults.length > 0) {
      console.log('❌ Failed verifications:')
      for (const result of failedResults) {
        console.log(`  - ${result.interactionId}: ${result.error}`)
      }
    }

    // All verifications should pass
    expect(failedResults.length).toBe(0)
  })
})
```

## GitHub Actions Integration

Entente integrates seamlessly with GitHub Actions for automated CI/CD workflows. Here are real examples from the castle-client and castle-service:

### Build & Test Workflow

This workflow runs tests and records interactions in CI:

```yaml
name: Castle Client - Build & Test

on:
  push:
    branches: [main]
    paths:
      - 'examples/castle-client/**'
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Install Entente CLI globally
        run: npm install -g @entente/cli@latest

      - name: Install dependencies
        working-directory: examples/castle-client
        run: pnpm install

      - name: Register service with Entente
        env:
          ENTENTE_API_KEY: ${{ secrets.ENTENTE_API_KEY }}
        run: |
          cd examples/castle-client
          entente register-service \
            --type consumer \
            --name castle-client \
            --environment development

      - name: Run tests (records interactions in CI)
        env:
          ENTENTE_SERVICE_URL: ${{ vars.ENTENTE_SERVICE_URL }}
          ENTENTE_API_KEY: ${{ secrets.ENTENTE_API_KEY }}
        run: pnpm --filter @entente/example-castle-client test
```

### Deployment Workflow with can-i-deploy

This workflow checks deployment safety before deploying to each environment:

```yaml
name: Castle Client - Deploy

on:
  workflow_run:
    workflows: ["Castle Client - Build & Test"]
    types: [completed]
    branches: [main]

jobs:
  deploy-development:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    environment: development

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js & pnpm
        # ... setup steps

      - name: Check deployment readiness
        env:
          ENTENTE_API_KEY: ${{ secrets.ENTENTE_API_KEY }}
        run: |
          cd examples/castle-client
          VERSION=$(node -p "require('./package.json').version")
          entente can-i-deploy \
            --type consumer \
            --service castle-client \
            --service-version $VERSION \
            --environment development

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: examples/castle-client
          command: deploy --name castle-client-dev --env development

      - name: Record deployment
        env:
          ENTENTE_API_KEY: ${{ secrets.ENTENTE_API_KEY }}
        run: |
          cd examples/castle-client
          VERSION=$(node -p "require('./package.json').version")
          entente deploy-service \
            --name castle-client \
            --service-version $VERSION \
            --environment development \
            --type consumer

  deploy-staging:
    needs: [deploy-development]
    if: needs.deploy-development.result == 'success'
    environment: staging
    # ... similar steps for staging

  deploy-production:
    needs: [deploy-staging]
    if: needs.deploy-staging.result == 'success'
    environment: production
    # ... similar steps for production
```

### Provider Verification in CI

Provider services verify against consumer interactions:

```yaml
name: Castle Service - Build & Test

jobs:
  build-and-test:
    steps:
      - name: Register provider service
        env:
          ENTENTE_API_KEY: ${{ secrets.ENTENTE_API_KEY }}
        run: |
          cd examples/castle-service
          VERSION=$(node -p "require('./package.json').version")
          entente register-service \
            --type provider \
            --name castle-service \
            --spec spec/openapi.json \
            --spec-version $VERSION \
            --environment development

      - name: Run provider verification tests
        env:
          ENTENTE_SERVICE_URL: ${{ vars.ENTENTE_SERVICE_URL }}
          ENTENTE_API_KEY: ${{ secrets.ENTENTE_API_KEY }}
        run: pnpm --filter @entente/example-castle-service test
```

### Required GitHub Secrets & Variables

Configure these in your repository settings:

**Repository Secrets:**
- `ENTENTE_API_KEY` - Your Entente service API key
- `CLOUDFLARE_API_TOKEN` - For Cloudflare Workers deployment if using
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID if using

**Repository Variables:**
- `ENTENTE_SERVICE_URL` - URL of your Entente service
- `CLOUDFLARE_WORKERS_SUBDOMAIN` - Your Workers subdomain if using

## GitHub App Integration

Entente provides GitHub App integration for repository-level automation and monitoring.

### Setting Up GitHub App Integration

1. **Install the Entente GitHub App** in your organization or repositories
2. **Configure in Entente Settings** - Link your services to GitHub repositories
3. **Automatic Repository Detection** - Services are automatically mapped to repositories

### Automatic Service-to-Repository Mapping

The system automatically maps services to GitHub repositories, it will try to detect the github url when registering a service.

### GitHub Actions Workflow Monitoring

Monitor your CI/CD pipelines directly from the Entente dashboard:

- **Workflow Status** - See build and test results
- **Deployment Tracking** - Monitor deployments across environments
- **Contract Verification** - Track provider verification results
- **Pull Request Integration** - Contract testing results on PRs

### Triggering Workflows

Entente can trigger GitHub Actions workflows programmatically if the Github app is linked.

### Repository Integration Features

- **Automatic Detection** - Services mapped to repositories via git URLs
- **Workflow Monitoring** - Track CI/CD pipeline status
- **Pull Request Comments** - Automated contract testing feedback
- **Deployment Verification** - can-i-deploy checks before deployments
- **Multi-tenant Support** - Each organization gets isolated GitHub access

## CLI Usage

The Entente CLI provides commands for service registration, deployment checks, and fixture management.

### Installation

```bash
npm install -g @entente/cli
```

### Authentication

```bash
# Login to your Entente service
entente login

# Check current authentication
entente whoami
```

### Service Registration

Register consumers and providers with your Entente service:

```bash
# Register a consumer service
entente register-service \
  --type consumer \
  --name castle-client \
  --environment development

# Register a provider with OpenAPI spec
entente register-service \
  --type provider \
  --name castle-service \
  --spec spec/openapi.json \
  --spec-version 1.0.0 \
  --environment development

# Upload/update just the OpenAPI spec
entente upload-spec \
  --service castle-service \
  --service-version 1.0.0 \
  --environment development \
  --spec spec/openapi.json
```

### Deployment Safety Checks

Check if your service can safely deploy to an environment:

```bash
# Check if consumer can deploy to staging
entente can-i-deploy \
  --type consumer \
  --service castle-client \
  --service-version 1.2.3 \
  --environment staging

# Check if provider can deploy to production
entente can-i-deploy \
  --type provider \
  --service castle-service \
  --service-version 2.1.0 \
  --environment production
```

### Recording Deployments

Record when services are deployed to environments:

```bash
# Record consumer deployment
entente deploy-service \
  --name castle-client \
  --service-version 1.2.3 \
  --environment staging \
  --type consumer

# Record provider deployment
entente deploy-service \
  --name castle-service \
  --service-version 2.1.0 \
  --environment production \
  --type provider
```

### Fixture Management

```bash
# List fixtures for a service
entente fixtures list --service castle-service

# Approve fixtures (coming soon)
entente fixtures approve --service castle-service --fixture-id abc123
```

### Environment Status

```bash
# Show deployment status for an environment
entente status --environment staging
```

### Integration with package.json

Add common commands to your package.json scripts:

```json
{
  "scripts": {
    "entente:register": "entente register-service --type consumer --name castle-client --environment test",
    "entente:can-deploy": "entente can-i-deploy --type consumer --service castle-client --environment staging",
    "entente:deploy": "entente deploy-service --name castle-client --type consumer --environment staging"
  }
}
```

## License

MIT
