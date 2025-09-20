ALTER TABLE "services" ADD COLUMN "spec_type" varchar(20) DEFAULT 'openapi';--> statement-breakpoint
ALTER TABLE "service_versions" ADD COLUMN "spec_type" varchar(20) DEFAULT 'openapi';--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "spec_type" varchar(20) DEFAULT 'openapi' NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_results" ADD COLUMN "spec_type" varchar(20) DEFAULT 'openapi' NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "spec_type" varchar(20) DEFAULT 'openapi' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_services_spec_type" ON "services" USING btree ("spec_type");--> statement-breakpoint
CREATE INDEX "idx_service_versions_spec_type" ON "service_versions" USING btree ("spec_type");--> statement-breakpoint
CREATE INDEX "idx_contracts_spec_type" ON "contracts" USING btree ("spec_type");--> statement-breakpoint
CREATE INDEX "idx_verification_results_spec_type" ON "verification_results" USING btree ("spec_type");--> statement-breakpoint
CREATE INDEX "idx_verification_tasks_spec_type" ON "verification_tasks" USING btree ("spec_type");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_spec_type_check" CHECK ("services"."spec_type" IS NULL OR "services"."spec_type" IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap'));--> statement-breakpoint
ALTER TABLE "service_versions" ADD CONSTRAINT "service_versions_spec_type_check" CHECK ("service_versions"."spec_type" IS NULL OR "service_versions"."spec_type" IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap'));--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_spec_type_check" CHECK ("contracts"."spec_type" IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap'));--> statement-breakpoint
ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_spec_type_check" CHECK ("verification_results"."spec_type" IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap'));--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD CONSTRAINT "verification_tasks_spec_type_check" CHECK ("verification_tasks"."spec_type" IN ('openapi', 'graphql', 'asyncapi', 'grpc', 'soap'));