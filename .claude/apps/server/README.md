# @entente/server

Central Entente service providing both REST API and admin web interface. This application implements the core ContractFlow specification as a centralized contract testing service with Hono backend (Cloudflare Worker compatible) and React admin dashboard.

## Overview

The server is the heart of the Entente system, providing centralized contract management, interaction recording, fixture approval workflow, deployment tracking, and verification coordination. It implements all the ContractFlow service API endpoints and provides a modern web interface for managing the contract testing ecosystem.

## Architecture

### Backend (Hono API)
- **Framework**: Hono (Cloudflare Worker compatible)
- **Database**: Configured for Neon PostgreSQL (currently using mock data)
- **Deployment**: Both local Node.js development and Cloudflare Workers production

### Frontend (React Admin UI)
- **Framework**: React 18+ with functional components
- **Styling**: Tailwind CSS + DaisyUI with custom "entente" theme
- **Layout**: Admin dashboard with left navigation and top menu bar
- **Routing**: React Router for SPA navigation

## ContractFlow API Implementation

The server implements the complete ContractFlow service API specification:

### Spec Management
- `POST /specs/:service` - Upload OpenAPI specification
- `GET /specs/:service` - Get OpenAPI specification
- `GET /specs/:service/versions` - List available versions

### Interaction Recording  
- `POST /interactions` - Record client interaction
- `GET /interactions/:service` - Get recorded interactions
- `GET /interactions/:service/stats` - Get interaction statistics

### Fixture Management
- `POST /fixtures` - Propose new fixture
- `GET /fixtures/:operation` - Get fixtures for operation
- `GET /fixtures/service/:service` - Get fixtures by service
- `GET /fixtures/pending` - Get pending fixtures
- `POST /fixtures/:id/approve` - Approve fixture
- `PUT /fixtures/:id` - Update fixture
- `DELETE /fixtures/:id` - Delete fixture

### Deployment Tracking
- `POST /deployments` - Update deployment state  
- `GET /deployments/active` - Get active versions by environment
- `GET /deployments/:service/history` - Get deployment history
- `GET /deployments/summary` - Get deployment dashboard summary

### Provider Verification
- `GET /verification/:provider` - Get verification tasks
- `POST /verification/:provider` - Submit verification results
- `GET /verification/:provider/history` - Get verification history
- `GET /verification/:provider/stats` - Get verification statistics

### Safety Checks
- `GET /can-i-deploy` - Check deployment compatibility

## Admin UI Features

### Dashboard
- Service health overview with pass rates
- Recent deployments and activity
- Fixture approval status
- Quick action buttons
- System metrics and charts

### Services Page
- Service catalog with OpenAPI specs
- Version management and branching
- Consumer/provider relationships
- Environment deployment status

### Interactions Page  
- Recorded consumer interactions
- Filtering by service, consumer, operation
- Interaction details and timing
- Usage patterns and analytics

### Fixtures Page
- Pending fixture approval queue
- Bulk approval operations
- Fixture history and versioning
- Priority and source management

### Deployments Page
- Active deployments per environment
- Deployment history and tracking
- Environment health status
- Deployment pipeline integration

### Verification Page
- Provider verification results
- Pass/fail rates and trends
- Verification task management
- Detailed failure analysis

## Implementation Status

### ✅ Complete
- Complete Hono API with all ContractFlow endpoints
- React admin UI with responsive design
- Admin layout with left navigation and top menu
- All page components with mock data
- Cloudflare Workers deployment configuration
- Development/production environment separation
- TypeScript throughout with proper typing

### 🔄 In Progress  
- Mock data responses (functional but not persistent)

### ❌ TODO - High Priority
1. **Neon PostgreSQL Integration**: Replace mock data with real database
   - Database schema design and migrations
   - Connection pooling and query optimization
   - Data persistence for all entities

2. **Authentication System**: User login/logout and permissions
   - JWT/session-based authentication
   - Role-based access control (admin, developer, viewer)
   - Integration with identity providers (OAuth, SAML)

3. **File Upload Handling**: OpenAPI spec file uploads
   - Multipart form handling in Hono
   - File validation and storage
   - Spec parsing and validation

4. **Real-time Updates**: WebSocket integration for live updates
   - Fixture approval notifications
   - Deployment status updates
   - Verification result streaming

### ❌ TODO - Medium Priority
5. **Enhanced Error Handling**: Better error pages and API responses
   - Custom error pages for 404, 500, etc.
   - Structured API error responses
   - Client-side error boundaries

6. **Advanced Analytics**: Usage analytics and reporting
   - Service usage trends
   - Consumer/provider relationship graphs
   - Performance metrics and insights

7. **API Documentation**: OpenAPI spec for the service itself
   - Auto-generated API documentation
   - Interactive API explorer
   - Client SDK generation

### ❌ TODO - Lower Priority  
- Comprehensive test suites (unit, integration, E2E)
- Performance optimization and caching
- Advanced search and filtering
- Data export and backup functionality
- Monitoring and observability integration

## Development

### Local Development
```bash
# Start both API and UI in development mode
pnpm dev

# Start API only (Node.js server on port 3001)  
pnpm dev:api

# Start UI only (Vite dev server on port 3000)
pnpm dev:ui

# Start API as Cloudflare Worker (for testing worker features)
pnpm dev:api:worker
```

### Production Build
```bash
# Build both API and UI for production
pnpm build

# Build API for Cloudflare Workers deployment
pnpm build:api

# Build UI static files
pnpm build:ui

# Deploy to Cloudflare Workers
pnpm deploy
```

## Configuration

### Environment Variables
- `NODE_ENV` - Environment mode (development, production)
- `ENTENTE_DATABASE_URL` - Neon PostgreSQL connection string
- `ENTENTE_JWT_SECRET` - JWT signing secret for authentication

### Cloudflare Workers Configuration (wrangler.toml)
```toml
name = "entente-server"
main = "src/api/index.ts"
compatibility_date = "2024-12-02"
compatibility_flags = ["nodejs_compat"]

[vars]
NODE_ENV = "production"

# Database bindings would be configured here
# [[d1_databases]]
# binding = "DB" 
# database_name = "entente-production"
# database_id = "your-database-id"
```

### UI Theme Configuration (Tailwind + DaisyUI)
Custom "entente" theme with:
- Primary: Blue (#3b82f6)
- Secondary: Green (#10b981)  
- Accent: Amber (#f59e0b)
- Professional admin color palette

## API Examples

### Upload OpenAPI Spec
```javascript
POST /specs/order-service
Content-Type: application/json

{
  "spec": { /* OpenAPI 3.1 specification */ },
  "metadata": {
    "service": "order-service",
    "version": "2.1.0", 
    "branch": "main",
    "environment": "production",
    "uploadedBy": "developer",
    "uploadedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Record Interaction
```javascript
POST /interactions
Content-Type: application/json

{
  "service": "order-service",
  "serviceVersion": "2.1.0",
  "consumer": "web-app", 
  "consumerVersion": "1.0.0",
  "environment": "test",
  "operation": "getOrder",
  "request": {
    "method": "GET",
    "path": "/orders/123",
    "headers": { "Content-Type": "application/json" }
  },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "body": { "id": "123", "total": 99.99 }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "duration": 150
}
```

### Check Deployment Safety
```javascript
GET /can-i-deploy?consumer=web-app&version=1.5.0&environment=production

Response:
{
  "canDeploy": true,
  "compatibleProviders": [
    {
      "service": "order-service", 
      "version": "2.1.0",
      "verified": true,
      "interactionCount": 15
    }
  ],
  "message": "All provider verifications passed"
}
```

## Database Schema (Planned)

Key entities for Neon PostgreSQL integration:

### specs
- service, version, branch, environment
- spec_content (JSONB)
- uploaded_by, uploaded_at

### interactions  
- service, service_version, consumer, consumer_version
- operation, request_data, response_data (JSONB)
- environment, timestamp, duration

### fixtures
- service, service_version, operation
- status, source, priority
- data (JSONB), created_from (JSONB)
- approved_by, approved_at, notes

### deployments
- service, version, environment
- deployed_at, deployed_by, active

### verification_results
- provider, provider_version, task_id
- results (JSONB), submitted_at

## ContractFlow Specification Alignment

This server implements ContractFlow's core principles:

- **Centralized Contract Management**: Single service manages all specs, interactions, fixtures
- **Schema-First Always**: OpenAPI specs uploaded before implementation
- **Automatic Recording**: Transparent interaction capture from consumers
- **Provider Verification**: Coordinated verification against recorded interactions
- **Deployment Awareness**: Active version tracking across environments
- **CI-Only Recording**: Optimized for CI build integration
- **Fixture Approval Workflow**: Team-based fixture management

## Deployment

### Local Development
Uses Node.js with `@hono/node-server` for fast development with hot reload.

### Production (Cloudflare Workers)
Deploys as serverless Cloudflare Worker with:
- Automatic scaling and global distribution
- Neon PostgreSQL database connection
- Custom domain and SSL termination
- Edge caching for static assets

The server architecture supports both deployment models seamlessly, with environment-specific optimizations for development speed and production performance.

## Dependencies

### Backend
- `hono` - Lightweight web framework for Cloudflare Workers
- `@hono/node-server` - Node.js adapter for local development
- `@entente/types` - Shared type definitions
- `@entente/fixtures` - Fixture management utilities

### Frontend  
- `react` - UI library with functional components
- `react-router-dom` - Client-side routing
- `tailwindcss` - Utility-first CSS framework
- `daisyui` - Component library for Tailwind

### Development
- `vite` - Fast build tool and development server
- `typescript` - Type safety throughout
- `tsx` - TypeScript execution for development
- `wrangler` - Cloudflare Workers CLI