import { boolean, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { users } from './users'

export const tenantSettings = pgTable('tenant_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  autoCleanupEnabled: boolean('auto_cleanup_enabled').default(false).notNull(),
  autoCleanupDays: integer('auto_cleanup_days').default(30).notNull(),
  dataRetentionDays: integer('data_retention_days').default(90).notNull(),
  notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by')
    .references(() => users.id)
    .notNull(),
})
