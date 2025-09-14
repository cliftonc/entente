ALTER TABLE "fixtures" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "fixtures" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
DROP TYPE "public"."fixture_status";--> statement-breakpoint
CREATE TYPE "public"."fixture_status" AS ENUM('draft', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "fixtures" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."fixture_status";--> statement-breakpoint
ALTER TABLE "fixtures" ALTER COLUMN "status" SET DATA TYPE "public"."fixture_status" USING "status"::"public"."fixture_status";