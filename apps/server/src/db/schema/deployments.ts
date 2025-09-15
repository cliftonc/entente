import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { services } from './services'
import { tenants } from './tenants'

export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'provider' | 'consumer'
  serviceId: uuid('service_id').references(() => services.id), // Unified reference to services
  service: varchar('service', { length: 255 }).notNull(), // Keep for backward compatibility
  version: varchar('version', { length: 100 }).notNull(),
  gitSha: varchar('git_sha', { length: 40 }), // Git SHA for this deployment
  environment: varchar('environment', { length: 100 }).notNull(),
  deployedAt: timestamp('deployed_at').notNull(),
  deployedBy: varchar('deployed_by', { length: 255 }).notNull(),
  active: boolean('active').default(true).notNull(),
  status: varchar('status', { length: 20 }).default('successful').notNull(), // 'attempted' | 'successful' | 'failed'
  failureReason: text('failure_reason'), // Human-readable failure reason
  failureDetails: jsonb('failure_details'), // Full details (e.g., CanIDeployResult)
})
