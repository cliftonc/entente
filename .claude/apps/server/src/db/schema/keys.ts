import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const keys = pgTable(
  'keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
    keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    isActive: boolean('is_active').default(true).notNull(),
    permissions: text('permissions').default('read,write').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    revokedAt: timestamp('revoked_at'),
    revokedBy: varchar('revoked_by', { length: 255 }),
  },
  table => ({
    // Index for API key validation query: WHERE keyHash = ? AND isActive = true AND revokedAt IS NULL
    keyValidationIdx: index('keys_validation_idx').on(
      table.keyHash,
      table.isActive,
      table.revokedAt
    ),
    // Index for tenant key queries
    tenantKeysIdx: index('keys_tenant_idx').on(table.tenantId, table.isActive),
    // Index for update key usage query: WHERE keyHash = ?
    keyHashUpdateIdx: index('keys_hash_update_idx').on(table.keyHash),
  })
)
