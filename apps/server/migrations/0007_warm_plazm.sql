ALTER TABLE "interactions" ADD COLUMN "hash" varchar(255);--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_tenant_id_hash_unique" UNIQUE("tenant_id","hash");