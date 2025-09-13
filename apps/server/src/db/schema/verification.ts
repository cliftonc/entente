import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const verificationTasks = pgTable('verification_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerVersion: varchar('provider_version', { length: 100 }).notNull(),
  consumer: varchar('consumer', { length: 255 }).notNull(),
  consumerVersion: varchar('consumer_version', { length: 100 }).notNull(),
  environment: varchar('environment', { length: 100 }).notNull(),
  interactions: jsonb('interactions').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const verificationResults = pgTable('verification_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  taskId: uuid('task_id').references(() => verificationTasks.id).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerVersion: varchar('provider_version', { length: 100 }).notNull(),
  results: jsonb('results').notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
})