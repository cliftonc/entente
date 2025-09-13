import { pgTable, uuid, varchar, timestamp, jsonb, integer } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  service: varchar('service', { length: 255 }).notNull(),
  serviceVersion: varchar('service_version', { length: 100 }).notNull(),
  consumer: varchar('consumer', { length: 255 }).notNull(),
  consumerVersion: varchar('consumer_version', { length: 100 }).notNull(),
  environment: varchar('environment', { length: 100 }).notNull(),
  operation: varchar('operation', { length: 255 }).notNull(),
  request: jsonb('request').notNull(),
  response: jsonb('response').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  duration: integer('duration').notNull(),
  clientInfo: jsonb('client_info').notNull(),
})