CREATE TYPE "public"."spec_type" AS ENUM('openapi', 'graphql', 'asyncapi', 'grpc', 'soap');--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "spec_type" SET DEFAULT 'openapi'::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "services" ALTER COLUMN "spec_type" SET DATA TYPE "public"."spec_type" USING "spec_type"::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "service_versions" ALTER COLUMN "spec_type" SET DEFAULT 'openapi'::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "service_versions" ALTER COLUMN "spec_type" SET DATA TYPE "public"."spec_type" USING "spec_type"::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "contracts" ALTER COLUMN "spec_type" SET DEFAULT 'openapi'::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "contracts" ALTER COLUMN "spec_type" SET DATA TYPE "public"."spec_type" USING "spec_type"::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "specs" ALTER COLUMN "spec_type" SET DEFAULT 'openapi'::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "specs" ALTER COLUMN "spec_type" SET DATA TYPE "public"."spec_type" USING "spec_type"::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "fixtures" ALTER COLUMN "spec_type" SET DEFAULT 'openapi'::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "fixtures" ALTER COLUMN "spec_type" SET DATA TYPE "public"."spec_type" USING "spec_type"::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "verification_results" ALTER COLUMN "spec_type" SET DEFAULT 'openapi'::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "verification_results" ALTER COLUMN "spec_type" SET DATA TYPE "public"."spec_type" USING "spec_type"::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "verification_tasks" ALTER COLUMN "spec_type" SET DEFAULT 'openapi'::"public"."spec_type";--> statement-breakpoint
ALTER TABLE "verification_tasks" ALTER COLUMN "spec_type" SET DATA TYPE "public"."spec_type" USING "spec_type"::"public"."spec_type";