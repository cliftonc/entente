import { pgTable, uuid, varchar, timestamp, jsonb, integer, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { services } from './services'

export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  providerId: uuid('provider_id').references(() => services.id),
  consumerId: uuid('consumer_id').references(() => services.id),
  service: varchar('service', { length: 255 }).notNull(), // Keep for backward compatibility
  consumer: varchar('consumer', { length: 255 }).notNull(), // Keep for backward compatibility
  consumerVersion: varchar('consumer_version', { length: 100 }).notNull(),
  consumerGitSha: varchar('consumer_git_sha', { length: 40 }), // Git SHA for the consumer
  environment: varchar('environment', { length: 100 }).notNull(),
  operation: varchar('operation', { length: 255 }).notNull(),
  request: jsonb('request').notNull(),
  response: jsonb('response').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  duration: integer('duration').notNull(),
  clientInfo: jsonb('client_info').notNull(),
  hash: varchar('hash', { length: 255 }),
}, (table) => ({
  // Unique constraint to prevent duplicate interactions within a tenant
  tenantHashUnique: unique().on(table.tenantId, table.hash)
}))