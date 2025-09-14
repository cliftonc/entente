# Entente Setup Guide

## Project Structure

```
entente/
├── packages/
│   ├── types/           # Shared TypeScript types
│   ├── consumer/        # Consumer testing library
│   ├── provider/        # Provider verification library
│   ├── fixtures/        # Fixture management utilities
│   └── cli/             # Command line interface
├── apps/
│   └── server/          # Central service (Hono API + React UI)
└── ...config files
```

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Build all packages:**
   ```bash
   pnpm build
   ```

3. **Start the development server:**
   ```bash
   pnpm server:dev
   ```

   This will start:
   - API server on http://localhost:3001
   - React UI on http://localhost:3000

4. **Run tests:**
   ```bash
   pnpm test
   ```

5. **Lint and format:**
   ```bash
   pnpm lint:fix
   pnpm format
   ```

## Development Workflow

### API Development
- API code is in `apps/server/src/api/`
- Uses Hono framework (Cloudflare Worker compatible)
- Routes are organized in `apps/server/src/api/routes/`
- Run API only: `pnpm --filter @entente/server dev:api`

### UI Development
- UI code is in `apps/server/src/ui/`
- Uses React + Vite + Tailwind CSS + DaisyUI
- Admin layout with left navigation and top menu
- Run UI only: `pnpm --filter @entente/server dev:ui`

### Package Development
- Each package has its own `dev` script for TypeScript watching
- Example: `pnpm --filter @entente/consumer dev`

## Package Usage

### Consumer Library (@entente/consumer)
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
// Use mock.url for testing...
await mock.close()
```

### Provider Library (@entente/provider)
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
  }
})
```

### CLI (@entente/cli)
```bash
# Upload OpenAPI spec
entente upload-spec -s order-service -v 2.1.0 -e production --spec ./openapi.json

# Record deployment
entente record-deployment -s order-service -v 2.1.0 -e production

# Check deployment safety
entente can-i-deploy -c web-app -v 1.0.0 -e production

# Approve fixtures
entente fixtures approve --approved-by john.doe --test-run build-123
```

## Configuration

### Environment Variables
- `ENTENTE_SERVICE_URL` - Central service URL (default: http://localhost:3000)
- `CI` - Enable recording mode for client library
- `BUILD_ID` - Build identifier for fixture tracking
- `COMMIT_SHA` - Git commit for traceability

### Cloudflare Workers Deployment
The server is configured for Cloudflare Workers deployment:

1. Install Wrangler CLI: `npm install -g wrangler`
2. Login: `wrangler login`
3. Configure database bindings in `wrangler.toml`
4. Deploy: `pnpm --filter @entente/server deploy`

## Next Steps

1. **Database Integration**: Add Neon PostgreSQL connection to API
2. **Authentication**: Implement user authentication for the admin UI
3. **Real Mock Server**: Integrate Prism for OpenAPI-based mocking
4. **Notifications**: Add real-time notifications for fixture approvals
5. **Advanced Features**: Contract visualization, analytics, reporting

## Architecture Highlights

- **TypeScript-First**: Strong typing throughout the codebase
- **Functional Design**: No classes, composable functions
- **Cloud-Native**: Deployable as Cloudflare Worker
- **Modern UI**: React with Tailwind CSS and DaisyUI
- **Monorepo**: pnpm workspace with proper cross-package dependencies
- **OpenAPI-Centric**: All contracts start with OpenAPI specifications
- **Fixture System**: Smart test data management with approval workflow