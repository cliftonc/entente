import { relations } from 'drizzle-orm'
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { deployments } from './deployments'
import { serviceVersions } from './service-versions'
import { services } from './services'
import { tenants } from './tenants'

export const serviceDependencies = pgTable('service_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  consumerId: uuid('consumer_id').references(() => services.id), // Relaxed FK constraint
  consumerVersion: varchar('consumer_version', { length: 100 }).notNull(),
  consumerVersionId: uuid('consumer_version_id').references(() => serviceVersions.id), // New FK to serviceVersions
  providerId: uuid('provider_id').references(() => services.id), // Relaxed FK constraint
  providerVersionId: uuid('provider_version_id').references(() => serviceVersions.id), // New FK to serviceVersions
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
})

export const serviceDependenciesRelations = relations(serviceDependencies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [serviceDependencies.tenantId],
    references: [tenants.id],
  }),
  consumer: one(services, {
    fields: [serviceDependencies.consumerId],
    references: [services.id],
    relationName: 'consumerService',
  }),
  provider: one(services, {
    fields: [serviceDependencies.providerId],
    references: [services.id],
    relationName: 'providerService',
  }),
}))
