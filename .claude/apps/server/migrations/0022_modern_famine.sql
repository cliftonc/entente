ALTER TABLE "services" ADD COLUMN "github_repository_owner" varchar(255);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "github_repository_name" varchar(255);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "github_verify_workflow_id" varchar(255);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "github_verify_workflow_name" varchar(255);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "github_auto_linked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "github_configured_at" timestamp;