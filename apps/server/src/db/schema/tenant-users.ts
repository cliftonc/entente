import { pgTable, uuid, varchar, timestamp, primaryKey, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { users } from './users'

export const tenantUsers = pgTable('tenant_users', {
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).default('member').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.tenantId, table.userId] }),
  // Index for session validation query: JOIN tenant_users ON tenant_users.user_id = users.id
  userTenantIdx: index('tenant_users_user_idx').on(table.userId),
  // Index for tenant member lookups
  tenantMembersIdx: index('tenant_users_tenant_idx').on(table.tenantId, table.role),
}))