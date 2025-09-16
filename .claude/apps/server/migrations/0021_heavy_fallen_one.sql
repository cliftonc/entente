ALTER TABLE "deployments" ADD COLUMN "status" varchar(20) DEFAULT 'successful' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "failure_details" jsonb;