import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { services, specTypeEnum } from './services'
import { tenants } from './tenants'

export const specs = pgTable(
  'specs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    providerId: uuid('provider_id')
      .references(() => services.id)
      .notNull(),
    service: varchar('service', { length: 255 }).notNull(), // Keep for backward compatibility
    version: varchar('version', { length: 100 }).notNull(),
    branch: varchar('branch', { length: 255 }).notNull(),

    // NEW: Support for different specification types
    specType: specTypeEnum('spec_type').notNull().default('openapi'), // enum spec type

    spec: jsonb('spec').notNull(), // Can store any spec type as JSON
    uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  },
  table => ({
    // Check constraint for valid spec types
    specTypeCheck: check(
      'specs_spec_type_check',
      sql`${table.specType} IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap')`
    ),
    // Indexes for better query performance
    specTypeIdx: index('idx_specs_spec_type').on(table.specType),
    serviceSpecTypeIdx: index('idx_specs_service_spec_type').on(table.service, table.specType),
  })
)
