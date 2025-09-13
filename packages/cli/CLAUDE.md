# @entente/cli - Claude Development Guide

## Purpose
Command line interface for Entente contract testing platform. Provides tools for spec management, deployment tracking, and fixture approval.

## Key Features
- OpenAPI spec upload
- Deployment state recording
- Can-I-Deploy safety checks
- Fixture management (approve, list)
- Deployment status monitoring

## Main Commands
- `entente upload-spec` - Upload OpenAPI specification
- `entente record-deployment` - Record service deployment
- `entente can-i-deploy` - Check deployment compatibility
- `entente fixtures approve` - Approve fixture proposals
- `entente fixtures list` - List fixtures by status
- `entente status` - Show deployment status

## Architecture
- Built with Commander.js framework
- Functional command handlers (no classes)
- Uses chalk for colored output
- Depends on @entente/types and @entente/fixtures

## Usage Examples
```bash
# Upload OpenAPI spec
entente upload-spec -s order-service -v 2.1.0 -e production --spec ./openapi.json

# Record deployment
entente record-deployment -s order-service -v 2.1.0 -e production

# Check if safe to deploy
entente can-i-deploy -c web-app -v 1.0.0 -e production

# Approve fixtures from test run
entente fixtures approve --approved-by john.doe --test-run build-123

# List pending fixtures
entente fixtures list --service order-service --status draft
```

## Development
```bash
# Build package
pnpm build

# Watch for changes
pnpm dev

# Test CLI locally
node dist/cli.js --help

# Run tests
pnpm test
```

## Environment Variables
- `ENTENTE_SERVICE_URL` - Central service URL (default: http://localhost:3000)
- `USER` - Default user for deployment recording

## Implementation Status
- ✅ All core commands implemented
- ✅ Colored output with chalk
- ✅ Proper error handling
- ✅ Help text and examples
- ❌ Configuration file support
- ❌ Interactive prompts
- ❌ Command aliases

## Command Structure
```
entente
├── upload-spec        # Upload OpenAPI specs
├── record-deployment  # Track deployments
├── can-i-deploy      # Safety checks
├── fixtures          # Fixture management
│   ├── approve       # Approve proposals
│   └── list          # List by status
└── status            # Environment status
```

## Next Steps
1. Add interactive prompts for missing parameters
2. Implement configuration file support (.ententerc)
3. Add command aliases and shortcuts
4. Create CI/CD integration examples
5. Add shell completion scripts