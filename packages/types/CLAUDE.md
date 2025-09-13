# @entente/types - Claude Development Guide

## Purpose
Shared TypeScript types and interfaces for the entire Entente contract testing platform.

## Key Types
- `ClientInteraction` - Recorded consumer-provider interactions
- `Fixture` - Test data with approval workflow
- `OpenAPISpec` - OpenAPI specification structure
- `VerificationTask` - Provider verification tasks
- `DeploymentState` - Service deployment tracking

## Architecture
- Pure TypeScript interfaces (no runtime code)
- Exported from single `index.ts` file
- Used by all other packages as dependency
- Follows functional programming principles

## Development
```bash
# Build types
pnpm build

# Watch for changes
pnpm dev

# Test types
pnpm test
```

## Usage in Other Packages
```typescript
import type { ClientInteraction, Fixture } from '@entente/types'
```

## Important Notes
- This package has no runtime dependencies
- All types are exported from `src/index.ts`
- Breaking changes here affect all packages
- Keep interfaces minimal and focused
- Use branded types for IDs when needed

## Type Categories
- **Contract Types**: `ClientInteraction`, `VerificationTask`, `VerificationResults`
- **Fixture Types**: `Fixture`, `FixtureProposal`, `FixtureUpdate`
- **Deployment Types**: `DeploymentState`, `ActiveVersion`
- **Config Types**: `ClientConfig`, `ProviderConfig`, `MockOptions`
- **OpenAPI Types**: `OpenAPISpec` and related interfaces
- **CLI Types**: `UploadOptions`, `CanIDeployOptions`, etc.