import { relations } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { serviceDependencies } from "./service-dependencies";
import { services } from "./services";
import { tenants } from "./tenants";

export const verificationTasks = pgTable(
  "verification_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    providerId: uuid("provider_id")
      .references(() => services.id)
      .notNull(),
    consumerId: uuid("consumer_id")
      .references(() => services.id)
      .notNull(),
    dependencyId: uuid("dependency_id").references(
      () => serviceDependencies.id,
    ),
    provider: varchar("provider", { length: 255 }).notNull(), // Keep for backward compatibility
    providerVersion: varchar("provider_version", { length: 100 }).notNull(),
    providerGitSha: varchar("provider_git_sha", { length: 40 }), // Git SHA for the provider
    consumer: varchar("consumer", { length: 255 }).notNull(), // Keep for backward compatibility
    consumerVersion: varchar("consumer_version", { length: 100 }).notNull(),
    consumerGitSha: varchar("consumer_git_sha", { length: 40 }), // Git SHA for the consumer
    environment: varchar("environment", { length: 100 }).notNull(),
    interactions: jsonb("interactions").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint to prevent duplicate tasks for same consumer+provider version pair
    tenantConsumerProviderVersionUnique: unique().on(
      table.tenantId,
      table.consumerId,
      table.consumerVersion,
      table.providerId,
    ),
  }),
);

export const verificationResults = pgTable("verification_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  taskId: uuid("task_id")
    .references(() => verificationTasks.id)
    .notNull(),
  providerId: uuid("provider_id")
    .references(() => services.id)
    .notNull(),
  consumerId: uuid("consumer_id")
    .references(() => services.id)
    .notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerVersion: varchar("provider_version", { length: 100 }).notNull(),
  providerGitSha: varchar("provider_git_sha", { length: 40 }), // Git SHA for the provider
  consumer: varchar("consumer", { length: 255 }), // Add new field
  consumerVersion: varchar("consumer_version", { length: 100 }), // Add new field
  consumerGitSha: varchar("consumer_git_sha", { length: 40 }), // Git SHA for the consumer
  results: jsonb("results").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

// Relations
export const verificationResultsRelations = relations(
  verificationResults,
  ({ one }) => ({
    task: one(verificationTasks, {
      fields: [verificationResults.taskId],
      references: [verificationTasks.id],
    }),
  }),
);

export const verificationTasksRelations = relations(
  verificationTasks,
  ({ many }) => ({
    results: many(verificationResults),
  }),
);
