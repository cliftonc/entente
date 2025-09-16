CREATE TABLE "service_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"version" varchar(100) NOT NULL,
	"spec" jsonb,
	"git_sha" varchar(40),
	"package_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_versions_tenant_id_service_id_version_unique" UNIQUE("tenant_id","service_id","version")
);
--> statement-breakpoint
ALTER TABLE "service_dependencies" ADD COLUMN "consumer_version_id" uuid;--> statement-breakpoint
ALTER TABLE "service_dependencies" ADD COLUMN "provider_version_id" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "consumer_version_id" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "provider_version_id" uuid;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "consumer_version_id" uuid;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "provider_version_id" uuid;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "service_version_id" uuid;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "service_version_ids" uuid[];--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "service_version_id" uuid;--> statement-breakpoint
ALTER TABLE "verification_results" ADD COLUMN "provider_version_id" uuid;--> statement-breakpoint
ALTER TABLE "verification_results" ADD COLUMN "consumer_version_id" uuid;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "provider_version_id" uuid;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "consumer_version_id" uuid;--> statement-breakpoint
ALTER TABLE "service_versions" ADD CONSTRAINT "service_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_versions" ADD CONSTRAINT "service_versions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_consumer_version_id_service_versions_id_fk" FOREIGN KEY ("consumer_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_provider_version_id_service_versions_id_fk" FOREIGN KEY ("provider_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_consumer_version_id_service_versions_id_fk" FOREIGN KEY ("consumer_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_provider_version_id_service_versions_id_fk" FOREIGN KEY ("provider_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_consumer_version_id_service_versions_id_fk" FOREIGN KEY ("consumer_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_provider_version_id_service_versions_id_fk" FOREIGN KEY ("provider_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_service_version_id_service_versions_id_fk" FOREIGN KEY ("service_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_provider_version_id_service_versions_id_fk" FOREIGN KEY ("provider_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_consumer_version_id_service_versions_id_fk" FOREIGN KEY ("consumer_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD CONSTRAINT "verification_tasks_provider_version_id_service_versions_id_fk" FOREIGN KEY ("provider_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD CONSTRAINT "verification_tasks_consumer_version_id_service_versions_id_fk" FOREIGN KEY ("consumer_version_id") REFERENCES "public"."service_versions"("id") ON DELETE no action ON UPDATE no action;