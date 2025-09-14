import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './tenants'
import { services } from './services'
import { deployments } from './deployments'

export const serviceDependencies = pgTable('service_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  consumerId: uuid('consumer_id').references(() => services.id), // Relaxed FK constraint
  consumerVersion: varchar('consumer_version', { length: 100 }).notNull(),
  providerId: uuid('provider_id').references(() => services.id), // Relaxed FK constraint
  providerVersion: varchar('provider_version', { length: 100 }).notNull(),
  environment: varchar('environment', { length: 100 }).notNull(),
  deploymentId: uuid('deployment_id').references(() => deployments.id),
  status: varchar('status', { length: 50 }).default('pending_verification').notNull(), // 'pending_verification' | 'verified' | 'failed'
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
  verifiedAt: timestamp('verified_at'),
})

export const serviceDependenciesRelations = relations(serviceDependencies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [serviceDependencies.tenantId],
    references: [tenants.id],
  }),
  consumer: one(services, {
    fields: [serviceDependencies.consumerId],
    references: [services.id],
  }),
  provider: one(services, {
    fields: [serviceDependencies.providerId],
    references: [services.id],
  }),
  deployment: one(deployments, {
    fields: [serviceDependencies.deploymentId],
    references: [deployments.id],
  }),
}))