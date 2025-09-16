ALTER TABLE "verification_results" ADD COLUMN "consumer" varchar(255);--> statement-breakpoint
ALTER TABLE "verification_results" ADD COLUMN "consumer_version" varchar(100);--> statement-breakpoint
ALTER TABLE "verification_results" ADD COLUMN "consumer_git_sha" varchar(40);