import { relations } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'consumer' | 'provider'
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
})

export const servicesRelations = relations(services, ({ one }) => ({
  tenant: one(tenants, {
    fields: [services.tenantId],
    references: [tenants.id],
  }),
}))
