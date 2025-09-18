import { relations } from 'drizzle-orm'
import { jsonb, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { services } from './services'
import { tenants } from './tenants'

export const serviceVersions = pgTable(
  'service_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    serviceId: uuid('service_id')
      .references(() => services.id)
      .notNull(),
    version: varchar('version', { length: 100 }).notNull(),
    spec: jsonb('spec'), // Nullable - OpenAPI spec can be added later
    gitSha: varchar('git_sha', { length: 40 }),
    packageJson: jsonb('package_json'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    // Unique constraint to prevent duplicate versions within tenant+service
    tenantServiceVersionUnique: unique().on(table.tenantId, table.serviceId, table.version),
  })
)

// Relations
export const serviceVersionsRelations = relations(serviceVersions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [serviceVersions.tenantId],
    references: [tenants.id],
  }),
  service: one(services, {
    fields: [serviceVersions.serviceId],
    references: [services.id],
  }),
}))
