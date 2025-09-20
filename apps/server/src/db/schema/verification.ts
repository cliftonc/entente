import { relations, sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { contracts } from './contracts'
import { serviceDependencies } from './service-dependencies'
import { serviceVersions } from './service-versions'
import { services, specTypeEnum } from './services'
import { tenants } from './tenants'

export const verificationTasks = pgTable(
  'verification_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    contractId: uuid('contract_id').references(() => contracts.id), // Link to contract
    providerId: uuid('provider_id')
      .references(() => services.id)
      .notNull(),
    consumerId: uuid('consumer_id')
      .references(() => services.id)
      .notNull(),
    dependencyId: uuid('dependency_id').references(() => serviceDependencies.id),
    provider: varchar('provider', { length: 255 }).notNull(), // Keep for backward compatibility
    providerVersion: varchar('provider_version', { length: 100 }).notNull(),
    providerVersionId: uuid('provider_version_id').references(() => serviceVersions.id), // New FK to serviceVersions
    providerGitSha: varchar('provider_git_sha', { length: 40 }), // Git SHA for the provider
    consumer: varchar('consumer', { length: 255 }).notNull(), // Keep for backward compatibility
    consumerVersion: varchar('consumer_version', { length: 100 }).notNull(),
    consumerVersionId: uuid('consumer_version_id').references(() => serviceVersions.id), // New FK to serviceVersions
    consumerGitSha: varchar('consumer_git_sha', { length: 40 }), // Git SHA for the consumer
    environment: varchar('environment', { length: 100 }).notNull(),

    // Support for different specification types - inherited from contract
    specType: specTypeEnum('spec_type').notNull().default('openapi'), // enum spec type

    interactions: jsonb('interactions').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    // Unique constraint to prevent duplicate tasks for same consumer+provider version pair
    tenantConsumerProviderVersionUnique: unique().on(
      table.tenantId,
      table.consumerId,
      table.consumerVersion,
      table.providerId
    ),
    // Check constraint for valid spec types
    specTypeCheck: check(
      'verification_tasks_spec_type_check',
      sql`${table.specType} IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap')`
    ),
    // Index for better query performance
    specTypeIdx: index('idx_verification_tasks_spec_type').on(table.specType),
  })
)

export const verificationResults = pgTable(
  'verification_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    taskId: uuid('task_id')
      .references(() => verificationTasks.id)
      .notNull(),
    providerId: uuid('provider_id')
      .references(() => services.id)
      .notNull(),
    consumerId: uuid('consumer_id')
      .references(() => services.id)
      .notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerVersion: varchar('provider_version', { length: 100 }).notNull(),
    providerVersionId: uuid('provider_version_id').references(() => serviceVersions.id), // New FK to serviceVersions
    providerGitSha: varchar('provider_git_sha', { length: 40 }), // Git SHA for the provider
    consumer: varchar('consumer', { length: 255 }), // Add new field
    consumerVersion: varchar('consumer_version', { length: 100 }), // Add new field
    consumerVersionId: uuid('consumer_version_id').references(() => serviceVersions.id), // New FK to serviceVersions
    consumerGitSha: varchar('consumer_git_sha', { length: 40 }), // Git SHA for the consumer

    // Support for different specification types - inherited from task
    specType: specTypeEnum('spec_type').notNull().default('openapi'), // enum spec type

    results: jsonb('results').notNull(),
    submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  },
  table => ({
    // Check constraint for valid spec types
    specTypeCheck: check(
      'verification_results_spec_type_check',
      sql`${table.specType} IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap')`
    ),
    // Index for better query performance
    specTypeIdx: index('idx_verification_results_spec_type').on(table.specType),
  })
)

// Relations
export const verificationResultsRelations = relations(verificationResults, ({ one }) => ({
  task: one(verificationTasks, {
    fields: [verificationResults.taskId],
    references: [verificationTasks.id],
  }),
}))

export const verificationTasksRelations = relations(verificationTasks, ({ many }) => ({
  results: many(verificationResults),
}))
