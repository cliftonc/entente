ALTER TABLE "specs" ADD COLUMN "spec_type" varchar(20) DEFAULT 'openapi' NOT NULL;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "spec_type" varchar(20) DEFAULT 'openapi' NOT NULL;