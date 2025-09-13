# Drizzle + Neon Database Integration Plan

## Overview
This document outlines the plan for integrating Drizzle ORM with Neon PostgreSQL into the Entente server, adding multi-tenancy support and proper schema management.

## 1. Dependencies
- **drizzle-orm** - TypeScript ORM for PostgreSQL
- **@neondatabase/serverless** - Neon database driver for serverless environments
- **drizzle-kit** - Migration and schema management tool
- **dotenv** - Environment variable management

## 2. Environment Configuration
Create `.env` file with:
```env
DATABASE_URL=postgresql://neondb_owner:npg_G9aztXMoO3Hu@ep-plain-smoke-ag435cia-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
NODE_ENV=development
```

## 3. Database Schema Design (Multi-tenant)

### Core Tables with tenantId:

#### **tenants**
- `id` (uuid, primary key)
- `name` (varchar, not null)
- `slug` (varchar, unique, not null)
- `createdAt` (timestamp, default now)
- `updatedAt` (timestamp, default now)

#### **users**
- `id` (uuid, primary key)
- `tenantId` (uuid, foreign key to tenants.id)
- `email` (varchar, unique, not null)
- `name` (varchar, not null)
- `createdAt` (timestamp, default now)
- `updatedAt` (timestamp, default now)

#### **specs**
- `id` (uuid, primary key)
- `tenantId` (uuid, foreign key to tenants.id)
- `service` (varchar, not null)
- `version` (varchar, not null)
- `branch` (varchar, not null)
- `environment` (varchar, not null)
- `spec` (jsonb, not null) - OpenAPI specification
- `uploadedBy` (varchar, not null)
- `uploadedAt` (timestamp, default now)

#### **interactions**
- `id` (uuid, primary key)
- `tenantId` (uuid, foreign key to tenants.id)
- `service` (varchar, not null)
- `serviceVersion` (varchar, not null)
- `consumer` (varchar, not null)
- `consumerVersion` (varchar, not null)
- `environment` (varchar, not null)
- `operation` (varchar, not null)
- `request` (jsonb, not null)
- `response` (jsonb, not null)
- `timestamp` (timestamp, not null)
- `duration` (integer, not null)
- `clientInfo` (jsonb, not null)

#### **fixtures**
- `id` (uuid, primary key)
- `tenantId` (uuid, foreign key to tenants.id)
- `service` (varchar, not null)
- `serviceVersion` (varchar, not null)
- `operation` (varchar, not null)
- `status` (enum: 'draft', 'approved', 'deprecated')
- `source` (enum: 'consumer', 'provider', 'manual')
- `priority` (integer, default 1)
- `data` (jsonb, not null)
- `createdFrom` (jsonb, not null)
- `approvedBy` (varchar, nullable)
- `approvedAt` (timestamp, nullable)
- `notes` (text, nullable)
- `createdAt` (timestamp, default now)

#### **deployments**
- `id` (uuid, primary key)
- `tenantId` (uuid, foreign key to tenants.id)
- `service` (varchar, not null)
- `version` (varchar, not null)
- `environment` (varchar, not null)
- `deployedAt` (timestamp, not null)
- `deployedBy` (varchar, not null)
- `active` (boolean, default true)

#### **verification_tasks**
- `id` (uuid, primary key)
- `tenantId` (uuid, foreign key to tenants.id)
- `provider` (varchar, not null)
- `providerVersion` (varchar, not null)
- `consumer` (varchar, not null)
- `consumerVersion` (varchar, not null)
- `environment` (varchar, not null)
- `interactions` (jsonb, not null)
- `createdAt` (timestamp, default now)

#### **verification_results**
- `id` (uuid, primary key)
- `tenantId` (uuid, foreign key to tenants.id)
- `taskId` (uuid, foreign key to verification_tasks.id)
- `provider` (varchar, not null)
- `providerVersion` (varchar, not null)
- `results` (jsonb, not null)
- `submittedAt` (timestamp, default now)

## 4. File Structure
```
apps/server/
├── .env                     # Environment variables
├── .env.example            # Example environment file
├── drizzle.config.ts       # Drizzle configuration
├── src/
│   ├── db/
│   │   ├── client.ts      # Database client
│   │   ├── schema/
│   │   │   ├── index.ts   # Export all schemas
│   │   │   ├── tenants.ts # Tenant table
│   │   │   ├── users.ts   # User table
│   │   │   ├── specs.ts   # Specs table
│   │   │   ├── interactions.ts
│   │   │   ├── fixtures.ts
│   │   │   ├── deployments.ts
│   │   │   └── verification.ts
│   │   └── utils.ts       # DB utilities
│   └── api/
│       └── routes/        # Updated routes with DB
└── migrations/            # Generated migrations
```

## 5. Implementation Steps

1. **Install Dependencies**
   ```bash
   pnpm add drizzle-orm @neondatabase/serverless dotenv
   pnpm add -D drizzle-kit
   ```

2. **Environment Setup**
   - Create `.env` and `.env.example`
   - Update `.gitignore`

3. **Database Configuration**
   - Setup `drizzle.config.ts`
   - Create database client in `src/db/client.ts`

4. **Schema Definition**
   - Create all table schemas in `src/db/schema/`
   - Export schemas from `src/db/schema/index.ts`

5. **Migration Setup**
   - Add migration scripts to `package.json`
   - Generate initial migration
   - Run migration against Neon database

6. **Update API Routes**
   - Replace mock data with database queries
   - Add tenant isolation
   - Update all route handlers

7. **Database Utilities**
   - Transaction helpers
   - Tenant middleware
   - Health check updates

## 6. Multi-Tenancy Implementation

### Tenant Isolation Strategy:
- Every table includes `tenantId` foreign key
- All queries filtered by tenant context
- Middleware to extract and validate tenant from request
- Row-level security through application logic

### Tenant Context:
```typescript
interface TenantContext {
  tenantId: string
  tenantSlug: string
}
```

## 7. Migration Commands
Add to `package.json`:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:push": "drizzle-kit push"
  }
}
```

## 8. Connection Details
- **Local Development**: Direct connection to Neon
- **Cloudflare Workers**: Use connection pooling
- **Environment Variables**: Secure credential management

## 9. Testing Strategy
- Database integration tests
- Multi-tenant isolation verification
- Migration rollback testing
- Performance testing with realistic data

## 10. Security Considerations
- Environment variable security
- Connection string encryption
- Query injection prevention via Drizzle
- Tenant data isolation validation