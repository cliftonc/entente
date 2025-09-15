import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { users } from './users'

export const teamInvitations = pgTable(
  'team_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).default('member').notNull(),
    invitedBy: uuid('invited_by')
      .references(() => users.id)
      .notNull(),
    invitedAt: timestamp('invited_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
  },
  table => ({
    // Index for looking up invitations by tenant
    tenantInvitationsIdx: index('team_invitations_tenant_idx').on(table.tenantId),
    // Index for looking up invitations by email
    emailInvitationsIdx: index('team_invitations_email_idx').on(table.email),
    // Index for cleanup queries (expired invitations)
    expirationIdx: index('team_invitations_expiration_idx').on(table.expiresAt, table.status),
  })
)