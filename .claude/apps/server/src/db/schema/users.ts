import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: integer('github_id').notNull().unique(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const userSessions = pgTable(
  'user_sessions',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    selectedTenantId: uuid('selected_tenant_id').references(() => tenants.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    // Index for session validation joins: WHERE session.id = ? (already covered by PK)
    // Index for user session lookups and expiration cleanup
    userSessionIdx: index('user_sessions_user_idx').on(table.userId, table.expiresAt),
    // Index for session expiration cleanup queries
    expirationIdx: index('user_sessions_expiration_idx').on(table.expiresAt),
  })
)
