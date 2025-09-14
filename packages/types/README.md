# @entente/types

Shared TypeScript types and interfaces for the Entente contract testing platform. This package implements the core data structures defined in the ContractFlow specification for schema-first contract testing.

## Overview

This package provides all the TypeScript interfaces needed across the Entente ecosystem, ensuring type safety and consistency between consumer testing, provider verification, fixture management, and the central service.

## Key Types

### Core Contract Types
- `ClientInteraction` - Records of real consumer-provider interactions
- `VerificationTask` - Tasks for provider verification against recorded interactions
- `VerificationResults` - Results from provider verification runs

### Fixture Management Types
- `Fixture` - Approved test data with metadata and approval workflow
- `FixtureProposal` - New fixture proposals from test runs
- `FixtureUpdate` - Updates to existing fixtures
- `FixtureData` - Request/response/state data within fixtures

### OpenAPI & Specs
- `OpenAPISpec` - OpenAPI specification structure
- `SpecMetadata` - Metadata for uploaded specifications

### Deployment Tracking
- `DeploymentState` - Service deployment state across environments
- `ActiveVersion` - Currently active service versions per environment

### Configuration Types
- `ClientConfig` - Configuration for consumer testing
- `ProviderConfig` - Configuration for provider verification
- `MockOptions` - Options for mock server creation

## Core Philosophy Implementation

The types reflect ContractFlow's core principles:

- **Schema-First Always**: OpenAPI specs are the single source of truth
- **Centralized Contract Management**: All interactions flow through central service
- **Automatic Recording**: Client interactions captured transparently in CI
- **Provider Verification**: Real-world usage drives verification
- **Deployment Awareness**: Only test against active versions
- **CI-Only Recording**: Local tests fast, CI builds contribute data

## Usage

```typescript
import type { 
  ClientInteraction, 
  Fixture, 
  OpenAPISpec,
  DeploymentState 
} from '@entente/types'

// Use in consumer testing
const interaction: ClientInteraction = {
  id: 'int_123',
  service: 'order-service',
  serviceVersion: '2.1.0',
  consumer: 'web-app',
  consumerVersion: '1.0.0',
  environment: 'test',
  operation: 'getOrder',
  request: { method: 'GET', path: '/orders/123', headers: {} },
  response: { status: 200, headers: {}, body: { id: '123' } },
  timestamp: new Date(),
  duration: 150,
  clientInfo: { library: '@entente/consumer', version: '0.1.0' }
}
```

## Implementation Status

### ✅ Complete
- All core interfaces from ContractFlow specification
- Type-safe HTTP request/response structures
- Comprehensive fixture lifecycle types
- Configuration types for all packages
- OpenAPI integration types

### 🔄 In Progress
- None - types package is feature complete

### ❌ TODO
- Additional utility types as other packages evolve
- Branded types for IDs to prevent mixing
- More specific OpenAPI operation types

## Development

```bash
# Build types
pnpm build

# Watch for changes
pnpm dev

# Run type checking
pnpm test
```

## Dependencies

This package has no runtime dependencies and only dev dependencies for TypeScript compilation. It serves as the foundation for type safety across the entire Entente platform.