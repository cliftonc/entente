ALTER TABLE "services" ADD COLUMN "git_repository_url" varchar(500);--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "consumer_git_sha" varchar(40);--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "git_sha" varchar(40);--> statement-breakpoint
ALTER TABLE "verification_results" ADD COLUMN "provider_git_sha" varchar(40);--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "provider_git_sha" varchar(40);--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "consumer_git_sha" varchar(40);