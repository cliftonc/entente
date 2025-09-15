import { index, integer, json, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const githubAppInstallations = pgTable(
  'github_app_installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    installationId: integer('installation_id').notNull().unique(),
    accountType: varchar('account_type', { length: 20 }).notNull(), // 'user' | 'organization'
    accountLogin: varchar('account_login', { length: 255 }).notNull(),
    targetType: varchar('target_type', { length: 20 }).notNull(), // 'User' | 'Organization'
    permissions: json('permissions').$type<Record<string, string>>().notNull(),
    repositorySelection: varchar('repository_selection', { length: 10 }).notNull(), // 'all' | 'selected'
    selectedRepositories: json('selected_repositories').$type<Array<{
      id: number
      name: string
      fullName: string
      private: boolean
    }>>(),
    // GitHub App credentials for token generation
    appId: integer('app_id').notNull(),
    privateKeyEncrypted: text('private_key_encrypted').notNull(),
    webhookSecret: varchar('webhook_secret', { length: 255 }),
    suspendedAt: timestamp('suspended_at'),
    installedAt: timestamp('installed_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    // Index for looking up installations by tenant
    tenantInstallationIdx: index('github_app_installations_tenant_idx').on(table.tenantId),
    // Index for webhook processing (lookup by installation ID)
    installationIdx: index('github_app_installations_installation_idx').on(table.installationId),
  })
)