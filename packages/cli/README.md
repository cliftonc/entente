# @entente/cli

Command line interface for Entente contract testing platform. This package provides CLI tools for managing OpenAPI specifications, recording deployments, checking deployment safety, and managing fixture approvals - implementing the operational aspects of the ContractFlow specification.

## Overview

The CLI enables teams to integrate Entente into their CI/CD pipelines and day-to-day workflows. It supports the complete ContractFlow workflow: spec upload, deployment tracking, safety checks, and fixture management.

## Installation

```bash
# Install globally
npm install -g @entente/cli

# Or use with npx
npx @entente/cli --help
```

## Core Commands

### Spec Management

#### Upload OpenAPI Specification
```bash
entente upload-spec \
  --service order-service \
  --version 2.1.0 \
  --environment production \
  --spec ./openapi.yaml \
  --branch main
```

Uploads an OpenAPI specification to the central Entente service, following ContractFlow's "Schema-First Always" principle.

### Deployment Management

#### Record Service Deployment
```bash
entente record-deployment \
  --service order-service \
  --version 2.1.0 \
  --environment production \
  --deployed-by ci-cd-bot
```

Records deployment state in the central service, enabling deployment awareness across the testing system.

#### Check Deployment Safety
```bash
entente can-i-deploy \
  --service web-app \
  --version 1.5.0 \
  --environment production \
  --type consumer
```

Example output:
```
✅ web-app v1.5.0 can deploy to production

Compatible with active providers:
  - order-service v2.1.0 ✅ (verified against 15 interactions)
  - payment-service v1.8.0 ✅ (verified against 8 interactions)

Safe to deploy ✅
```

### Fixture Management

#### Approve Fixture Proposals
```bash
# Approve all fixtures from a test run
entente fixtures approve \
  --test-run build-123 \
  --approved-by john.doe

# Approve pending fixtures for a service
entente fixtures approve \
  --service order-service \
  --approved-by team-lead
```

#### List Fixture Proposals
```bash
# List all pending fixtures
entente fixtures list --status draft

# List fixtures for specific service
entente fixtures list \
  --service order-service \
  --status approved
```

### Environment Status

#### Get Deployment Status
```bash
entente status --environment production
```

Shows active deployments in an environment:
```
Active deployments in production:

order-service@2.1.0 (deployed 2024-01-15T10:30:00Z)
payment-service@1.8.0 (deployed 2024-01-14T16:20:00Z)
user-service@3.0.0 (deployed 2024-01-13T09:15:00Z)
```

## Implementation Status

### ✅ Complete
- All core commands implemented (upload-spec, record-deployment, can-i-deploy, fixtures, status)
- Colored output with chalk for improved UX
- Proper error handling and status codes
- Help text and usage examples
- Integration with @entente/fixtures package
- Environment variable support

### 🔄 In Progress
- None - core CLI functionality complete

### ❌ TODO - High Priority
1. **Configuration File Support**: `.ententerc` file for default settings
2. **Interactive Prompts**: Prompt for missing required parameters
3. **Command Aliases**: Short aliases for frequently used commands
4. **Shell Completion**: Bash/Zsh completion scripts
5. **Enhanced Output**: JSON output mode, verbose logging, quiet mode

### ❌ TODO - Lower Priority
- Plugin system for custom commands
- Integration with popular CI/CD platforms
- Advanced filtering and search options
- Fixture diff and preview functionality
- Historical deployment tracking commands

## Configuration

### Environment Variables
- `ENTENTE_SERVICE_URL` - Central service URL
- `ENTENTE_API_KEY` - API key for authentication

### Global Options (Planned)
```bash
entente --config /path/to/.ententerc command
entente --verbose command
entente --json command
entente --quiet command
```

## CI/CD Integration Examples

### GitHub Actions
```yaml
name: Deploy Service
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check if safe to deploy
        run: |
          entente can-i-deploy \
            --service ${{ github.repository }} \
            --version ${{ github.sha }} \
            --environment production \
            --type consumer
      
      - name: Deploy service
        run: ./deploy.sh
        
      - name: Record deployment
        run: |
          entente record-deployment \
            --service ${{ github.repository }} \
            --version ${{ github.sha }} \
            --environment production \
            --deployed-by ${{ github.actor }}
            
      - name: Approve fixtures from build
        run: |
          entente fixtures approve \
            --test-run ${{ github.run_id }} \
            --approved-by ${{ github.actor }}
```

### GitLab CI
```yaml
stages:
  - test
  - deploy

deploy:
  stage: deploy
  script:
    - entente can-i-deploy --service $CI_PROJECT_NAME --version $CI_COMMIT_SHA --environment production --type consumer
    - ./deploy.sh
    - entente record-deployment --service $CI_PROJECT_NAME --version $CI_COMMIT_SHA --environment production
    - entente fixtures approve --test-run $CI_PIPELINE_ID --approved-by $GITLAB_USER_LOGIN
```

## ContractFlow Workflow Integration

The CLI supports the complete ContractFlow workflow:

### 1. Spec Development and Upload
```bash
# Author OpenAPI spec (schema-first)
vim specs/order-service-v2.1.0.openapi.yaml

# Validate spec locally
npx swagger-editor-validate specs/order-service-v2.1.0.openapi.yaml

# Upload to central service (in CI)
entente upload-spec \
  --service order-service \
  --version 2.1.0 \
  --branch main \
  --environment staging \
  --spec specs/order-service-v2.1.0.openapi.yaml
```

### 2. Consumer Testing with Recording
```bash
# Local development (no recording)
npm test

# CI build (with recording)
CI=true ENVIRONMENT=staging npm test
```

### 3. Provider Verification  
```bash
# Provider verifies against all recorded interactions
npm run test:verify

# Or verify specific environment
ENVIRONMENT=staging npm run test:verify
```

### 4. Deployment and State Management
```bash
# Check if safe to deploy
entente can-i-deploy \
  --service order-web \
  --version 1.5.0 \
  --environment production \
  --type consumer

# Deploy service
npm run deploy:production

# Update deployment state
entente record-deployment \
  --service order-service \
  --version 2.1.0 \
  --environment production
```

## Command Reference

### Global Options
- `--help` - Show help information
- `--version` - Show CLI version

### upload-spec
- `--service <name>` - Service name (required)
- `--version <version>` - Service version (required)  
- `--environment <env>` - Target environment (required)
- `--spec <file>` - Path to OpenAPI spec file (required)
- `--branch <branch>` - Git branch (default: main)

### record-deployment
- `--service <name>` - Service name (required)
- `--version <version>` - Service version (required)
- `--environment <env>` - Target environment (required)
- `--deployed-by <user>` - User who deployed (default: $USER)

### can-i-deploy
- `--service <name>` - Service name (required, or defaults from package.json)
- `--version <version>` - Service version (required, or defaults from package.json)
- `--type <type>` - Service type: consumer or provider (required)
- `--environment <env>` - Target environment (required)

### fixtures approve
- `--approved-by <user>` - User approving fixtures (required)
- `--test-run <id>` - Approve all fixtures from test run
- `--service <name>` - Approve fixtures for specific service

### fixtures list
- `--service <name>` - Filter by service
- `--status <status>` - Filter by status (draft, approved, deprecated)

### status
- `--environment <env>` - Environment to check (required)

## ContractFlow Specification Alignment

This package implements ContractFlow's operational principles:

- **Schema-First Always**: Upload specs before implementation
- **Centralized Contract Management**: All operations go through central service
- **Deployment Awareness**: Track active versions across environments
- **CI Integration**: Designed for automated CI/CD workflows
- **Fixture Approval**: Team-based fixture approval process

## Development

```bash
# Build package
pnpm build

# Watch for changes during development
pnpm dev

# Test CLI locally
node dist/cli.js --help

# Run tests
pnpm test
```

## Dependencies

- `@entente/types` - Shared type definitions
- `@entente/fixtures` - Fixture management utilities
- `commander` - CLI framework
- `chalk` - Colored terminal output

The CLI follows functional programming patterns and provides a clean interface for all Entente operations needed in development and CI/CD workflows.