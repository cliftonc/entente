# Entente Examples - French Castle Services

This directory contains example services demonstrating Entente's contract testing capabilities using a simple French castle management domain.

## Overview

The examples showcase:
- **OpenAPI-first development** with schema-driven mocking
- **Consumer-driven contract testing** with automatic interaction recording
- **Provider verification** against real consumer interactions
- **Smart fixture workflow** for deterministic testing
- **CLI integration** for deployment safety checks

## Services

### 🏰 Castle Service (Provider)
A REST API for managing French castles with CRUD operations.

**Location:** `castle-service/`
**Port:** 4001
**Type:** Provider service

**Endpoints:**
- `GET /castles` - List all castles
- `GET /castles/:id` - Get castle by ID
- `POST /castles` - Create new castle
- `DELETE /castles/:id` - Delete castle
- `GET /docs` - Swagger UI documentation
- `GET /openapi.json` - OpenAPI specification
- `GET /` - Redirects to docs

**Features:**
- OpenAPI 3.0 specification with Swagger UI
- Hono-based implementation
- In-memory database with seed data
- Interactive API documentation at `/docs`
- Provider verification tests using `@entente/provider`

### 🏰 Castle Client (Consumer)
A service that consumes castle-service to provide heritage tourism features.

**Location:** `castle-client/`
**Port:** 4002
**Type:** Consumer service

**Endpoints:**
- `GET /french-heritage` - Aggregated heritage data
- `GET /heritage/regions/:region` - Castles by region
- `GET /heritage/oldest` - Oldest castles
- `POST /heritage/recommend` - Castle recommendations
- `GET /heritage/castle/:id` - Enhanced castle details

**Features:**
- Consumes castle-service API
- Consumer contract tests using `@entente/consumer`
- Mock server integration for isolated testing
- Automatic interaction recording in CI

## Domain Model

```typescript
interface Castle {
  id: string;           // UUID
  name: string;         // e.g., "Château de Versailles"
  region: string;       // e.g., "Île-de-France"
  yearBuilt: number;    // e.g., 1623
}
```

**Sample Data:**
- Château de Versailles (Île-de-France, 1623)
- Château de Fontainebleau (Île-de-France, 1137)
- Château de Chambord (Centre-Val de Loire, 1519)

## Quick Start

### Prerequisites
- Node.js 24+
- pnpm 9+
- Entente server running (see main README)

### 1. Install Dependencies
```bash
# From the examples directory
cd castle-service && pnpm install
cd ../castle-client && pnpm install
```

### 2. Configure Environment Variables
Copy the example environment files and configure them:

```bash
# Castle Service
cd castle-service
cp .env.example .env
# Edit .env with your Entente API key

# Castle Client
cd ../castle-client
cp .env.example .env
# Edit .env with your Entente API key
```

**Required Environment Variables:**
- `ENTENTE_SERVICE_URL` - URL of your Entente server (default: http://localhost:3000)
- `ENTENTE_API_KEY` - Your API key from the Entente server (get one via `entente login`)

### 3. Start Services

**Terminal 1 - Castle Service:**
```bash
cd castle-service
pnpm dev
# Runs on http://localhost:4001
```

**Terminal 2 - Castle Client:**
```bash
cd castle-client
pnpm dev
# Runs on http://localhost:4002
```

### 4. Register Services (New Model)

**One-time setup with the new explicit provider/consumer model:**

```bash
# Terminal 1 - Register castle-service as provider
cd castle-service
pnpm register:provider
# ✅ Registers provider with package.json metadata
# ✅ Uploads OpenAPI spec to central service

# Terminal 2 - Register castle-client as consumer
cd castle-client
pnpm register:consumer
# ✅ Registers consumer with package.json metadata
```

### 5. Test the Services

**Castle Service:**
```bash
curl http://localhost:4001/castles
curl http://localhost:4001/health

# View interactive API documentation
open http://localhost:4001/docs
# or: curl http://localhost:4001/openapi.json
```

**Castle Client:**
```bash
curl http://localhost:4002/french-heritage
curl http://localhost:4002/heritage/regions/Île-de-France
curl http://localhost:4002/health
```

## Contract Testing Workflow

### New Explicit Provider/Consumer Model

Entente now uses an explicit provider/consumer model with deployment-time dependency registration:

**1. Registration (One-time setup):**
```bash
# Register providers with OpenAPI specs
cd castle-service && pnpm register:provider

# Register consumers with package.json
cd castle-client && pnpm register:consumer
```

**2. Development & Testing:**
```bash
# Consumer tests create mocks (no dependency registration)
cd castle-client && pnpm test:consumer

# Provider tests verify against recorded interactions
cd castle-service && pnpm test:provider
```

**3. Deployment:**
```bash
# Deploy provider
cd castle-service && pnpm deploy:provider

# Deploy consumer WITH dependency declaration
cd castle-client && pnpm deploy:consumer
# This registers the dependency and creates verification tasks
```

**4. Verification:**
```bash
# Provider runs verification against consumer dependencies
cd castle-service && pnpm test:provider
# Updates dependency status to 'verified' or 'failed'
```

### Legacy Workflow (Still Supported)

### 1. Consumer Tests (Client)
```bash
cd castle-client
pnpm test:consumer
```

**What happens:**
- Creates mock server from castle-service OpenAPI spec
- Runs tests against mock (fast, isolated)
- Records interactions in CI environment
- Validates response structures match schema
- Proposes fixtures from successful interactions

### 2. Provider Tests (Service)
```bash
cd castle-service
pnpm test:provider
```

**What happens:**
- Fetches recorded consumer interactions
- Replays requests against real service
- Validates response structure compatibility
- Sets up state using fixtures or handlers
- Proposes fixtures from successful verifications

### 3. Full Contract Testing Flow

**Development (Local):**
```bash
# Consumer tests use schema mocking (fast)
cd castle-client && pnpm test:consumer

# Provider tests verify against any recorded interactions
cd castle-service && pnpm test:provider
```

**CI Environment:**
```bash
# Set recording flag
export CI=true

# Consumer tests record real interactions
cd castle-client && pnpm test:consumer

# Provider tests verify compatibility
cd castle-service && pnpm test:provider

# Check deployment safety
pnpm can-i-deploy
```

## CLI Usage Examples

### Registration & Setup (One-time)
```bash
# Register castle-service provider with OpenAPI spec
cd castle-service
pnpm register:provider
# Registers provider AND uploads OpenAPI spec in one command

# Register castle-client consumer
cd castle-client
pnpm register:consumer
# Registers consumer with package.json metadata
```

### Deployment Workflow
```bash
# Deploy castle-service provider
cd castle-service
pnpm deploy:provider

# Deploy castle-client consumer (with dependencies)
cd castle-client
pnpm deploy:consumer
# Automatically registers dependency on castle-service:1.0.0
# Creates verification tasks from recorded interactions
```

### Legacy Commands (Still Supported)
```bash
# Upload specs individually
cd castle-service
pnpm upload:spec

# Record deployments (legacy)
cd castle-service
pnpm record:deployment
```

### Deployment Safety Checks
```bash
# Check if castle-client can deploy safely
cd castle-client
pnpm can-i-deploy

# Or use CLI directly
entente can-i-deploy \
  --consumer castle-client \
  --version 1.0.0 \
  --environment test
```

### Fixture Management
```bash
# List pending fixtures
entente fixtures list --service castle-service

# Approve fixtures from test run
entente fixtures approve \
  --approved-by john.doe \
  --test-run build-123

# Check deployment status
entente status --environment test
```

## Key Contract Testing Concepts

### 🎯 OpenAPI-First Development
- Services start with OpenAPI specifications
- Specs drive both implementation and testing
- Interactive Swagger UI documentation served automatically
- Central repository for all API contracts

### 🔄 Consumer-Driven Contracts
- Consumers drive the contract through their usage
- Real interactions recorded automatically in CI
- Providers verify against actual consumer needs

### 📋 Smart Fixture Workflow
1. **First Run:** Schema-based dynamic mocking
2. **CI Recording:** Captures real responses
3. **Fixture Approval:** Team approves proposed fixtures
4. **Subsequent Runs:** Deterministic fixture-based mocking

### 🛡️ Deployment Safety
- `can-i-deploy` checks compatibility before deployment
- Only deploy consumers verified against active providers
- Prevents breaking changes from reaching production

## Architecture Highlights

### Functional Programming
- No classes, only functions and interfaces
- Immutable data structures
- Pure functions for core logic

### Zero Configuration Recording
- Automatic in CI environments (`CI=true`)
- No developer intervention required
- Background interaction collection

### Response Structure Validation
- Validates structure, not exact values
- Allows for dynamic data while ensuring compatibility
- Supports schema evolution and backwards compatibility

## Testing Philosophy

### Consumer Tests Focus On
- ✅ Response structure validation
- ✅ Error handling contracts
- ✅ Schema compliance
- ✅ Integration with mock service

### Provider Tests Focus On
- ✅ Honoring recorded consumer interactions
- ✅ Response compatibility
- ✅ State setup and teardown
- ✅ Fixture generation

### What's NOT Tested
- ❌ Exact response values (too brittle)
- ❌ Implementation details
- ❌ Database-specific logic
- ❌ Infrastructure concerns

## Common Commands

### Development
```bash
# Start services
pnpm dev

# Run all tests
pnpm test

# Build for production
pnpm build
```

### Contract Testing
```bash
# Consumer contract tests
pnpm test:consumer

# Provider verification tests
pnpm test:provider

# Registration (one-time)
pnpm register:provider    # For castle-service
pnpm register:consumer    # For castle-client

# Deployment
pnpm deploy:provider      # For castle-service
pnpm deploy:consumer      # For castle-client (with dependencies)

# Legacy commands (still supported)
pnpm upload:spec
pnpm record:deployment
pnpm can-i-deploy
```

### Debugging
```bash
# Check service health
curl http://localhost:4001/health
curl http://localhost:4002/health

# View API documentation
open http://localhost:4001/docs

# View OpenAPI spec
curl http://localhost:4001/openapi.json
# or: cat castle-service/spec/openapi.json

# Check fixture status
entente fixtures list --service castle-service
```

## Environment Variables

```bash
# Entente configuration
ENTENTE_SERVICE_URL=http://localhost:3000
ENTENTE_API_KEY=your-api-key

# Service configuration
PORT=4001                          # Castle service port
CASTLE_SERVICE_URL=http://localhost:4001  # Client service dependency

# Contract testing
CI=true                           # Enable interaction recording
```

## Troubleshooting

### Mock Server Issues
- Ensure OpenAPI spec is valid JSON
- Check that Entente server is running
- Verify API key is configured

### Provider Verification Failures
- Check that consumer tests have run in CI
- Verify provider service is accessible
- Review state setup in test handlers

### CLI Command Failures
- Run `entente login` to authenticate
- Check Entente server connectivity
- Verify service and version names match

## Next Steps

1. **Extend the Domain:** Add more castle attributes (architect, style, visitors)
2. **Add More Services:** Create a booking service, review service
3. **Advanced Features:** Add pagination, filtering, search capabilities
4. **Real Database:** Replace in-memory storage with persistent database
5. **Authentication:** Add API key or JWT-based authentication

## Additional Resources

- [Entente Documentation](../../README.md)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3)
- [Contract Testing Guide](https://martinfowler.com/articles/consumerDrivenContracts.html)
- [Hono Framework](https://hono.dev)