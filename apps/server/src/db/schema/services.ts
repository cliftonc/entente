import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const specTypeEnum = pgEnum('spec_type', ['openapi', 'graphql', 'asyncapi', 'grpc', 'soap'])

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // 'consumer' | 'provider'

    // Support for different specification types (enum)
    specType: specTypeEnum('spec_type').default('openapi'), // 'openapi', 'graphql', 'asyncapi', 'grpc', 'soap' - optional for services

    description: text('description'),
    packageJson: jsonb('package_json').notNull(), // Full package.json for metadata
    gitRepositoryUrl: varchar('git_repository_url', { length: 500 }), // GitHub repository URL
    // GitHub integration fields
    githubRepositoryOwner: varchar('github_repository_owner', { length: 255 }), // GitHub owner/org name
    githubRepositoryName: varchar('github_repository_name', { length: 255 }), // GitHub repo name
    githubVerifyWorkflowId: varchar('github_verify_workflow_id', { length: 255 }), // GitHub Actions workflow ID for verification
    githubVerifyWorkflowName: varchar('github_verify_workflow_name', { length: 255 }), // Friendly workflow name for display
    githubVerifyWorkflowPath: varchar('github_verify_workflow_path', { length: 500 }), // GitHub workflow file path for dispatch
    githubAutoLinked: boolean('github_auto_linked').default(false), // Whether repo was auto-matched during registration
    githubConfiguredAt: timestamp('github_configured_at'), // When GitHub integration was configured
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    // Check constraint for valid spec types
    specTypeCheck: check(
      'services_spec_type_check',
      sql`${table.specType} IS NULL OR ${table.specType} IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap')`
    ),
    // Index for better query performance
    specTypeIdx: index('idx_services_spec_type').on(table.specType),
  })
)

export const servicesRelations = relations(services, ({ one }) => ({
  tenant: one(tenants, {
    fields: [services.tenantId],
    references: [tenants.id],
  }),
}))
