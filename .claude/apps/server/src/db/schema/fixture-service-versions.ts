import { relations } from 'drizzle-orm'
import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core'
import { fixtures } from './fixtures'
import { serviceVersions } from './service-versions'
import { tenants } from './tenants'

export const fixtureServiceVersions = pgTable(
  'fixture_service_versions',
  {
    fixtureId: uuid('fixture_id')
      .references(() => fixtures.id, { onDelete: 'cascade' })
      .notNull(),
    serviceVersionId: uuid('service_version_id')
      .references(() => serviceVersions.id, { onDelete: 'cascade' })
      .notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.fixtureId, table.serviceVersionId] }),
  })
)

// Relations
export const fixtureServiceVersionsRelations = relations(fixtureServiceVersions, ({ one }) => ({
  fixture: one(fixtures, {
    fields: [fixtureServiceVersions.fixtureId],
    references: [fixtures.id],
  }),
  serviceVersion: one(serviceVersions, {
    fields: [fixtureServiceVersions.serviceVersionId],
    references: [serviceVersions.id],
  }),
}))

// Define fixtures relations here to avoid circular imports
export const fixturesRelations = relations(fixtures, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [fixtures.tenantId],
    references: [tenants.id],
  }),
  fixtureServiceVersions: many(fixtureServiceVersions),
}))

// Add relation to serviceVersions for completeness
export const serviceVersionsFixturesRelations = relations(serviceVersions, ({ many }) => ({
  fixtureServiceVersions: many(fixtureServiceVersions),
}))