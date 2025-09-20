import { relations, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { specTypeEnum } from './services'
import { tenants } from './tenants'

export const fixtureStatusEnum = pgEnum('fixture_status', ['draft', 'approved', 'rejected'])
export const fixtureSourceEnum = pgEnum('fixture_source', ['consumer', 'provider', 'manual'])

export const fixtures = pgTable(
  'fixtures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    service: varchar('service', { length: 255 }).notNull(),
    serviceVersion: varchar('service_version', { length: 100 }).notNull(),
    serviceVersions: jsonb('service_versions').notNull(), // Array of versions where this fixture appears

    // NEW: Support for different specification types
    specType: specTypeEnum('spec_type').notNull().default('openapi'), // enum spec type

    operation: varchar('operation', { length: 255 }).notNull(),
    hash: varchar('hash', { length: 64 }).notNull(), // SHA-256 hash for deduplication
    status: fixtureStatusEnum('status').default('draft').notNull(),
    source: fixtureSourceEnum('source').notNull(),
    priority: integer('priority').default(1).notNull(),
    data: jsonb('data').notNull(),
    createdFrom: jsonb('created_from').notNull(),
    approvedBy: varchar('approved_by', { length: 255 }),
    approvedAt: timestamp('approved_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    // Unique constraint to prevent duplicate fixtures within a tenant
    tenantHashUnique: unique().on(table.tenantId, table.hash),
    // Check constraint for valid spec types
    specTypeCheck: check(
      'fixtures_spec_type_check',
      sql`${table.specType} IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap')`
    ),
    // Indexes for better query performance
    specTypeIdx: index('idx_fixtures_spec_type').on(table.specType),
    serviceSpecTypeIdx: index('idx_fixtures_service_spec_type').on(table.service, table.specType),
  })
)

// Relations will be defined in fixture-service-versions.ts to avoid circular imports
