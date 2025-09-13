import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  service: varchar('service', { length: 255 }).notNull(),
  version: varchar('version', { length: 100 }).notNull(),
  environment: varchar('environment', { length: 100 }).notNull(),
  deployedAt: timestamp('deployed_at').notNull(),
  deployedBy: varchar('deployed_by', { length: 255 }).notNull(),
  active: boolean('active').default(true).notNull(),
})