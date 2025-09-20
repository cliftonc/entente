import { relations, sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { services, specTypeEnum } from './services'
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

    // Support for different specification types
    specType: specTypeEnum('spec_type').default('openapi'), // enum spec type - optional for versions

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
    // Check constraint for valid spec types
    specTypeCheck: check(
      'service_versions_spec_type_check',
      sql`${table.specType} IS NULL OR ${table.specType} IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap')`
    ),
    // Index for better query performance
    specTypeIdx: index('idx_service_versions_spec_type').on(table.specType),
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
