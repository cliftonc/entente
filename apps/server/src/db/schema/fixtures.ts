import { pgTable, uuid, varchar, timestamp, jsonb, integer, pgEnum, text, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const fixtureStatusEnum = pgEnum('fixture_status', ['draft', 'approved', 'rejected'])
export const fixtureSourceEnum = pgEnum('fixture_source', ['consumer', 'provider', 'manual'])

export const fixtures = pgTable('fixtures', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  service: varchar('service', { length: 255 }).notNull(),
  serviceVersion: varchar('service_version', { length: 100 }).notNull(),
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
}, (table) => ({
  // Unique constraint to prevent duplicate fixtures within a tenant
  tenantHashUnique: unique().on(table.tenantId, table.hash)
}))