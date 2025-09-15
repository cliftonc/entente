import { integer, jsonb, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { contracts } from './contracts'
import { services } from './services'
import { tenants } from './tenants'

export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    contractId: uuid('contract_id').references(() => contracts.id), // Optional - will be populated over time
    providerId: uuid('provider_id').references(() => services.id),
    consumerId: uuid('consumer_id').references(() => services.id),
    service: varchar('service', { length: 255 }).notNull(), // Keep for backward compatibility
    consumer: varchar('consumer', { length: 255 }).notNull(), // Keep for backward compatibility
    consumerVersion: varchar('consumer_version', { length: 100 }).notNull(),
    consumerGitSha: varchar('consumer_git_sha', { length: 40 }), // Git SHA for the consumer
    providerVersion: varchar('provider_version', { length: 100 }).notNull(), // Provider deployment version
    environment: varchar('environment', { length: 100 }).notNull(),
    operation: varchar('operation', { length: 255 }).notNull(),
    request: jsonb('request').notNull(),
    response: jsonb('response').notNull(),
    timestamp: timestamp('timestamp').notNull(),
    duration: integer('duration').notNull(),
    clientInfo: jsonb('client_info').notNull(),
    hash: varchar('hash', { length: 255 }),
  },
  table => ({
    // Unique constraint to prevent duplicate interactions within a tenant
    tenantHashUnique: unique().on(table.tenantId, table.hash),
  })
)
