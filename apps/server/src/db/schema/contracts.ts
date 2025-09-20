import { relations, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { interactions } from './interactions'
import { serviceVersions } from './service-versions'
import { specTypeEnum } from './services'
import { services } from './services'
import { tenants } from './tenants'
import { verificationTasks } from './verification'

export const contracts = pgTable(
  'contracts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    // Consumer information
    consumerId: uuid('consumer_id')
      .references(() => services.id)
      .notNull(),
    consumerName: varchar('consumer_name', { length: 255 }).notNull(), // Denormalized for performance
    consumerVersion: varchar('consumer_version', { length: 100 }).notNull(),
    consumerVersionId: uuid('consumer_version_id').references(() => serviceVersions.id), // New FK to serviceVersions
    consumerGitSha: varchar('consumer_git_sha', { length: 40 }), // Git SHA for the consumer version

    // Provider information
    providerId: uuid('provider_id')
      .references(() => services.id)
      .notNull(),
    providerName: varchar('provider_name', { length: 255 }).notNull(), // Denormalized for performance
    providerVersion: varchar('provider_version', { length: 100 }).notNull(), // Provider deployment version
    providerVersionId: uuid('provider_version_id').references(() => serviceVersions.id), // New FK to serviceVersions

    // Environment
    environment: varchar('environment', { length: 100 }).notNull(),

    // Support for different specification types - determined by provider spec
    specType: specTypeEnum('spec_type').notNull().default('openapi'), // enum spec type

    // Contract metadata
    status: varchar('status', { length: 50 }).notNull().default('active'), // active, archived, deprecated

    // Timestamps
    firstSeen: timestamp('first_seen').notNull().defaultNow(),
    lastSeen: timestamp('last_seen').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    // Unique constraint to prevent duplicate contracts
    tenantConsumerProviderVersionUnique: unique().on(
      table.tenantId,
      table.consumerId,
      table.consumerVersion,
      table.providerId,
      table.providerVersion
    ),
    // Check constraint for valid spec types
    specTypeCheck: check(
      'contracts_spec_type_check',
      sql`${table.specType} IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap')`
    ),
    // Index for better query performance
    specTypeIdx: index('idx_contracts_spec_type').on(table.specType),
  })
)

// Relations
export const contractsRelations = relations(contracts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contracts.tenantId],
    references: [tenants.id],
  }),
  consumer: one(services, {
    fields: [contracts.consumerId],
    references: [services.id],
  }),
  provider: one(services, {
    fields: [contracts.providerId],
    references: [services.id],
  }),
  interactions: many(interactions),
  verificationTasks: many(verificationTasks),
}))
