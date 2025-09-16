ALTER TABLE "contracts" DROP CONSTRAINT "contracts_tenant_id_consumer_id_consumer_version_provider_id_environment_unique";--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "provider_version" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "interactions" ADD COLUMN "provider_version" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_consumer_id_consumer_version_provider_id_provider_version_unique" UNIQUE("tenant_id","consumer_id","consumer_version","provider_id","provider_version");