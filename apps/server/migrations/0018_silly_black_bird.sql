CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"consumer_name" varchar(255) NOT NULL,
	"consumer_version" varchar(100) NOT NULL,
	"consumer_git_sha" varchar(40),
	"provider_id" uuid NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"environment" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_tenant_id_consumer_id_consumer_version_provider_id_environment_unique" UNIQUE("tenant_id","consumer_id","consumer_version","provider_id","environment")
);
--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_consumer_id_services_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_provider_id_services_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD CONSTRAINT "verification_tasks_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;