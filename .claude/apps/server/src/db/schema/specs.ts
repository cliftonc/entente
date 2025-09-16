import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { services } from './services'
import { tenants } from './tenants'

export const specs = pgTable('specs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  providerId: uuid('provider_id')
    .references(() => services.id)
    .notNull(),
  service: varchar('service', { length: 255 }).notNull(), // Keep for backward compatibility
  version: varchar('version', { length: 100 }).notNull(),
  branch: varchar('branch', { length: 255 }).notNull(),
  environment: varchar('environment', { length: 100 }).notNull(),
  spec: jsonb('spec').notNull(),
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
})
