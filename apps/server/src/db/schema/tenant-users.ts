import { pgTable, uuid, varchar, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { users } from './users'

export const tenantUsers = pgTable('tenant_users', {
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).default('member').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.tenantId, table.userId] }),
}))